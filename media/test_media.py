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


@pytest.mark.skipif(not os.environ.get("FAL_KEY"), reason="live test needs FAL_KEY in the environment")
def test_live_step_picture():
    url = asyncio.run(fal.make_step_picture("a blue asthma inhaler held in an open hand", seed=1))
    assert url.startswith("http")
