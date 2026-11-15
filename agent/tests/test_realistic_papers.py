"""Generic quality checks built from 10 real-style papers (demo/inputs/realistic, run once with the real extractor and
rewriter, no pictures). The saved guides live in data/realistic/. No live calls: each test replays the saved steps
through the post-passes."""
import json
import pathlib
import re
from agent import doctypes, postprocess

DATA = pathlib.Path(__file__).parent / "data" / "realistic"


# The app-added medicine line the saved runs were made with (it no longer adds the 999 sentence).
OLD_SAFETY_MEDICINE = "In an emergency, call 999. For advice, call 111 or ask your pharmacist or GP."


def load(name: str) -> dict:
    return json.loads((DATA / f"{name}.json").read_text())


def model_steps(g: dict) -> list[dict]:
    """The saved steps minus the safety line (finish_steps adds it back)."""
    return [{k: s[k] for k in ("text_en", "kind", "picture_prompt")} for s in g["steps"]
            if not (s["kind"] == "get_help" and (s["text_en"] in (OLD_SAFETY_MEDICINE, doctypes.SAFETY_MEDICINE) or "free advice" in s["text_en"]))]


def replay(name: str) -> list[dict]:
    g = load(name)
    steps = doctypes.ensure_content_facts(model_steps(g), g["doc_type"], g["content"])
    return doctypes.finish_steps(steps, g["doc_type"], g["domain"], [], (g.get("facts") or {}).get("device_type"))


def text(steps: list[dict]) -> str:
    return " ".join(s["text_en"] for s in steps)


def test_web_address_and_action_without_numbers_kept():
    # Council letter: "visit fenwick.example/ctax for a payment plan" and "ask about a reduction" were dropped.
    t = text(replay("a_council_photo"))
    assert "fenwick.example/ctax" in t and "reduction" in t
    for fact in ("£212.50", "£70", "17 November 2026", "0300 000 0000"):
        assert fact in t


def test_same_date_different_action_kept():
    # School letter: pay AND return the form by 30 November; only "pay" survived (same date = treated as a repeat).
    out = replay("f_spanish_school")
    t = text(out)
    assert any("permission form" in s["text_en"] and "30 November" in s["text_en"] for s in out)
    assert "allergies" in t
    for fact in ("4 December", "9:15", "15:30", "£8"):
        assert fact in t
    assert len(out) <= 12


def test_bill_total_comes_first():
    out = replay("h1_bill")
    assert "£72.02" in out[1]["text_en"]
    assert "Direct Debit" in text(out) and "27 November 2026" in text(out)


def test_made_up_form_examples_removed():
    # Direct-debit form: the rewriter added "Example: Jane Ann Smith", a bank in Leeds, a date. None is on the paper.
    out = replay("h2_dd_form")
    t = text(out)
    assert "Example" not in t and "Leeds" not in t and "Jane" not in t
    assert "1234 5678" in t  # the printed reference is real and stays
    assert len([s for s in out if re.search(r"\bbox\b", s["text_en"], re.I)]) == 7  # one step per box


def test_examples_from_the_paper_kept():
    steps = [{"text_en": "Write your name. Example: Ms Ada Sample.", "kind": "how", "picture_prompt": "p"}]
    out = doctypes.ground_examples(steps, {"fields": [{"label": "Name", "what_to_write": "Ms Ada Sample"}]})
    assert out[0]["text_en"] == "Write your name. Example: Ms Ada Sample."


def test_follow_up_without_date_not_added_twice():
    # Discharge letter: "Cardiology clinic will send you a letter" was appended raw (no full stop) next to the
    # rewriter's own "Wait for a letter from the heart clinic".
    g = load("e_discharge")
    steps = [s for s in model_steps(g) if not s["text_en"].startswith("Cardiology clinic")]
    out = doctypes.ensure_content_facts(steps, g["doc_type"], g["content"])
    assert not any(s["text_en"].startswith("Cardiology clinic") for s in out)
    assert all(re.search(r"[.!?]$", s["text_en"]) for s in doctypes.content_to_steps("letter", g["content"]))


def test_medicine_guide_fits_by_joining_short_warnings():
    out = replay("d_eyedrops_label")
    t = text(out)
    assert len(out) < 14
    for fact in ("1 drop", "both eyes", "4 times a day", "5 days", "28 days", "01632 960 777"):
        assert fact in t
    assert "111" in t and "pharmacist" in t


def test_inhaler_and_gp_letter_unchanged():
    assert len(replay("b_inhaler_dim")) == len(load("b_inhaler_dim")["steps"])
    out = replay("c_gp_letter")
    t = text(out)
    assert len(out) == len(load("c_gp_letter")["steps"])
    for fact in ("1 December 2026", "8:40am", "Room 4", "water", "111"):
        assert fact in t


def test_not_a_paper_and_unreadable_fail_clearly():
    assert load("g_not_document")["error_code"] == "not_a_document"
    assert load("i_unreadable")["error_code"] == "unreadable"


def test_fit_warnings_never_drops():
    steps = [{"text_en": f"How {i}.", "kind": "how", "picture_prompt": "p"} for i in range(10)] + \
            [{"text_en": f"Warning number {i}.", "kind": "warning", "picture_prompt": "p"} for i in range(4)]
    out = postprocess.fit_warnings(steps)
    assert len(out) == 12 and all(f"Warning number {i}." in text(out) for i in range(4))
