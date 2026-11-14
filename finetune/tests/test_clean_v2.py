import json
from finetune.clean_v2 import rewrite_text, ukify, valid, clean


def test_verb_first_rewrites():
    assert rewrite_text("You bring your list.") == "Bring your list."
    assert rewrite_text("You need to call the office.") == "Call the office."
    assert rewrite_text("You must sign here.") == "Sign here."
    assert rewrite_text("You do not skip doses.") == "Do not skip doses."
    # unsafe cases stay as they are
    assert rewrite_text("You can call us.") == "You can call us."
    assert rewrite_text("You paid already.") == "You paid already."
    assert rewrite_text("You also sign.") == "You also sign."


def test_ukify_consistent():
    p, c, k = ukify('{"amount": "$15.00", "phone": "555-0188", "d": "November 20, 2023"}',
                    "You pay fifteen dollars. Call 555-0188. Pay by November 20, 2023.")
    assert "£15.00" in p and "£15" in c and "0300 000 0188" in p + c and "20 November 2026" in p
    assert k == {"money", "phone", "date"}
    assert ukify('{"a": "$15"}', "You pay 20 dollars.") is None


def test_valid_and_clean():
    bad = [{"text_en": "Call the office twice.", "kind": "how", "picture_prompt": "A phone with text."}]
    assert not valid(bad)
    steps = [{"text_en": "You take 2 tablets.", "kind": "how", "picture_prompt": "Two white tablets in a hand."}] * 3
    out, st = clean([{"prompt": "p", "completion": json.dumps(steps)}], min_rows=1)
    assert json.loads(out[0]["completion"])[0]["text_en"] == "Take 2 tablets."
