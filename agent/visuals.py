"""Pick an animated close-up (web/src/closeups/) for a guide step, or None.

Deterministic English keyword matching on the step's text_en plus the guide's doc_type, domain and device type.
Conservative on purpose: a wrong close-up is worse than none, so anything unclear returns None.
- Only action steps (how/when; get_help only for "call" / "go online") get a close-up.
- Conditions ("if you cannot pay") and negated clauses ("do not shake") are ignored.
- Medicine technique close-ups (inhaler, spacer, eye drops, cream) only for a checked technique line
  (step["technique"]) or clear label words in the step, with the device known from the guide or the step.
  The picture never adds a medical step: it only illustrates the words already in the step.
"""
import json
import pathlib
import re

IDS_FILE = pathlib.Path(__file__).resolve().parents[1] / "web" / "src" / "closeups" / "ids.json"
CLOSEUP_IDS: list[str] = json.loads(IDS_FILE.read_text())

ACTION_KINDS = {"how", "when"}
HELP_OK = {"phone_call", "go_online"}  # a get_help step that says "call" or "go online" may show these

NEG = re.compile(r"\b(?:not|never|don't|dont|do not|cannot|can't|no more|more than|at most|maximum|unless|without|avoid|stop)\b", re.I)
COND = re.compile(r"^(?:if|unless|when|in case|only if)\b", re.I)
DATE = re.compile(r"\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"
                  r"|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b"
                  r"|\d{1,2}/\d{1,2}(?:/\d{2,4})?"
                  r"|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))", re.I)


def _clauses(text: str) -> list[str]:
    """Action clauses of a step: split on sentence ends, ';', ',' and before if/unless; drop conditions and
    negated clauses."""
    parts = re.split(r"[.!?;:]\s+|[.!?]$|,\s*|\s+(?=(?:if|unless)\b)|\s+-\s+", text.strip())
    return [p.strip() for p in parts if p and p.strip() and not COND.match(p.strip()) and not NEG.search(p)]


def _any(rx: str, clauses: list[str]) -> bool:
    r = re.compile(rx, re.I)
    return any(r.search(c) for c in clauses)


def _device(guide: dict) -> str:
    facts = guide.get("facts") or {}
    return str(facts.get("device_type") or "").lower()


def _guide_words(guide: dict) -> str:
    """Lower-case text of the guide's facts and content, for context such as how a bill can be paid."""
    try:
        return json.dumps([guide.get("facts") or {}, guide.get("content") or {}], ensure_ascii=False).lower()
    except (TypeError, ValueError):
        return ""


def _medicine(step: dict, guide: dict, cl: list[str]) -> str | None:
    dev = _device(guide)
    text = (step.get("text_en") or "").lower()
    inhaler = dev.startswith("inhaler") or "inhaler" in text
    spacer = dev == "inhaler_mdi_spacer" or "spacer" in text
    dry = dev == "inhaler_dry_powder" or re.search(r"dry[- ]powder|accuhaler|turbohaler|ellipta", text)
    checked = bool(step.get("technique"))

    if inhaler or checked and dev.startswith("inhaler"):
        if _any(r"\bshake\b", cl) and not dry:
            return "inhaler_shake"
        if _any(r"\bhold (?:your|the) breath\b", cl):
            return "inhaler_hold_breath"
        if spacer and _any(r"\bspacer\b", cl) and not _any(r"\bpress\b", cl):
            return "spacer_use"
        if _any(r"\bpress\b", cl) and _any(r"\bbreathe in\b|\binhale\b", cl) or _any(r"\bpress (?:the |your )?(?:inhaler|canister|top)\b|\bpress once\b", cl):
            return "spacer_use" if spacer else ("inhaler_press_breathe_in" if not dry else None)
        if _any(r"\bbreathe out\b|\bexhale\b", cl):
            return "inhaler_breathe_out"
        if _any(r"\bwait\b", cl):
            return "inhaler_wait"
        if _any(r"\b(?:put|place|fit|push|replace|clip) (?:the |its )?(?:cap|cover|lid) (?:back )?on\b|\bcap back on\b"
                r"|\bclose (?:your |the )?inhaler\b", cl):
            return "inhaler_cap_on"
        if _any(r"\b(?:take|pull|remove) (?:the |its )?(?:cap|cover|lid)(?: off)?\b|\bcap off\b", cl):
            return "inhaler_cap_off"
    if _any(r"\brinse (?:out )?your mouth\b|\brinse your mouth\b|\bgargle\b", cl):
        return "rinse_mouth"
    if (dev == "eye_drops" or "eye" in text) and _any(r"\bdrops?\b", cl) and _any(r"\b(?:put|squeeze|use|place|apply|drop|\d+)\b", cl):
        return "eye_drops"
    if _any(r"\b(?:cream|ointment|gel|lotion)\b", cl) and _any(r"\b(?:apply|rub|spread|smooth|put|squeeze|use)\b", cl) \
            or dev == "cream_ointment" and checked and _any(r"\b(?:rub|spread|smooth|squeeze)\b", cl):
        return "cream_apply"
    if _any(r"\b(?:tablets?|capsules?|pills?)\b", cl) and _any(r"\b(?:take|swallow)\b", cl):
        return "tablet_with_water"
    if _any(r"\b\d+(?:\.\d+)?\s?ml\b|\bspoon(?:ful)?s?\b|\bmeasuring (?:cup|spoon|syringe)\b|\boral syringe\b", cl) \
            and _any(r"\b(?:take|give|measure|use|swallow)\b", cl) and not _big_volume(cl) \
            and not _any(r"\b(?:tube|feed|feeding|flush(?:es)?|drip|pump)\b", cl):
        return "liquid_measure_spoon"  # a spoon dose; never a 1000 ml tube feed or a water flush
    return None


SPOON_MAX_ML = 30


def _big_volume(cl: list[str]) -> bool:
    return any(float(v) > SPOON_MAX_ML for c in cl for v in re.findall(r"\b(\d+(?:\.\d+)?)\s?ml\b", c, re.I))


def _paper(step: dict, guide: dict, cl: list[str]) -> str | None:
    kind = step.get("kind")
    doc_type = guide.get("doc_type")
    dated = any(DATE.search(c) for c in cl)
    if kind == "when" and dated:
        return "calendar_date"
    if _any(r"\bsign\b(?! (?:up|in|into|on to|language|of))|\bsignature\b", cl):
        return "sign_here"
    if _any(r"\btick\b|\b(?:put a )?cross in (?:the|a) box\b|\bmark (?:the|a|one) box\b|\bcheck (?:the|a|one) box\b", cl):
        return "tick_box"
    # "pay" the verb (not "how to pay", not a name such as "Payment Helpline" or "payment reference").
    if _any(r"(?<!how to )(?<!ways to )(?<!where to )\bpay\b|\b(?:make|send|set up) (?:a |the |your )?payments?\b", cl):
        if _any(r"\bbank transfer\b|\bdirect debit\b|\bstanding order\b|\bsort code\b|\baccount number\b|\bat your bank\b", cl):
            return "pay_bank"
        if _any(r"\bby post\b|\bcheque\b|\bpostal order\b", cl):
            return "post_letter"  # paying by post is not a card payment
        return "pay_card"
    if doc_type == "form" and _any(r"\bwrite\b|\bfill (?:in|out)\b|\bthe box\b", cl):
        return "write_in_box"  # "Find the box called Telephone No. Write your number." is writing, not a call
    if _any(r"\b(?:call|phone|ring|telephone)\b(?! (?:number|numbers|no\b|bill))", cl):
        return "phone_call"
    if _any(r"\bonline\b|\bwebsite\b|\bwww\.|\.gov\.uk\b|\.nhs\.uk\b|\blog ?in\b|\bsign in\b|\binternet\b|\bon the app\b", step_clauses_raw(step)):
        return "go_online"
    if _any(r"\bwrite\b(?! to\b)|\bfill (?:in|out)\b|\bcomplete (?:the|this|your|each) (?:form|box|boxes|section|page)\b"
            r"|\bprint your name\b|\bin capital letters\b", cl) \
            or (doc_type == "form" and kind == "how" and (_any(r"\b(?:write|fill|put|enter|add)\b", cl)
                                                          or re.match(r"^[^:.]{1,40}:\s*\S", step.get("text_en") or ""))):
        return "write_in_box"
    if _any(r"\bpost\b(?!code)|\bpostbox\b|\bpost box\b|\benvelope\b|\bfreepost\b|\bsend (?:it|this|the \w+) back\b", cl):
        return "post_letter"
    if _any(r"\b(?:bring|show|take)\b.*\b(?:id|passport|letter|document|documents|proof|licence|license|payslips?|"
            r"statements?|paperwork|appointment card|this form|the form|birth certificate)\b", cl):
        return "bring_document"
    if _any(r"\bkeep (?:this|the|these|your|it|a copy)\b.*\b(?:safe|copy|letter|papers?|document|form|receipt)\b|\bkeep a copy\b", cl):
        return "keep_safe"
    if _any(r"\b(?:screws?|screwdriver|bolts?|allen key|hex key|tighten)\b", cl):
        return "screwdriver_turn"
    if _any(r"\bplug (?:it |the \w+ )?in\b|\bplug (?:it )?into\b|\b(?:wall |power )?socket\b", cl):
        return "plug_in"
    if dated and _any(r"\b(?:appointment|by|on|before|deadline|date)\b", cl):
        return "calendar_date"
    if _any(r"\bwait\b", cl):
        return "clock_wait"
    return None


def step_clauses_raw(step: dict) -> list[str]:
    """Clauses that are not negated (conditions kept): 'If you can, go online' still means go online."""
    text = step.get("text_en") or ""
    return [p for p in re.split(r"[.!?;]\s+|[.!?]$", text.strip()) if p.strip() and not NEG.search(p)]


def choose_closeup(step: dict, guide: dict) -> str | None:
    """The close-up id (one of CLOSEUP_IDS) for this step, or None when no close-up clearly fits."""
    kind = step.get("kind")
    text = step.get("text_en") or ""
    if not text.strip() or kind not in ACTION_KINDS | {"get_help"}:
        return None
    cl = _clauses(text)
    if not cl:
        return None
    pick = None
    if guide.get("domain") == "medicine" or _device(guide) not in ("", "unknown", "none") or step.get("technique"):
        pick = _medicine(step, guide, cl)
    if pick is None:
        # The step's first action leads ("Phone the helpline ... to agree how to pay" is a phone call).
        pick = _paper(step, guide, cl[:1]) or _paper(step, guide, cl)
    if kind == "get_help" and pick not in HELP_OK:
        return None
    return pick if pick in CLOSEUP_IDS else None


def visual_for(step: dict, guide: dict) -> dict | None:
    cid = choose_closeup(step, guide)
    return {"kind": "closeup", "id": cid} if cid else None


def attach_visuals(steps: list[dict], guide: dict) -> list[dict]:
    """Every step gets `visual`: {kind: "closeup", id} or None."""
    return [{**s, "visual": visual_for(s, guide)} for s in steps]
