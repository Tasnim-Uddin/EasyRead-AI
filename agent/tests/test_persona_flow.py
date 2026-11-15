"""The guide narrates one step, then stops and waits: no per-step check-in, no 'tell me back' offer unless switched on."""
from agent import persona

GUIDE = {"steps": [{"index": 0, "kind": "what", "text_en": "Take one tablet."},
                   {"index": 1, "kind": "when", "text_en": "Take it in the morning."}], "facts": {}}


def test_no_checkin_question(monkeypatch):
    monkeypatch.delenv("EASYREAD_SHOW_CHECK", raising=False)
    for i in (0, 1):
        p = persona.system_prompt(GUIDE, "en", i)
        assert "Ready to move on, or any questions?" not in p
        assert "stop" in p and "wait" in p
        assert persona.ASK_ANY_TIME in p


def test_check_offer_behind_flag(monkeypatch):
    monkeypatch.delenv("EASYREAD_SHOW_CHECK", raising=False)
    assert "tell me back" not in persona.system_prompt(GUIDE, "en")
    monkeypatch.setenv("EASYREAD_SHOW_CHECK", "1")
    assert "tell me back" in persona.system_prompt(GUIDE, "en")
    # the tool stays registered either way
    assert "check_understanding" in {t["name"] for t in persona.TOOLS}
