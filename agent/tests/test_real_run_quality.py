"""Real keyed run (inhaler label + leaflet, no device photo): the puff was missing and the conflict was repeated
as 4 warnings. Replays the saved model output through the deterministic post-pass; no live calls."""
import copy, json, pathlib
from agent import pipeline, postprocess
from agent.doctypes import finish_steps

RUN = json.loads((pathlib.Path(__file__).parent / "data" / "real_inhaler_run.json").read_text())


def finished(facts=None):
    facts = facts or RUN["facts"]
    dev = postprocess.device_from_facts(facts)
    return finish_steps(copy.deepcopy(RUN["steps"]), "how_to", "medicine", facts["conflicts"], dev)


def texts(steps, kind=None):
    return [s["text_en"] for s in steps if kind is None or s["kind"] == kind]


def test_label_text_names_the_device_without_a_photo():
    facts = {**RUN["facts"], "device_type": "unknown", "device_confidence": 0.2}
    assert postprocess.device_from_facts(facts) == "inhaler_mdi"
    assert postprocess.device_from_facts({"medicine": "Paracetamol 500 mg tablets", "device_type": "unknown"}) == "unknown"
    assert postprocess.device_from_facts({"medicine": "Ventolin Accuhaler"}) == "inhaler_dry_powder"


def test_how_steps_include_the_full_checked_puff():
    for facts in (RUN["facts"], {**RUN["facts"], "device_type": "unknown"}):
        how = " ".join(texts(finished(facts), "how")).lower()
        for must in ("shake", "breathe out", "lips", "press your inhaler once", "breathe in", "hold your breath", "wait"):
            assert must in how, must
        # in order: breathe out -> mouthpiece -> press/breathe in -> hold
        assert how.index("breathe out") < how.index("mouthpiece in your mouth") < how.index("press your inhaler") \
            < how.index("hold your breath")


def test_checked_steps_get_their_clips(monkeypatch):
    lib = [{"id": "inhaler_mdi_shake", "device_type": "inhaler_mdi", "match": ["shake"], "checked_by": "x"},
           {"id": "inhaler_mdi_press", "device_type": "inhaler_mdi", "match": ["press your inhaler"], "checked_by": "x",
            "exact_device": True},
           {"id": "inhaler_mdi_hold", "device_type": "inhaler_mdi", "match": ["hold your breath"], "checked_by": "x"}]
    monkeypatch.setattr(pipeline, "load_library", lambda: lib)
    guide = {"facts": {"device_type": "inhaler_mdi"},
             "steps": [{"text_en": s["text_en"], "kind": s["kind"], "technique_clip_id": None} for s in finished()]}
    pipeline.attach_clips(guide)
    got = {s["technique_clip_id"] for s in guide["steps"] if s["technique_clip_id"]}
    assert got == {"inhaler_mdi_shake", "inhaler_mdi_press", "inhaler_mdi_hold"}


def test_conflict_once_and_dose_limits_merged():
    steps = finished()
    warn = texts(steps, "warning")
    assert sum(postprocess.is_conflict(t) for t in texts(steps)) == 1
    assert postprocess.is_conflict(texts(steps)[0])
    assert not any(t.startswith(("Your label says", "Your leaflet says", "Ask your pharmacist how many")) for t in warn)
    assert len(warn) <= 1 + postprocess.MAX_WARNINGS
    joined = " ".join(warn)
    # every distinct safety number / fact survives
    assert "4 times in 24 hours" in joined and "8 puffs in 24 hours" in joined
    assert "usual dose stops working" in joined
    assert "more often than advised" not in joined  # vague limit dropped: concrete limits exist
    assert steps[-1]["kind"] == "get_help" and "999" in steps[-1]["text_en"]
    assert len(steps) < len(RUN["steps"])


def test_summary_line_has_no_stray_capital():
    assert pipeline.summary_line_en({"facts": RUN["facts"]}) == \
        "2 puffs, when needed for wheeze or breathlessness. Maximum 4 times in 24 hours."
    assert pipeline.summary_line_en({"facts": {"dose": "1 tablet", "frequency": "NHS advice"}}) == "1 tablet, NHS advice"


def test_second_conflict_in_other_words_is_dropped():
    # Live verification run 2026-11-15: the model still wrote 'The paper does not agree with itself.' as a warning.
    steps = [{"text_en": t, "kind": k, "picture_prompt": "x"} for k, t in [
        ("warning", postprocess.CONFLICT_TEXT), ("what", "Use this inhaler when you wheeze."),
        ("warning", "The paper does not agree with itself."), ("warning", "Use your inhaler only when you need it."),
        ("warning", "Tell your doctor if your usual dose stops working."), ("get_help", "Call 999 if you cannot breathe.")]]
    out = texts(finish_steps(steps, "how_to", "medicine", RUN["facts"]["conflicts"], "inhaler_mdi"))
    assert "The paper does not agree with itself." not in out
    assert "Use your inhaler only when you need it." in out and "Tell your doctor if your usual dose stops working." in out
