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
    (LETTER, s("Fill in the form online at www.example.gov.uk."), "online_form"),
    (LETTER, s("By 1 December 2026: pay the first part", "when"), "calendar_date"),
    (LETTER, s("By 15 December 2026: tell the council if you disagree", "when"), "calendar_date"),
    (LETTER, s("Your appointment is on Tuesday 4 March at 10am.", "when"), "calendar_date"),
    (LETTER, s("Go to your appointment on 12 May."), "calendar_date"),
    (LETTER, s("Post the form back in the envelope."), "post_letter"),
    (LETTER, s("Bring this letter and your passport to the meeting."), "bring_document"),
    (LETTER, s("Keep this letter somewhere safe."), "keep_safe"),
    (LETTER, s("Wait for a letter from us."), "letter_arrive"),
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
    (HOWTO, s("Lay out all the parts on the floor."), "parts_check"),
]

# Real step texts from unseen everyday papers (rent notice, parking fine, energy bill, council tax, HMRC, DWP,
# NHS appointment, school form, Direct Debit form, flat-pack leaflet, paracetamol leaflet).
LEGAL = {"doc_type": "letter", "domain": "legal", "facts": {}}
COUNCIL_BILL = {"doc_type": "bill", "domain": "council", "facts": {}}
BENEFIT = {"doc_type": "letter", "domain": "other", "facts": {}}
NHS = {"doc_type": "letter", "domain": "medicine", "facts": {}}
LEAFLET = {"doc_type": "how_to", "domain": "medicine", "facts": {}}
DD_FORM = {"doc_type": "form", "domain": "money", "facts": {}}

EVERYDAY = [
    # the paper itself
    (LEGAL, s("This letter says your landlord wants to change your rent.", "what", index=0), "letter_open"),
    (COUNCIL_BILL, s("This is a parking fine notice from North Lincolnshire Council.", "what", index=0), "letter_open"),
    (BILL, s("This is an example gas bill from Efficient Energy to Ms P Smith.", "what", index=0), "letter_open"),
    (COUNCIL_BILL, s("Read this council tax reminder from Fenwick Borough Council about an unpaid instalment.", "what", index=0), "letter_open"),
    (NHS, s("This is an NHS letter. It reminds you about an appointment in person.", "what", index=0), "letter_open"),
    (NHS, s("The dietitian wrote this letter to Dr O'Reilly, the GP.", "what", index=0), "letter_open"),
    (BENEFIT, s("This letter from the DWP says your Disability Living Allowance is ending.", "what", index=0), "letter_open"),
    (LETTER, s("This letter says your council tax bill has changed.", "what"), "letter_open"),
    # reading and finding
    (LEGAL, s("Read the whole notice."), "read_letter"),
    (LEGAL, s("Read Section 5. It shows how to take action and where to find advice."), "read_letter"),
    (LETTER, s("Read the whole letter."), "read_letter"),
    (COUNCIL_BILL, s("Read the back of your original ticket. It says how to pay or challenge the fine."), "read_letter"),
    (HOWTO, s("You are building a piece of furniture. Read all the instructions first.", "what", index=0), "read_letter"),
    (LEGAL, s("Find the date in question 4.6. This page does not show the date."), "calendar_date"),
    (BILL, s("Have your National Insurance number and payment reference ready when you phone."), "id_number_find"),
    (BILL, s("Have your bank account number and sort code ready too."), "id_number_find"),
    (COUNCIL_BILL, s("Write your Penalty Charge Notice number on the back of the cheque."), "write_in_box"),
    # amounts
    (BILL, s("The total you owe for these periods is £98.27.", "what"), "check_amount"),
    (BILL, s("Check your new account balance. It is £168.97 in debit."), "check_amount"),
    (BILL, s("Charges from 20 October 2025 to 20 November 2025: £176.61. This includes VAT at 5%.", "what"), "check_amount"),
    (COUNCIL_BILL, s("Full penalty charge. The paper does not say the amount. Ask the council.", "what"), "check_amount"),
    (LETTER, s("Check the new amount in the letter."), "check_amount"),
    (LETTER, s("New monthly bill: £112", "what"), "check_amount"),
    # money moves
    (COUNCIL_BILL, s("Pay each instalment on the 1st of the month."), "instalments"),
    (BILL, s("Note that your monthly Direct Debit payments are going up."), "instalments"),
    (COUNCIL_BILL, s("Or visit the council website to arrange a payment plan."), "instalments"),
    (COUNCIL_BILL, s("Pay the £212.50 instalment in full."), "pay_card"),
    (BENEFIT, s("We will pay £84.80 into your bank account every 4 weeks.", "what"), "bank_transfer"),
    (BILL, s("You will get a refund of the money you overpaid."), "bank_transfer"),
    (BILL, s("Give your supplier a meter reading each month. Or use a smart meter."), "meter_reading"),
    # choices, help, places
    (BENEFIT, s("Decide if you want to claim Personal Independence Payment. It is called PIP."), "decide"),
    (BILL, s("Think about switching to a cheaper tariff. A tariff is the price plan you pay for your gas."), "decide"),
    (LEGAL, s("If you disagree or have questions, talk to your landlord or get advice."), "ask_help"),
    (NHS, s("If you cannot attend, contact the hospital as soon as possible."), "ask_help"),
    (LETTER, s("Get free advice before you sign or pay. For example, Citizens Advice.", "get_help"), "ask_help"),
    (HOWTO, s("If a part is missing or damaged, stop building. Contact the customer service team.", "get_help"), "ask_help"),
    (NHS, s("Go to your appointment in person. The paper does not say the date, time or place."), "appointment_go"),
    (BENEFIT, s("Attend your assessment at the centre."), "appointment_go"),
    (LETTER, s("Visit the council office to show your documents."), "building_visit"),
    (BENEFIT, s("Bring your passport or driving licence."), "bring_id"),
    (LETTER, s("Email us at help@example.gov.uk with your reference."), "email_send"),
    (BENEFIT, s("Apply online at www.gov.uk/pip."), "online_form"),
    (LETTER, s("The council will write to you again."), "letter_arrive"),
    (LEGAL, s("To challenge the rent, take action before the date in question 4.6."), "deadline_clock"),
    (COUNCIL_BILL, s("Appeal within 28 days."), "deadline_clock"),
    # forms
    (FORM, s("Find the line that says I confirm that I have parental responsibility for. Write your child's name."), "write_in_box"),
    (FORM, s("Find the box called Signed.", "warning"), "sign_here"),
    (DD_FORM, s("Find the box called Signature. Sign your name. If there is more than 1 account holder, all account holders sign."), "sign_here"),
    (DD_FORM, s("Find the box called Reference. It is already filled in. Check it matches your bill."), "write_in_box"),
    # warnings: calm sign, or the action they name
    (BENEFIT, s("If you do not call to claim PIP, your DLA will end.", "warning"), "warning_attention"),
    (BILL, s("HMRC may pass your debt to a Debt Collection Agency.", "warning"), "warning_attention"),
    (HOWTO, s("Keep children away while you build. Small parts can cause choking.", "warning"), "warning_attention"),
    (HOWTO, s("Ask a second person to help you lift it.", "warning"), "ask_help"),
    (INHALER, s("Tell your GP if you need it more than 3 times a week.", "warning"), "ask_help"),
    (MED, s("Do not take more than 8 tablets in 24 hours.", "warning"), "warning_attention"),
    # medicine: the leaflet's own words only
    (LEAFLET, s("Take 1 or 2 tablets. Swallow the tablets with a drink of water.", "what", index=0), "tablet_with_water"),
    (LEAFLET, s("Talk to your doctor if you do not get better.", "get_help"), "ask_help"),
]

# Steps that must stay without a close-up even with the broader matching.
EVERYDAY_NONE = [
    # a clinical letter's feed plan: never a spoon, a bottle or a hand
    (NHS, s("Give 1000 ml of Energy Multifibre Feed at 100 ml an hour.")),
    (NHS, s("Give 1400 ml of water in small flushes through the day.")),
    (NHS, s("Run the feed for 10 hours, from 09:00 to 19:00.")),
    (NHS, s("Give a flush before the feed, after the feed, and with medicines.")),
    # medicine steps with no checked picture
    (LEAFLET, s("Do not store the tablets above 25°C. Keep them out of the sight and reach of children.")),
    (MED, s("Use it when you feel wheezy or tight in your chest.", "when")),
    (INHALER, s("This is your blue inhaler. It helps you breathe.", "what", index=0)),
    # hands-on everyday close-ups are never shown on a medicine paper
    (LEAFLET, s("Check you have all the parts of the spacer.")),
    (LEAFLET, s("Spread the payments over a year.")),
    # no action, no topic
    (HOWTO, s("You are building a small bookshelf.", "what", index=0)),
    (HOWTO, s("Slide the back panel into the groove.")),
    (LETTER, s("Your postcode is on the letter.", "what", index=3)),
    (LETTER, s("You do not need to pay anything.")),
]


@pytest.mark.parametrize("guide,step,want", EVERYDAY)
def test_everyday(guide, step, want):
    assert choose_closeup(step, guide) == want


@pytest.mark.parametrize("guide,step", EVERYDAY_NONE)
def test_everyday_none(guide, step):
    assert choose_closeup(step, guide) is None


def test_attach_uses_position_for_the_intro():
    steps = [s("This is a reminder from the council about your bill.", "what"), s("This is a reminder from the council.", "what")]
    out = visuals.attach_visuals(steps, LETTER)
    assert [x["visual"]["id"] for x in out] == ["letter_open", "letter_open"]


def test_new_ids_have_drawings():
    src = (ROOT / "web" / "src" / "closeups" / "everyday.tsx").read_text()
    for name in ["LetterOpen", "ReadLetter", "CheckAmount", "DeadlineClock", "AppointmentGo", "BuildingVisit", "BringId",
                 "EmailSend", "OnlineForm", "BankTransfer", "Instalments", "Decide", "AskHelp", "WarningAttention",
                 "IdNumberFind", "MeterReading", "PartsCheck", "LetterArrive"]:
        assert f"export function {name}()" in src, name
    # No text inside the drawings.
    assert "<text" not in src

NEGATIVE = [
    (INHALER, s("This is your blue inhaler. It helps you breathe.", "what")),
    (INHALER, s("Take 2 puffs each time. Use it no more than 4 times in 1 day.", "when")),
    (INHALER, s("Do not shake it.")),
    (MED, s("Take no more than 8 tablets in 24 hours.")),
    (MED, s("Shake the bottle well.")),  # a liquid: an inhaler shake would be wrong
    (MED, s("Complete the course, even if you feel better.")),
    (MED, s("Keep out of the reach of children.")),
    (LETTER, s("You do not need to pay anything.")),
    (LETTER, s("Do not sign anything yet.")),
    (LETTER, s("Sign up for email updates.")),
    (LETTER, s("Your postcode is on the letter.", "what")),
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
