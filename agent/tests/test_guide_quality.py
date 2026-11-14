"""Regression: the first paid run's steps (agent/tests/data/run_*.json) go through the post-processing, no LLM."""
import asyncio, json, pathlib
from agent import doctypes, pipeline, postprocess, technique

DATA = pathlib.Path(__file__).parent / "data"


def load(name):
    return json.loads((DATA / f"run_{name}.json").read_text())


def finish(name):
    g = load(name)
    f = g["facts"]
    steps = doctypes.finish_steps([dict(s) for s in g["steps"]], g["doc_type"], g["domain"], f["conflicts"], f.get("device_type"))
    return g, steps


def texts(steps):
    return [s["text_en"] for s in steps]


def no_duplicates(steps):
    t = texts(steps)
    return not any(postprocess.similar(a, b) for i, a in enumerate(t) for b in t[i + 1:])


def test_inhaler_one_conflict_first_and_technique():
    g, steps = finish("inhaler")
    t = texts(steps)
    assert sum(postprocess.is_conflict(x) for x in t) == 1
    assert postprocess.is_conflict(t[0])  # before any dose
    assert no_duplicates(steps) and len(steps) <= postprocess.CAPS["medicine"]
    low = " ".join(t).lower()
    for key in ("breathe out", "hold your breath", "wait at least 30 seconds"):
        assert key in low
    ranks = [postprocess.RANK[s["kind"]] for s in steps if not postprocess.is_conflict(s["text_en"])]
    assert ranks == sorted(ranks)  # what, how, warning, get_help
    for s in steps:
        if s["kind"] == "warning" and not postprocess.is_conflict(s["text_en"]):
            assert len([p for p in s["text_en"].split(". ") if p]) == 1  # one fact per warning
    assert any("999" in x for x in t)


def test_council_no_repeats_and_order():
    g, steps = finish("council")
    assert no_duplicates(steps) and len(steps) <= postprocess.CAPS["letter"]
    t = texts(steps)
    assert not any(x.startswith(("Unpaid council tax instalment", "Extra costs")) for x in t)
    assert sum("£212.50" in x for x in t) == 1  # pay step once
    assert steps[0]["kind"] == "what"
    ranks = [postprocess.RANK[s["kind"]] for s in steps]
    assert ranks == sorted(ranks)
    assert "free advice" in t[-1]


def test_flatpack_shape():
    g, steps = finish("flatpack")
    assert no_duplicates(steps) and len(steps) <= 12
    assert steps[0]["kind"] == "what" and steps[-1]["kind"] == "get_help"


def test_cap_keeps_first_and_help():
    many = [{"text_en": f"Do thing number {i} with part {i}.", "kind": "how", "picture_prompt": "x"} for i in range(1, 20)]
    steps = [{"text_en": "This is a letter.", "kind": "what", "picture_prompt": "x"}] + many + \
            [{"text_en": "Ask for help now please.", "kind": "get_help", "picture_prompt": "x"}]
    out = postprocess.cap(steps, "letter", "council")
    # Every step here carries its own number (a fact), so cap() allows a few extra steps before it trims facts.
    assert len(out) == 8 + postprocess.EXTRA_FOR_FACTS and out[0]["kind"] == "what" and out[-1]["kind"] == "get_help"
    plain = [{**s, "text_en": f"Do thing {c} with part {c}."} for c, s in zip("abcdefghijklmnopqrs", many)]
    out = postprocess.cap(steps[:1] + plain + steps[-1:], "letter", "council")
    assert len(out) == 8 and out[0]["kind"] == "what" and out[-1]["kind"] == "get_help"


def test_similar_respects_digits():
    assert not postprocess.similar("Take 2 puffs.", "Take 4 puffs.")
    assert postprocess.similar("Pay £212.50 by 17 November.", "Pay the £212.50 by 17 November.")


def test_technique_outlines_have_no_doses():
    for dev, items in technique.TECHNIQUES.items():
        assert items and all("puffs" not in i[0] and "mg" not in i[0] for i in items)
    assert technique.outline("unknown") == []


def test_rewriter_gets_outline_and_result_is_finished(monkeypatch):
    g = load("inhaler")
    seen = {}

    async def fake_write(facts, language="en", *a):
        seen["facts"] = facts
        return [dict(s) for s in g["steps"]]
    monkeypatch.setattr(pipeline, "write_easy_read", fake_write)
    raw = asyncio.run(pipeline.write_easy_read(pipeline.with_technique(g["facts"]), "en"))
    steps = doctypes.finish_steps(raw, "how_to", "medicine", g["facts"]["conflicts"], g["facts"]["device_type"])
    assert "Hold your breath" in " ".join(texts(steps))
    assert seen["facts"]["technique_outline"] == technique.outline_for_prompt("inhaler_mdi_spacer")


def test_inhaler2_long_conflict_step_collapses_and_technique_split():
    """Second paid run: the model wrote a long conflict step that did not contain the canonical sentence
    verbatim, so a second flag was inserted; hold + wait came as one step."""
    g, steps = finish("inhaler2")
    t = texts(steps)
    assert sum(postprocess.is_conflict(x) for x in t) == 1 and t[0] == postprocess.CONFLICT_TEXT
    assert no_duplicates(steps)
    assert not any("hold your breath" in x.lower() and "wait" in x.lower() for x in t)
    assert not any("breathe out" in x.lower() and "mouthpiece" in x.lower() for x in t)
    assert any(x.startswith("Wait about 30 seconds") for x in t)
    assert any("999" in x for x in t)
    print(len(steps), t)


def test_every_technique_has_nhs_source_and_unsigned_check():
    for dev in technique.TECHNIQUES:
        s = technique.sources(dev)
        assert s["urls"] and s["checked_on"] == "2026-11-14" and s["checked_by"] is None
    assert technique.sources("unknown")["urls"] == []
