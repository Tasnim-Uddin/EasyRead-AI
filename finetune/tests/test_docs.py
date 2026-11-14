import json
from finetune.rubric import score_doc
from finetune.seeds import DOC_SEEDS
from finetune.prompt import user_message

LETTER = DOC_SEEDS[0]
GOOD = [
    {"text_en": "This is a letter from your council about unpaid council tax.", "kind": "what", "picture_prompt": "a council letter on a table"},
    {"text_en": "Pay the amount you owe.", "kind": "how", "picture_prompt": "a person paying by phone"},
    {"text_en": "Call the council if you cannot pay.", "kind": "how", "picture_prompt": "a person on the phone"},
    {"text_en": "Pay by Friday 12 December.", "kind": "when", "picture_prompt": "a calendar page with a ring round a day"},
    {"text_en": "You owe £212.", "kind": "what", "picture_prompt": "coins and notes in a hand"},
    {"text_en": "Get free advice before you sign or pay.", "kind": "get_help", "picture_prompt": "two people talking at a desk"},
]


def test_good_letter_passes():
    r = score_doc("letter", LETTER["content"], GOOD)
    assert r["passed"], {k: v for k, v in r["checks"].items() if not v}


def test_wrong_amount_and_ai_voice_fail():
    bad = [dict(s) for s in GOOD]
    bad[4]["text_en"] = "You owe £120. Don't worry, it is easy!"
    r = score_doc("letter", LETTER["content"], bad)
    assert not r["checks"]["dates_amounts_faithful"] and not r["checks"]["plain_voice"]


def test_missing_safety_step_fails():
    r = score_doc("letter", LETTER["content"], GOOD[:-1])
    assert not r["checks"]["safety_step"]


def test_doc_prompt_carries_content():
    assert "unpaid council tax" in user_message(LETTER["facts"], "letter", LETTER["content"])
