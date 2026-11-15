"""Close-up choice: deterministic, conservative, and the id list matches the web library."""
import json
import pathlib
import re

import pytest

from agent import postprocess, technique, visuals
from agent.visuals import choose_closeup

ROOT = pathlib.Path(__file__).resolve().parents[2]
INHALER = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "inhaler_mdi"}}
SPACER = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "inhaler_mdi_spacer"}}
DPI = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "inhaler_dry_powder"}}
EYE = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "eye_drops"}}
CREAM = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "cream_ointment"}}
MED = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "unknown"}}
LETTER = {"doc_type": "letter", "domain": "council", "facts": {}}
BILL = {"doc_type": "bill", "domain": "money", "facts": {}}
FORM = {"doc_type": "form", "domain": "school", "facts": {}}
HOWTO = {"doc_type": "how_to", "domain": "other", "facts": {}}


def s(text, kind="how", **kw):
    return {"text_en": text, "kind": kind, **kw}


CASES = [
    # inhaler (label words)
    (INHALER, s("Shake the inhaler 4 times."), "inhaler_shake"),
    (INHALER, s("Shake it 4 or 5 times."), "inhaler_shake"),
    (INHALER, s("Breathe out. Then press once and breathe in slowly."), "inhaler_press_breathe_in"),
    (INHALER, s("Press the top once. Breathe in slowly and deeply."), "inhaler_press_breathe_in"),
    (INHALER, s("Hold your breath for 10 seconds."), "inhaler_hold_breath"),
    (INHALER, s("Wait about 30 seconds. Then do steps again for puff 2."), "inhaler_wait"),
    (INHALER, s("Breathe out fully and gently. Do not breathe out into the inhaler."), "inhaler_breathe_out"),
    (INHALER, s("Take the cap off the mouthpiece."), "inhaler_cap_off"),
    (INHALER, s("Put the cap back on."), "inhaler_cap_on"),
    (INHALER, s("If your inhaler has a steroid in it, rinse your mouth with water after your last puff. Spit the water out."), "rinse_mouth"),
    (SPACER, s("Fit your inhaler into the spacer."), "spacer_use"),
    (SPACER, s("Press your inhaler once. Breathe in slowly and gently."), "spacer_use"),
    (SPACER, s("Shake your inhaler. Fit it into your spacer."), "inhaler_shake"),
    # dry powder: never shake, never press a canister
    (DPI, s("Get your inhaler ready the way your leaflet shows. Do not shake it unless the leaflet says to."), None),
    (DPI, s("Breathe in with a quick, deep breath."), None),
    (DPI, s("Breathe out fully and gently, away from the inhaler. Never breathe out into it."), "inhaler_breathe_out"),
    # other medicines
    (EYE, s("Squeeze 1 drop into the gap. Do not let the bottle touch your eye."), "eye_drops"),
    (EYE, s("Tilt your head back."), None),
    (MED, s("Put 1 drop in each eye twice a day."), "eye_drops"),
    (CREAM, s("Squeeze a little onto the end of your finger.", technique=True), "cream_apply"),
    (MED, s("Apply the cream thinly twice a day."), "cream_apply"),
    (MED, s("Take 1 tablet with a glass of water.", "when"), "tablet_with_water"),
    (MED, s("Swallow the capsules whole."), "tablet_with_water"),
    (MED, s("Take 5ml using the measuring spoon."), "liquid_measure_spoon"),
    (MED, s("Wait 30 minutes before you eat."), "clock_wait"),
    # letters and bills
    (LETTER, s("Pay the first part by 1 December."), "pay_card"),
    (BILL, s("Pay online or by card."), "pay_card"),
    (BILL, s("Pay by bank transfer. Use the sort code on the letter."), "pay_bank"),
    (BILL, s("Set up a Direct Debit to pay each month."), "pay_bank"),
    (LETTER, s("Call the council if you cannot pay."), "phone_call"),
    (LETTER, s("If you cannot pay, phone us on 0300 123 4567."), "phone_call"),
    (LETTER, s("A part is missing? Call the shop.", "get_help"), "phone_call"),
    (LETTER, s("Go to the council website to tell us."), "go_online"),
    (LETTER, s("Fill in the form online at www.example.gov.uk."), "go_online"),
    (LETTER, s("By 1 December 2026: pay the first part", "when"), "calendar_date"),
    (LETTER, s("By 15 December 2026: tell the council if you disagree", "when"), "calendar_date"),
    (LETTER, s("Your appointment is on Tuesday 4 March at 10am.", "when"), "calendar_date"),
    (LETTER, s("Go to your appointment on 12 May."), "calendar_date"),
    (LETTER, s("Post the form back in the envelope."), "post_letter"),
    (LETTER, s("Bring this letter and your passport to the meeting."), "bring_document"),
    (LETTER, s("Keep this letter somewhere safe."), "keep_safe"),
    (LETTER, s("Wait for a letter from us."), "clock_wait"),
    # forms
    (FORM, s("Parent name: write your name in this box."), "write_in_box"),
    (FORM, s("Child's name: your child's full name"), "write_in_box"),
    (FORM, s("Signature: sign here with your normal signature."), "sign_here"),
    (FORM, s("Tick yes or no."), "tick_box"),
    (LETTER, s("Fill in the form in capital letters."), "write_in_box"),
    (LETTER, s("Sign and date the form."), "sign_here"),
    # how-to
    (HOWTO, s("Join the 2 sides to the top with 4 screws."), "screwdriver_turn"),
    (HOWTO, s("Plug it in at the wall."), "plug_in"),
    (HOWTO, s("Lay out all the parts on the floor."), None),
]

NEGATIVE = [
    (INHALER, s("This is your blue inhaler. It helps you breathe.", "what")),
    (INHALER, s("Take 2 puffs each time. Use it no more than 4 times in 1 day.", "when")),
    (INHALER, s("Tell your GP if you need it more than 3 times a week.", "warning")),
    (INHALER, s("Do not shake it.")),
    (MED, s("Do not take more than 8 tablets in 24 hours.", "warning")),
    (MED, s("Take no more than 8 tablets in 24 hours.")),
    (MED, s("Shake the bottle well.")),  # a liquid: an inhaler shake would be wrong
    (MED, s("Complete the course, even if you feel better.")),
    (MED, s("Keep out of the reach of children.")),
    (LETTER, s("This letter says your council tax bill has changed.", "what")),
    (LETTER, s("Check the new amount in the letter.")),
    (LETTER, s("New monthly bill: £112", "what")),
    (LETTER, s("Get free advice before you sign or pay. For example, Citizens Advice.", "get_help")),
    (LETTER, s("You do not need to pay anything.")),
    (LETTER, s("Do not sign anything yet.")),
    (LETTER, s("Read the whole letter.")),
    (LETTER, s("The council will write to you again.")),
    (LETTER, s("Sign up for email updates.")),
    (LETTER, s("Your postcode is on the letter.", "what")),
    (HOWTO, s("Ask a second person to help you lift it.", "warning")),
    (HOWTO, s("Stand the shelf up against a wall.")),
    (HOWTO, s("Unplug it before cleaning.")),
    (LETTER, s("", "how")),
]


@pytest.mark.parametrize("guide,step,want", CASES)
def test_choose(guide, step, want):
    assert choose_closeup(step, guide) == want


@pytest.mark.parametrize("guide,step", NEGATIVE)
def test_none(guide, step):
    assert choose_closeup(step, guide) is None


def test_deterministic():
    st = s("Shake the inhaler 4 times.")
    assert len({choose_closeup(st, INHALER) for _ in range(5)}) == 1


def test_ids_parity_with_web():
    ids = json.loads((ROOT / "web" / "src" / "closeups" / "ids.json").read_text())
    assert ids == visuals.CLOSEUP_IDS and len(ids) == len(set(ids)) >= 16
    # Every id has a drawing registered in the web library.
    src = (ROOT / "web" / "src" / "closeups" / "index.tsx").read_text()
    registry = src[src.index("const ART"):]
    for cid in ids:
        assert re.search(rf"\b{cid}\s*:", registry), cid


def test_every_returned_id_is_known():
    for g, st, want in CASES:
        got = choose_closeup(st, g)
        assert got is None or got in visuals.CLOSEUP_IDS


def test_checked_technique_lines_get_closeups():
    """The checked MDI outline maps to the matching close-ups, in order (cap off is part of the shake line)."""
    guide = INHALER
    got = [choose_closeup({"text_en": it["text"], "kind": "how", "technique": True}, guide)
           for it in technique.outline("inhaler_mdi")]
    assert got == ["inhaler_shake", "inhaler_breathe_out", None, "inhaler_press_breathe_in",
                   "inhaler_hold_breath", "inhaler_wait", "rinse_mouth"]


def test_tidy_sets_visual_on_every_step():
    steps = [s("This is your inhaler.", "what"), s("Shake the inhaler 4 times."), s("Hold your breath for 10 seconds.")]
    out = postprocess.tidy(steps, "how_to", "medicine", "inhaler_mdi")
    assert all("visual" in x for x in out)
    by_text = {x["text_en"]: x["visual"] for x in out}
    assert by_text["This is your inhaler."] is None
    assert any(v == {"kind": "closeup", "id": "inhaler_shake"} for v in by_text.values())


def test_fixtures_have_visuals():
    g = json.loads((ROOT / "demo" / "fixtures" / "guide_inhaler.json").read_text())
    ids = [st.get("visual", {}) and st["visual"]["id"] for st in g["steps"]]
    assert "inhaler_shake" in ids and "inhaler_press_breathe_in" in ids
    c = json.loads((ROOT / "demo" / "fixtures" / "guide_council_letter.json").read_text())
    cids = [st["visual"]["id"] for st in c["steps"] if st.get("visual")]
    assert "pay_card" in cids and "calendar_date" in cids and "phone_call" in cids
