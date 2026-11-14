"""Deterministic Easy Read rubric (CONTRACTS section 6). Used for dataset filtering and the eval.

score() returns per-rule pass/fail plus a 0-1 total. Faithfulness is checked mechanically: every number
in the dose/frequency must appear in the steps, and no number may appear that is not in the facts.
"""
import re

KINDS = {"what", "when", "how", "warning", "get_help"}
JARGON = {"bronchodilator", "metered-dose", "prophylactic", "contraindicated", "administer", "inhalation",
          "topical", "subcutaneous", "dyspnoea", "dyspnea", "asthmatic", "analgesic", "adverse", "titrate",
          "prn", "bd", "tds", "qds", "od"}
PASSIVE = re.compile(r"\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b", re.I)
NUM_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
             "eight": "8", "nine": "9", "ten": "10"}
PIC_BAD = re.compile(r"\b(text|words?|letters?|label|sign saying|caption|numbers?|digits?)\b", re.I)


def _nums(s: str) -> set[str]:
    s = s.lower()
    out = set(re.findall(r"\d+", s))
    out |= {v for k, v in NUM_WORDS.items() if re.search(rf"\b{k}\b", s)}
    return out


def _sentences(t: str) -> list[str]:
    return [x for x in re.split(r"(?<=[.!?])\s+", t.strip()) if x]


def score(facts: dict, steps: list[dict]) -> dict:
    texts = [s.get("text_en", "") for s in steps]
    joined = " ".join(texts).lower()
    allowed = _nums(" ".join(str(facts.get(k) or "") for k in ("medicine", "dose", "frequency"))) \
        | _nums(" ".join(facts.get("warnings") or [] + (facts.get("get_help") or [])))
    allowed |= _nums(" ".join((facts.get("warnings") or []) + (facts.get("get_help") or [])))
    need = _nums(f"{facts.get('dose') or ''} {facts.get('frequency') or ''}")
    kinds = {s.get("kind") for s in steps}
    checks = {
        "step_count": 6 <= len(steps) <= 8,
        "valid_kinds": all(s.get("kind") in KINDS for s in steps),
        "max_15_words": all(len(sen.split()) <= 15 for t in texts for sen in _sentences(t)),
        "one_sentence": all(len(_sentences(t)) <= 2 for t in texts),
        "active_voice": not any(PASSIVE.search(t) for t in texts),
        "no_jargon": not any(w in joined for w in JARGON),
        "digits_not_words": not any(re.search(rf"\b{w}\b", joined) for w in NUM_WORDS),
        "dose_faithful": need <= _nums(joined),
        "no_invented_numbers": _nums(" ".join(s.get("text_en", "") for s in steps if s.get("kind") != "how")) <= allowed | {"1", "999", "111"},
        "warning_included": (not facts.get("warnings")) or "warning" in kinds,
        "get_help_included": (not facts.get("get_help")) or "get_help" in kinds,
        "picture_prompts": all(len(s.get("picture_prompt", "").split()) >= 3
                               and not PIC_BAD.search(s.get("picture_prompt", "")) for s in steps),
    }
    return {"checks": checks, "score": sum(checks.values()) / len(checks), "passed": all(checks.values())}
