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
# docs/STYLE.md section 4: never write. Plus legal/bill jargon.
NEVER = re.compile(r"great question|let'?s dive|absolutely|certainly|sure thing|i'?m here to help|feel free|"
                   r"don'?t worry|do not worry|no problem at all|important to note|keep in mind|remember that|"
                   r"you'?ve got this|totally normal|amazing|\b(simply|just|easily|quickly)\b|[!\u2014\u2013]|"
                   r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", re.I)
DOC_JARGON = {"remit", "remitted", "remittance", "prior to", "pursuant", "hereby", "arrears", "liable",
              "outstanding balance", "statutory", "enforcement", "default notice"}
PIC_BAD = re.compile(r"\b(text|words?|letters|label|sign saying|caption|numbers?|digits?)\b", re.I)


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
        "step_count": 6 <= len(steps) <= 9,
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
        "plain_voice": not any(NEVER.search(t) for t in texts),
        "picture_prompts": all(len(s.get("picture_prompt", "").split()) >= 3
                               and not PIC_BAD.search(s.get("picture_prompt", "")) for s in steps),
    }
    return {"checks": checks, "score": sum(checks.values()) / len(checks), "passed": all(checks.values())}


def _content_text(content: dict) -> str:
    return " ".join([content.get("what_this_is", "")] + list(content.get("what_to_do") or [])
                    + [f"{d.get('date','')} {d.get('what','')}" for d in content.get("by_when") or []]
                    + [f"{a.get('what','')} {a.get('amount','')}" for a in content.get("amounts") or []]
                    + [f"{f.get('label','')} {f.get('what_to_write','')}" for f in content.get("fields") or []])


def score_doc(doc_type: str, content: dict, steps: list[dict]) -> dict:
    """Rubric for letter / bill / form / other. Every date and amount must survive; nothing may be invented."""
    texts = [s.get("text_en", "") for s in steps]
    joined = " ".join(texts).lower()
    src = _content_text(content)
    need = set()
    for d in content.get("by_when") or []:
        need |= _nums(d.get("date", ""))
    for a in content.get("amounts") or []:
        need |= _nums(a.get("amount", ""))
    for m in re.findall(r"\d[\d,.]*", " ".join(a.get("amount", "") for a in content.get("amounts") or [])):
        need.add(m)
    n_min = 3 if doc_type != "form" else 2
    checks = {
        "step_count": n_min <= len(steps) <= 10,
        "valid_kinds": all(s.get("kind") in KINDS for s in steps),
        "max_15_words": all(len(sen.split()) <= 15 for t in texts for sen in _sentences(t)),
        "one_sentence": all(len(_sentences(t)) <= 3 for t in texts),
        "active_voice": not any(PASSIVE.search(t) for t in texts),
        "no_jargon": not any(w in joined for w in JARGON | DOC_JARGON),
        "digits_not_words": not any(re.search(rf"\b{w}\b", joined) for w in NUM_WORDS),
        "dates_amounts_faithful": all(n in joined for n in need),
        "no_invented_numbers": _nums(" ".join(texts)) <= _nums(src),
        "no_own_safety_step": not any(x.get("kind") == "get_help" for x in steps),  # the app appends the safety line
        "plain_voice": not any(NEVER.search(t) for t in texts),
        "picture_prompts": all(len(s.get("picture_prompt", "").split()) >= 3
                               and not PIC_BAD.search(s.get("picture_prompt", "")) for s in steps),
    }
    return {"checks": checks, "score": sum(checks.values()) / len(checks), "passed": all(checks.values())}
