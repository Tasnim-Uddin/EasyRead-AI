"""Device photo labels (fal annotate). Mocks only, no live calls."""
import asyncio
import media
from agent import pipeline

PHOTO = (b"\x89PNGfake", "image/png")


def _guide(dt="inhaler_mdi"):
    return {"id": "g", "source": {}, "facts": {"device_type": dt}}


def test_stores_labelled_url(monkeypatch):
    seen = {}

    async def fake(url, labels, numbered=False):
        seen.update(url=url, labels=labels, numbered=numbered)
        return "https://fal/x.jpg"
    monkeypatch.setenv("FAL_KEY", "k")
    monkeypatch.setattr(media, "annotate_photo", fake)
    g = _guide()
    asyncio.run(pipeline.label_device_photo(g, PHOTO, ["/api/uploads/a.png", "/api/uploads/dev.png"]))
    assert g["source"]["device_photo_labelled_url"] == "https://fal/x.jpg"
    assert g["source"]["device_photo_url"] == "/api/uploads/dev.png"
    assert g["source"]["device_photo_labels"] == ["cap", "mouthpiece", "canister"]
    assert seen["url"].startswith("data:image/png;base64,") and seen["numbered"] is True


def test_error_is_skipped(monkeypatch):
    async def boom(*a, **k):
        raise media.MediaError("down")
    monkeypatch.setenv("FAL_KEY", "k")
    monkeypatch.setattr(media, "annotate_photo", boom)
    g = _guide()
    asyncio.run(pipeline.label_device_photo(g, PHOTO, ["/u"]))
    assert "device_photo_labelled_url" not in g["source"]


def test_not_called_without_photo_key_or_known_device(monkeypatch):
    calls = []

    async def fake(*a, **k):
        calls.append(1)
        return "u"
    monkeypatch.setattr(media, "annotate_photo", fake)
    monkeypatch.setenv("FAL_KEY", "k")
    asyncio.run(pipeline.label_device_photo(_guide(), None, []))
    asyncio.run(pipeline.label_device_photo(_guide("tablets"), PHOTO, ["/u"]))
    monkeypatch.delenv("FAL_KEY")
    asyncio.run(pipeline.label_device_photo(_guide(), PHOTO, ["/u"]))
    assert calls == []
