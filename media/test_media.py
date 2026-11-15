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
    p = seen["body"]["prompt"]
    assert "no text" in p and "a blue inhaler" in p
    # plain text-to-image: no reference portrait goes with the request any more
    assert "image_urls" not in seen["body"] and "image_url" not in seen["body"]
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


def test_style_is_wordless():
    assert "no text" in fal.STYLE and "no numbers" in fal.STYLE
    assert "no text" in fal.NO_TEXT.lower() and "plain grey lines" in fal.NO_TEXT


def test_picture_is_a_close_up_with_no_person():
    """The live guide is the only person on screen: step pictures are hands + the object only."""
    p = fal.step_picture_prompt("a hand holding a phone").lower()
    for rule in ("only hands and the one object", "no person", "no face", "no head", "no body", "no decoration"):
        assert rule in p
    # continuity with the guide and the animated close-ups: skin tone + sage sleeve, close-up palette
    assert "warm brown skin" in p and "sage green sleeve" in p
    for colour in ("#fcebd6", "#f5973f", "#b5744a", "#93a27a"):
        assert colour in p
    # no full-character reference or description any more
    assert not hasattr(fal, "CHARACTER") and not hasattr(fal, "guide_ref_uri")
    assert "earrings" not in p and "bun" not in p


@pytest.mark.parametrize("raw,want,gone", [
    ("two hands holding an opened letter from a benefits office", "two hands holding an opened letter", ["benefits"]),
    ("a hand writing a date in a small paper diary with a pen", "a hand writing in a small paper diary with a pen", ["date"]),
    ('hands holding a letter from DWP saying "Universal Credit"', "hands holding a letter", ["dwp", "universal"]),
    ("a calendar with 12 March circled", "a calendar", ["12", "march"]),
    ("a person doing one simple task", "hands doing one simple task", ["person"]),
    ("the pharmacist handing over a bag", "hands handing over a bag", ["pharmacist"]),
    ("a hand holding a mobile phone to make a call", "a hand holding a mobile phone to make a call", []),
])
def test_wordless_drops_what_the_model_would_write(raw, want, gone):
    out = fal.wordless(raw)
    assert out.startswith(want)
    for w in gone:
        assert w not in out.lower()


def test_wordless_never_empty():
    assert fal.wordless('"Council tax" 2025') == "two hands holding a sheet of paper"
