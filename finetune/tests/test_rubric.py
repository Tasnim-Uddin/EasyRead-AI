import json
from finetune.rubric import score
from finetune.seeds import SEEDS

FIX = json.load(open("demo/fixtures/guide_inhaler.json"))


def test_fixture_passes_rubric():
    r = score(FIX["facts"], FIX["steps"])
    assert r["passed"], {k: v for k, v in r["checks"].items() if not v}


def test_invented_dose_fails():
    steps = [dict(s) for s in FIX["steps"]]
    steps[5]["text_en"] = "Wait about 30 seconds."
    steps[6]["text_en"] = "Take 5 puffs. Do not take more than 4 times a day."
    r = score(FIX["facts"], steps)
    assert not r["checks"]["dose_faithful"] and not r["checks"]["no_invented_numbers"]


def test_missing_get_help_and_long_sentence_fail():
    steps = [dict(s) for s in FIX["steps"] if s["kind"] != "get_help"]
    steps[0]["text_en"] = "This is your blue inhaler and it helps you to breathe much more easily when you feel unwell."
    r = score(FIX["facts"], steps)
    assert not r["checks"]["get_help_included"] and not r["checks"]["max_15_words"]


def test_seeds_wellformed():
    assert len(SEEDS) >= 10 and all(s["medicine"] and s["dose"] for s in SEEDS)
