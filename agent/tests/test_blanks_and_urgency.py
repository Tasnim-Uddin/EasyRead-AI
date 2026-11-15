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
