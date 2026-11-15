import asyncio
import json
import os

import httpx
import pytest

from media import fal


def _mock(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(fal.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setenv("FAL_KEY", "test")


def test_step_picture_prompt_forbids_text(monkeypatch):
    seen = {}

    def handler(req):
        seen["url"] = str(req.url)
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"images": [{"url": "https://x/y.png"}]})

    _mock(monkeypatch, handler)
    assert asyncio.run(fal.make_step_picture("a blue inhaler", seed=1)) == "https://x/y.png"
    assert fal.MODELS["step_picture"] in seen["url"]
    assert "no text" in seen["body"]["prompt"] and "a blue inhaler" in seen["body"]["prompt"]
    assert seen["body"]["seed"] == 1


def test_errors_become_media_error(monkeypatch):
    _mock(monkeypatch, lambda req: httpx.Response(500, text="boom"))
    with pytest.raises(fal.MediaError):
        asyncio.run(fal.make_step_picture("x"))
    with pytest.raises(fal.MediaError):
        asyncio.run(fal.make_step_picture(" "))
    monkeypatch.delenv("FAL_KEY")
    monkeypatch.setattr(fal, "_ENV_FILES", [])
    with pytest.raises(fal.MediaError):
        asyncio.run(fal.make_step_picture("x"))


def test_annotate(monkeypatch):
    _mock(monkeypatch, lambda req: httpx.Response(200, json={"images": [{"url": "https://x/a.png"}]}))
    assert asyncio.run(fal.annotate_photo("https://x/p.png", ["cap"])) == "https://x/a.png"


def test_annotate_numbered_prompt(monkeypatch):
    seen = {}

    def handler(req):
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"images": [{"url": "https://x/a.png"}]})

    _mock(monkeypatch, handler)
    asyncio.run(fal.annotate_photo("data:image/png;base64,AA", ["cap", "mouthpiece"], numbered=True))
    assert "1: cap; 2: mouthpiece" in seen["body"]["prompt"] and seen["body"]["image_url"].startswith("data:")


@pytest.mark.skipif(not os.environ.get("FAL_KEY"), reason="live test needs FAL_KEY in the environment")
def test_live_step_picture():
    url = asyncio.run(fal.make_step_picture("a blue asthma inhaler held in an open hand", seed=1))
    assert url.startswith("http")


def test_style_is_wordless_and_character_names_no_object():
    assert "no text" in fal.STYLE and "no numbers" in fal.STYLE
    # An object named in CHARACTER gets drawn in every picture (e.g. an inhaler on a council letter).
    assert "inhaler" not in fal.CHARACTER.lower()
