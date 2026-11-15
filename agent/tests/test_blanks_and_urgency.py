"""Honest handling of papers with blanks: template placeholders, amounts the paper leaves empty, invented urgency,
and close-ups that follow the step's first action. Pure functions, no AI."""
import pytest

from agent import doctypes, locate, postprocess
from agent.visuals import choose_closeup

BILL = {"doc_type": "bill", "domain": "money", "facts": {}}


@pytest.mark.parametrize("text", [
    "Pay by DD/MM/CCYY.",
    "Full fine: «PCN_Amount_of_Full_Fine»",
    "Your appointment is on [date] at [time].",
    "Go to [clinic name].",
    "Claim by DD Month YYYY.",
    "You owe £XX.XX.",
    "Sign here: ______",
    "Name: {{patient_name}}",
])
def test_placeholders_are_said_as_blank(text):
    out = postprocess.honest_blanks([{"text_en": text, "kind": "how"}])[0]["text_en"]
    assert not postprocess.PLACEHOLDER.search(out), out
    assert "(blank on your paper)" in out
    assert "((" not in out


def test_real_values_are_untouched():
    steps = [{"text_en": "Pay £98.27 by 5 May 2026. Call 0345 302 1429.", "kind": "how"},
             {"text_en": "Bring your NHS number [if you have it].", "kind": "how"}]
    out = postprocess.honest_blanks(steps)
    assert out[0]["text_en"] == steps[0]["text_en"]
    assert out[1]["text_en"] == steps[1]["text_en"]  # a bracketed aside is not a template field


def test_blank_amount_never_reads_the_template_code():
    content = {"what_this_is": "A parking fine notice.", "what_to_do": [], "by_when": [],
               "amounts": [{"what": "Full penalty charge", "amount": "not filled in («PCN_Amount_of_Full_Fine»)"},
                           {"what": "Reduced charge", "amount": "£35"}]}
    steps = doctypes.content_to_steps("bill", content)
    texts = [s["text_en"] for s in steps]
    assert "Full penalty charge: your paper does not show the amount." in texts
    assert "Reduced charge: £35" in texts
    assert not any("«" in t for t in texts)


def test_blank_amount_already_said_by_the_writer_is_not_added_again():
    content = {"what_this_is": "A parking fine notice.", "what_to_do": [], "by_when": [],
               "amounts": [{"what": "Reduced charge if paid within 14 days (50% discount)", "amount": "«PCN_Amount»"}]}
    written = [{"text_en": "This is a parking fine notice.", "kind": "what", "picture_prompt": "x"},
               {"text_en": "Reduced charge if you pay within 14 days. The paper does not say the amount.", "kind": "what",
                "picture_prompt": "x"}]
    out = doctypes.ensure_content_facts(written, "bill", content)
    assert len(out) == 2
    assert not any("blank" in s for s in out)


def test_restated_duration_step_is_dropped():
    steps = [{"text_en": "Pay within 14 days to get 50% off. This is the reduced charge.", "kind": "how"},
             {"text_en": "Pay the reduced charge within 14 days of the day the notice was served.", "kind": "when"}]
    out = postprocess.drop_restated(steps, "bill")
    assert len(out) == 1


def test_different_action_with_same_duration_is_kept():
    steps = [{"text_en": "Pay the fine within 28 days.", "kind": "how"},
             {"text_en": "Send the appeal form back within 28 days.", "kind": "when"}]
    assert len(postprocess.drop_restated(steps, "letter")) == 2


PRINTED = "notice to pay you owe £98.27 please pay by dd/mm/ccyy call the payment helpline on 0345 302 1429"


def test_urgency_the_paper_does_not_print_is_removed():
    steps = [{"text_en": "Pay the £98.27 now.", "kind": "how"},
             {"text_en": "Call the helpline today, if you cannot pay.", "kind": "how"},
             {"text_en": "Phone HMRC straight away.", "kind": "how"}]
    n = locate.ground_urgency(steps, PRINTED)
    assert n == 3
    assert [s["text_en"] for s in steps] == ["Pay the £98.27.", "Call the helpline, if you cannot pay.", "Phone HMRC."]


def test_urgency_the_paper_prints_is_kept():
    steps = [{"text_en": "Pay now.", "kind": "how"}]
    locate.ground_urgency(steps, "you must pay now or we will take action against you")
    assert steps[0]["text_en"] == "Pay now."


def test_paper_phrases_are_never_removed_on_ocr_alone():
    # OCR often misses white print on a dark box; "as soon as possible" may well be on the paper.
    steps = [{"text_en": "Pay any balance from other years as soon as possible.", "kind": "how"}]
    assert locate.ground_urgency(steps, PRINTED) == 0
    assert steps[0]["text_en"] == "Pay any balance from other years as soon as possible."


def test_urgency_unchanged_without_ocr():
    steps = [{"text_en": "Pay now.", "kind": "how"}]
    assert locate.ground_urgency(steps, locate.page_words([None], [""])) == 0
    assert steps[0]["text_en"] == "Pay now."


def test_page_words_reads_ocr_lines_and_pdf_text():
    pages = [{"lines": [{"text": "Please pay NOW"}, {"text": "Payment Helpline 0345 302 1429"}]}]
    words = locate.page_words(pages, ["Second page text"])
    assert "please pay now" in words and "second page text" in words


@pytest.mark.parametrize("text,want", [
    ("Phone the HMRC Payment Helpline on 0345 302 1429. Do this to agree how to pay.", "phone_call"),
    ("Have your National Insurance number, payment reference and sort code ready.", None),
    ("Read the back of your ticket. It says how to pay or challenge the fine.", None),
    ("Send the slip back with your payment.", "post_letter"),
    ("To pay by post, tear off the payment slip.", "post_letter"),
    ("Pay the full fine within 28 days.", "pay_card"),
    ("Pay by direct debit.", "pay_bank"),
])
def test_closeup_follows_the_first_action(text, want):
    assert choose_closeup({"text_en": text, "kind": "how"}, BILL) == want


def test_urgency_kept_when_the_paper_asks_for_speed_in_other_words():
    steps = [{"text_en": "Pay any balance from other years as soon as possible.", "kind": "how"}]
    locate.ground_urgency(steps, "balances from earlier years must be paid immediately to the council office")
    assert steps[0]["text_en"].endswith("as soon as possible.")


def test_blank_date_step_added_once_and_only_for_a_blank_date():
    sender = {"name": "HM Revenue & Customs", "kind": "government"}
    steps = [{"text_en": "Pay the £98.27 you owe.", "kind": "how", "picture_prompt": "x"}]
    out = doctypes.ensure_blank_date_step(steps, ["The pay-by date is a blank placeholder (DD/MM/CCYY)."], sender)
    assert out[-1]["text_en"] == "Your paper does not show the date. Check with HM Revenue & Customs."
    assert out[-1]["kind"] == "when"
    # already said by the writer: nothing added
    said = steps + [{"text_en": "Pay by the date on your letter. This paper does not show the date.", "kind": "how"}]
    assert doctypes.ensure_blank_date_step(said, ["The pay-by date is a placeholder."], sender) == said
    # a blank amount is not a blank date
    assert doctypes.ensure_blank_date_step(steps, ["All instalment amounts show £XXXX."], sender) == steps
    assert doctypes.ensure_blank_date_step(steps, [], sender) == steps


def test_relative_deadline_reads_as_a_period():
    content = {"what_this_is": "", "what_to_do": [], "amounts": [],
               "by_when": [{"date": "28 days from the date the notice was served", "what": "Pay the full charge"}]}
    texts = [s["text_en"] for s in doctypes.content_to_steps("bill", content)]
    assert texts == ["Pay the full charge within 28 days from the date the notice was served."]


@pytest.mark.parametrize("line,written", [
    # reworded: half the action words and no numbers
    ("Read this notice in full immediately.", "Read the whole notice."),
    # same phone number, shorter wording, plus a blank-date sentence said elsewhere
    ("To claim PIP, call 0800 917 2222 by the date on your letter. This paper does not show the date.",
     "To claim PIP, call 0800 917 2222.|Call by the date on your letter. This paper does not show the date."),
    # one line split over two steps
    ("Give 1000 ml Feed at 100 ml/hour for 10 hours, from 09:00 to 19:00.",
     "Give 1000 ml of Feed at 100 ml an hour.|Run the feed for 10 hours, from 09:00 to 19:00."),
])
def test_reworded_content_line_is_not_added_again(line, written):
    steps = [{"text_en": "This is a letter.", "kind": "what", "picture_prompt": "x"}] + \
            [{"text_en": t, "kind": "how", "picture_prompt": "x"} for t in written.split("|")]
    content = {"what_this_is": "This is a letter.", "what_to_do": [line], "by_when": [], "amounts": []}
    assert len(doctypes.ensure_content_facts(steps, "letter", content)) == len(steps)


def test_dropped_action_is_still_added_back():
    steps = [{"text_en": "This is a letter.", "kind": "what", "picture_prompt": "x"},
             {"text_en": "Call the council on 0800 123 456.", "kind": "how", "picture_prompt": "x"}]
    content = {"what_this_is": "This is a letter.",
               "what_to_do": ["Return the form by 30 November.", "Call the council on 0800 123 456."],
               "by_when": [], "amounts": []}
    out = doctypes.ensure_content_facts(steps, "letter", content)
    assert any("Return the form" in s["text_en"] for s in out)


def test_explaining_sentence_stays_with_its_warning():
    steps = [{"text_en": "Keep plastic wrapping away from children. It can cause suffocation.", "kind": "warning"},
             {"text_en": "Never use an electric drill. Use a hand screwdriver instead.", "kind": "warning"}]
    out = [s["text_en"] for s in postprocess.split_warnings(steps)]
    assert out == ["Keep plastic wrapping away from children. It can cause suffocation.",
                   "Never use an electric drill.", "Use a hand screwdriver instead."]


def test_form_cap_keeps_the_signature_step():
    steps = [{"text_en": f"Find the box called {c}. Write your answer.", "kind": "how"} for c in "ABCDEFGHIJKLMNOPQRST"]
    steps.append({"text_en": "Sign the form to give consent.", "kind": "how"})
    out = postprocess.cap(steps, "form", "school")
    assert len(out) == postprocess.CAPS["form"]
    assert out[-1]["text_en"] == "Sign the form to give consent."


def test_form_step_highlights_only_its_own_box():
    quotes = [{"t": "Family doctor telephone:", "page": 0}, {"t": "Home Address:", "page": 0}]
    step = "Find the box called Family doctor name and address. Write the name and address of the family doctor."
    assert locate.quotes_for_step(step, quotes, form=True) == []
    step2 = "Find the box called Family doctor telephone. Write the doctor's phone number."
    assert locate.quotes_for_step(step2, quotes, form=True)[0]["t"] == "Family doctor telephone:"
    step3 = "Find the box called Home Address. Write your home address."
    assert locate.quotes_for_step(step3, quotes, form=True)[0]["t"] == "Home Address:"


FORM = {"doc_type": "form", "domain": "school", "facts": {}}
MED = {"doc_type": "how_to", "domain": "medicine", "facts": {"device_type": "unknown"}}


def test_form_phone_box_is_writing_not_a_call():
    assert choose_closeup({"text_en": "Find the box called Contact Telephone No: Home. Write your home phone number.",
                           "kind": "how"}, FORM) == "write_in_box"


@pytest.mark.parametrize("text,want", [
    ("Give 1000 ml of feed at 100 ml an hour.", None),
    ("Give 1400 ml of water in small flushes through the day.", None),
    ("Give 10 ml through the feeding tube.", None),
    ("Take 5 ml with the measuring spoon.", "liquid_measure_spoon"),
])
def test_spoon_closeup_only_for_a_spoon_dose(text, want):
    assert choose_closeup({"text_en": text, "kind": "how"}, MED) == want
