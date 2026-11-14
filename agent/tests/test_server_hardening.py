import asyncio, io, time
import pytest
from PIL import Image
from agent import llm, pipeline


def _jpeg(size, noisy=True):
    import os
    im = Image.frombytes("RGB", size, os.urandom(size[0] * size[1] * 3)) if noisy else Image.new("RGB", size, "white")
    b = io.BytesIO(); im.save(b, "JPEG", quality=95); return b.getvalue()


def test_big_photo_downscaled():
    data = _jpeg((3000, 2400))
    assert len(data) > llm.MAX_IMAGE_BYTES
    out, mt = llm.prepare_image(data, "image/jpeg")
    assert mt == "image/jpeg" and len(out) < llm.MAX_IMAGE_BYTES
    assert max(Image.open(io.BytesIO(out)).size) <= llm.MAX_EDGE


def test_small_photo_untouched():
    data = _jpeg((200, 200), noisy=False)
    assert llm.prepare_image(data, "image/jpeg") == (data, "image/jpeg")


def test_corrupt_image_clear_code():
    with pytest.raises(llm.LLMError) as e:
        llm.prepare_image(b"\xff\xd8\xff" + b"x" * (llm.MAX_IMAGE_BYTES + 1), "image/jpeg")
    assert e.value.code == "image_unreadable"


def _run_failed(monkeypatch, tmp_path, files):
    g = pipeline.new_guide("g_t1", "en")

    class FakeStore:
        get = staticmethod(lambda i: g)
        put = staticmethod(lambda x: None)
        emit = staticmethod(lambda *a: None)
    asyncio.run(pipeline.run(FakeStore, "g_t1", files, None, "en", []))
    return g


def test_no_key_upload_is_error_not_sample(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("EASYREAD_ALLOW_FIXTURE", raising=False)
    g = _run_failed(monkeypatch, tmp_path, [(_jpeg((50, 50)), "image/jpeg", None)])
    assert g["status"] == "failed" and g["error_code"] == "demo_mode_no_key" and not g["steps"]


def test_llm_timeout_becomes_failed_with_code(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    async def boom(*a, **k): raise llm.LLMError("ai_timeout", "slow")
    monkeypatch.setattr(llm, "complete_json", boom)
    g = _run_failed(monkeypatch, tmp_path, [(_jpeg((50, 50)), "image/jpeg", None)])
    assert g["status"] == "failed" and g["error_code"] == "ai_timeout"


def test_anthropic_timeout_mapped(monkeypatch):
    import anthropic, httpx
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    class M:
        async def create(self, **k): raise anthropic.APITimeoutError(request=httpx.Request("POST", "http://x"))
    class C: messages = M()
    monkeypatch.setattr(llm, "_client", lambda: C())
    with pytest.raises(llm.LLMError) as e:
        asyncio.run(llm.complete("s", "hi"))
    assert e.value.code == "ai_timeout"


def test_stuck_picture_fails_cleanly(monkeypatch):
    import media, sys
    async def stuck(prompt): await asyncio.sleep(30)
    monkeypatch.setattr(media, "make_step_picture", stuck)
    monkeypatch.setenv("FAL_KEY", "x")
    monkeypatch.setattr(pipeline, "PICTURE_TIMEOUT_S", 0.05)
    g = {"id": "g", "steps": [{"picture_prompt": "p", "image_url": None}]}
    t = time.time()
    asyncio.run(pipeline.illustrate(g, lambda e: None))
    assert g["steps"][0]["status"] == "failed" and time.time() - t < 5
