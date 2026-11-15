"""v4 guide stage: the persona narrates one step at a time, checks in, and names who to ask."""
from agent import persona

STEPS = [{"index": 0, "kind": "how", "text_en": "Pay the bill."}, {"index": 1, "kind": "when", "text_en": "Pay by 17 Nov."}]


def test_one_step_then_check_in():
    p = persona.system_prompt({"steps": STEPS}, "en", 1)
    assert "ONE STEP AT A TIME" in p and persona.CHECKIN in p
    assert "read step with index 1 aloud" in p and "do NOT call show_step" in p


def test_intro_waits_for_the_user():
    p = persona.system_prompt({"steps": STEPS}, "en", 0)
    assert "Are you ready to get started?" in p and "Yes, let's start" in p


def test_who_to_ask_uses_the_sender():
    g = {"steps": STEPS, "sender": {"name": "Leeds City Council", "kind": "council", "contact": "0113 222 4404"}}
    p = persona.system_prompt(g, "en", 0)
    assert "That is not on your paper." in p and "Leeds City Council" in p and "0113 222 4404" in p


def test_who_to_ask_without_a_sender():
    assert persona.who_to_ask({"steps": []}) == "whoever sent them this paper"
    assert persona.who_to_ask({"sender": None}) == "whoever sent them this paper"


def test_no_app_added_advice_lines():
    p = persona.system_prompt({"steps": STEPS, "safety_lines": ["Call 111"]}, "en", 0)
    for line in ("Call 111", "999", "Citizens Advice", "pharmacist or GP"):
        assert line not in p, line
