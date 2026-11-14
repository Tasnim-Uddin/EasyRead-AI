import json
import pytest
from agent import pipeline


@pytest.fixture
def lib(monkeypatch, tmp_path):
    monkeypatch.setenv("SHOW_UNCHECKED_CLIPS", "1")
    clips = [
        {"id": "inhaler_mdi_shake", "device_type": "inhaler_mdi", "order": 2, "video_url": "/s.mp4", "match": ["shake"]},
        {"id": "inhaler_mdi_hold", "device_type": "inhaler_mdi", "order": 5, "video_url": "/h.mp4"},
        {"id": "cream_ointment_shake", "device_type": "cream_ointment", "order": 1, "video_url": "/x.mp4"},
    ]
    f = tmp_path / "index.json"
    f.write_text(json.dumps({"clips": clips}))
    monkeypatch.setattr(pipeline, "LIBRARY", f)


def guide(dev, *texts):
    return {"facts": {"device_type": dev},
            "steps": [{"kind": "how", "text_en": t, "technique_clip_id": None} for t in texts]}


def ids(g):
    return [s["technique_clip_id"] for s in g["steps"]]


def test_spacer_guide_gets_shake_and_hold_by_content(lib):
    g = guide("inhaler_mdi_spacer", "Take the cap off.", "Shake the inhaler 4 times.",
              "Breathe in slowly.", "Hold your breath for 10 seconds.")
    pipeline.attach_clips(g)
    assert ids(g) == [None, "inhaler_mdi_shake", None, "inhaler_mdi_hold"]


def test_no_match_leaves_none(lib):
    g = guide("inhaler_mdi", "Take the cap off.", "Wait a bit.")
    pipeline.attach_clips(g)
    assert ids(g) == [None, None]


def test_other_device_family_not_matched(lib):
    g = guide("inhaler_dry_powder", "Shake it.")
    pipeline.attach_clips(g)
    assert ids(g) == [None]


def test_one_clip_per_step_and_step_per_clip(lib):
    g = guide("inhaler_mdi", "Shake it. Hold your breath.", "Shake again.")
    pipeline.attach_clips(g)
    assert ids(g) == ["inhaler_mdi_shake", "inhaler_mdi_hold"][:1] + [None] or ids(g) == ["inhaler_mdi_shake", None]


def test_falls_back_to_text_without_text_en(lib):
    g = {"facts": {"device_type": "inhaler_mdi"}, "steps": [{"kind": "how", "text": "SHAKE well", "technique_clip_id": None}]}
    pipeline.attach_clips(g)
    assert g["steps"][0]["technique_clip_id"] == "inhaler_mdi_shake"


def test_exact_device_clip_skips_spacer_guides(monkeypatch, tmp_path):
    monkeypatch.setenv("SHOW_UNCHECKED_CLIPS", "1")
    clips = [{"id": "inhaler_mdi_press", "device_type": "inhaler_mdi", "order": 4, "video_url": "/p.mp4",
              "exact_device": True, "match": ["press once"]}]
    f = tmp_path / "index.json"
    f.write_text(json.dumps({"clips": clips}))
    monkeypatch.setattr(pipeline, "LIBRARY", f)
    plain = guide("inhaler_mdi", "Press once and breathe in slowly.")
    spacer = guide("inhaler_mdi_spacer", "Press once and breathe in slowly.")
    pipeline.attach_clips(plain)
    pipeline.attach_clips(spacer)
    assert ids(plain) == ["inhaler_mdi_press"]
    assert ids(spacer) == [None]


def test_real_library_press_clip_is_listed_and_unchecked(monkeypatch):
    monkeypatch.setenv("SHOW_UNCHECKED_CLIPS", "1")
    press = [c for c in pipeline.load_library() if c["id"] == "inhaler_mdi_press"]
    assert press and press[0]["checked_by"] is None and press[0]["unchecked"] is True
