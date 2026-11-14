"""Failures seen on realistic uploads (phone photos, PDFs, bills, discharge letters). Mocks only, no live calls."""
from agent import doctypes, pipeline, postprocess
from agent.tests.test_multidoc import JPEG, mocked, post  # noqa: F401  (fixture)

DRAWING = {"is_document": False, "doc_type": "other", "domain": "other", "kind": "other",
           "what_this_is": "This is a drawing of a person holding an orange paper.", "what_to_do": ["Upload a clear photo."],
           "unreadable": ["The paper has no text on it."]}
BLURRED = {"doc_type": "other", "domain": "other", "kind": "other", "what_this_is": "", "what_to_do": [],
           "by_when": [], "amounts": [], "unreadable": ["The image is too small and blurry to read any text."]}


def test_not_a_document_fails_with_clear_message(mocked):
    mocked["raw"] = DRAWING
    g = post(mocked, [("document", ("pic.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "failed" and g["error_code"] == "not_a_document"
    assert g["error"] == "This is not a photo of a paper. Try another."
    assert g["steps"] == []  # no guide made up from a picture
    assert len(mocked["calls"]) == 1  # no rewrite or translation call spent on it


def test_unreadable_photo_asks_for_a_clearer_one(mocked):
    mocked["raw"] = BLURRED
    g = post(mocked, [("document", ("tiny.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "failed" and g["error_code"] == "unreadable"
    assert "clearer photo" in g["error"]
    assert g["facts"]["unreadable"]


def test_partly_readable_paper_still_makes_a_guide():
    ex = doctypes.normalise({**BLURRED, "what_this_is": "A letter from the council.", "unreadable": ["the bottom line"]})
    assert pipeline.not_readable(ex) is None
    ex = doctypes.normalise({"doc_type": "how_to", "domain": "medicine", "medicine": "Salbutamol", "unreadable": ["dose"]})
    assert pipeline.not_readable(ex) is None


def test_bill_total_never_capped_away():
    # Live run: the rewriter listed every line item and cap() dropped the last 'what' step, which was the total.
    steps = [{"text_en": "This is your electricity bill.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "Pay online or by phone.", "kind": "how", "picture_prompt": "p"},
             {"text_en": "Call 0300 000 0001 if you cannot pay.", "kind": "how", "picture_prompt": "p"},
             {"text_en": "Fill in the Direct Debit form if you want.", "kind": "how", "picture_prompt": "p"},
             {"text_en": "Your previous balance is £0.00.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "Electricity used costs £51.94.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "The standing charge is £16.65.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "You must pay £72.02 in total.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "Pay by 27 November 2026.", "kind": "when", "picture_prompt": "p"},
             {"text_en": "A late fee of £10 may be added.", "kind": "warning", "picture_prompt": "p"}]
    out = doctypes.finish_steps(steps, "bill", "money", [])
    text = " ".join(s["text_en"] for s in out)
    assert "£72.02" in text and "27 November 2026" in text and "£10" in text
    assert len(out) <= postprocess.CAPS["bill"] + postprocess.EXTRA_FOR_FACTS


def test_cap_still_trims_steps_without_facts():
    steps = [{"text_en": f"Do thing {w}.", "kind": "how", "picture_prompt": "p"} for w in "abcdefghijkl"]
    assert len(postprocess.cap(steps, "letter", "school")) == postprocess.CAPS["letter"]


def test_dropped_trip_date_and_total_added_back():
    # Live run (Spanish school letter): the trip day and times never reached the steps.
    content = {"what_this_is": "A school trip letter.", "what_to_do": ["Sign the form."],
               "by_when": [{"date": "Monday 30 November", "what": "Pay at the office."},
                           {"date": "Friday 4 December 2026", "what": "Trip day. Leave at 9:15. Back at 15:30."}],
               "amounts": [{"what": "Trip price", "amount": "£8"}]}
    steps = [{"text_en": "This letter is about a school trip.", "kind": "what", "picture_prompt": "p"},
             {"text_en": "Pay £8 at the office by Monday 30 November.", "kind": "when", "picture_prompt": "p"}]
    out = doctypes.ensure_content_facts(steps, "letter", content)
    added = [s["text_en"] for s in out[2:]]
    assert added == ["By Friday 4 December 2026: Trip day. Leave at 9:15. Back at 15:30."]


def test_discharge_medicine_changes_kept():
    content = {"what_this_is": "A hospital letter.", "by_when": [], "amounts": [],
               "what_to_do": ["Stop aspirin 75mg.", "Start apixaban 5mg 2 times a day.", "Start bisoprolol 2.5mg in the morning.",
                              "Take ramipril 5mg, not 10mg.", "Take amoxicillin 500mg 3 times a day until 15 November."]}
    steps = [{"text_en": "Stop aspirin. Start the new medicines the letter lists.", "kind": "how", "picture_prompt": "p"}]
    out = doctypes.finish_steps(doctypes.ensure_content_facts(steps, "letter", content), "letter", "medicine", [])
    text = " ".join(s["text_en"] for s in out)
    for x in ("75mg", "apixaban 5mg", "bisoprolol 2.5mg", "ramipril 5mg", "amoxicillin 500mg"):
        assert x in text
    assert "999" in text  # health letter: the medicine safety line, not Citizens Advice


def test_health_letter_gets_999_line():
    assert "999" in doctypes.safety_lines("letter", "medicine")[0]
    assert "health paper" in pipeline.EXTRACT_SYSTEM and "GP or hospital letter" in pipeline.EXTRACT_SYSTEM


def test_summary_line_uses_digits():
    g = {"facts": {"dose": "ONE drop into BOTH eyes", "frequency": "FOUR times a day for 5 days"}}
    assert pipeline.summary_line_en(g) == "1 drop into both eyes, 4 times a day for 5 days"
    g = {"facts": {"dose": "TWO puffs", "frequency": "twice a day"}}
    assert pipeline.summary_line_en(g) == "2 puffs, 2 times a day"


def test_spacer_only_when_paper_says_always():
    assert "if you have one" in pipeline.EXTRACT_SYSTEM


def test_add_back_treats_date_and_time_spellings_as_the_same():
    from agent import doctypes
    steps = [{"kind": "when", "text_en": "Take your last dose of amoxicillin on 15 November 2026.", "picture_prompt": "x"},
             {"kind": "when", "text_en": "Arrive at 9:15 on Friday 4 December.", "picture_prompt": "x"}]
    content = {"what_this_is": "", "what_to_do": [], "amounts": [],
               "by_when": [{"date": "15/11/2026", "what": "Take your last dose of amoxicillin."},
                           {"date": "4 December", "what": "Arrive at 9.15am."}]}
    out = doctypes.ensure_content_facts(steps, "letter", content)
    assert len(out) == 2


def test_dateless_follow_up_is_kept_without_a_fake_date():
    from agent import doctypes
    steps = [{"kind": "how", "text_en": "Book a kidney blood test with your GP surgery.", "picture_prompt": "x"}]
    content = {"what_this_is": "", "what_to_do": [], "amounts": [],
               "by_when": [{"date": "Date to come by letter", "what": "Go to the cardiology clinic. The hospital will send you the date."}]}
    out = doctypes.ensure_content_facts(steps, "letter", content)
    assert [s["text_en"] for s in out[1:]] == ["Go to the cardiology clinic. The hospital will send you the date."]
