"""Pick an animated close-up (web/src/closeups/) for a guide step, or None.

Deterministic English keyword matching on the step's text_en plus the guide's doc_type, domain and device type.
Everyday papers (letters, bills, forms, appointments, benefits, fines, how-to) get a close-up for most steps: the
action the step asks for (pay, call, sign, go online, bring ID ...), else what the step is about (the letter itself,
an amount, a date or deadline, a warning). Medicine stays strict:
- Conditions ("if you cannot pay") and negated clauses ("do not shake") are ignored.
- Medicine technique close-ups (inhaler, spacer, eye drops, cream) only for a checked technique line
  (step["technique"]) or clear label words in the step, with the device known from the guide or the step.
  The picture never adds a medical step: it only illustrates the words already in the step.
- On a medicine paper, a step that is not a technique match may only get a non-physical close-up (a phone call,
  a website, asking someone, a date, the letter, an amount, a calm warning sign), never a hands-on one.
"""
import json
import pathlib
import re

IDS_FILE = pathlib.Path(__file__).resolve().parents[1] / "web" / "src" / "closeups" / "ids.json"
CLOSEUP_IDS: list[str] = json.loads(IDS_FILE.read_text())

ACTION_KINDS = {"how", "when"}
# A get_help step shows only ways to reach someone.
HELP_OK = {"phone_call", "go_online", "online_form", "email_send", "ask_help", "building_visit", "appointment_go"}
# A warning step keeps a clear action it names (sign, call, a date ...); otherwise it shows the calm attention sign.
WARNING_OK = {"sign_here", "phone_call", "go_online", "ask_help", "calendar_date", "deadline_clock", "check_amount"}
# On a medicine paper, close-ups that are not technique: none of them shows a hand doing something to the body.
MEDICINE_SAFE = {"phone_call", "go_online", "online_form", "email_send", "ask_help", "calendar_date", "deadline_clock",
                 "clock_wait", "letter_open", "read_letter", "check_amount", "warning_attention", "appointment_go",
                 "building_visit", "letter_arrive", "bring_document", "bring_id", "id_number_find", "post_letter",
                 "write_in_box", "sign_here", "tick_box", "pay_card", "pay_bank", "keep_safe", "decide"}

NEG = re.compile(r"\b(?:not|never|don't|dont|do not|cannot|can't|no more|more than|at most|maximum|unless|without|avoid|stop)\b", re.I)
COND = re.compile(r"^(?:if|unless|when|in case|only if)\b", re.I)
DATE = re.compile(r"\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"
                  r"|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b"
                  r"|\d{1,2}/\d{1,2}(?:/\d{2,4})?"
                  r"|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))", re.I)


# "A tariff is the price plan you pay for your gas." explains a word; it is not an action to picture.
DEFINITION = re.compile(r"^(?:an?|the|this|that|it)?\s*[\w-]+(?:\s[\w-]+)?\s+(?:is|are|means)\s+(?:an?|the|when|how|what|money|checked)\b", re.I)


def _clauses(text: str) -> list[str]:
    """Action clauses of a step: split on sentence ends, ';', ',' and before if/unless; drop conditions and
    negated clauses."""
    parts = re.split(r"[.!?;:]\s+|[.!?]$|,\s*|\s+(?=(?:if|unless)\b)|\s+-\s+", text.strip())
    return [p.strip() for p in parts if p and p.strip() and not COND.match(p.strip()) and not NEG.search(p)
            and not DEFINITION.match(p.strip())]


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


MONEY = (r"£|\bamounts?\b|\bbalance\b|\btotal\b|\bowe\b|\bcharges?\b|\bcosts?\b|\bprice\b|\bfees?\b|\bfine\b|\bpenalty\b"
         r"|\bcredit\b|\bdebit\b|\brefund\b|\brent\b|\bbill\b|\bovercharged?\b|\barrears\b|\bdebt\b")
DEADLINE = (r"\bwithin \d+ (?:days?|weeks?|months?)\b|\bdeadline\b|\b(?:before|by) the date\b|\bas soon as (?:you can|possible)\b"
            r"|\bin time\b|\btime limit\b|\bstraight away\b|\bright away\b|\bimmediately\b|\bdue\b|\blast day\b|\bdays? (?:of|from)\b")
MONEY_IN = r"\binto your (?:bank |building society )?account\b|\brefund\b|\bwe will pay you\b|\bpaid to you\b"
PAPER_WORDS = (r"\b(?:letter|notice|bill|reminder|form|leaflet|paper|statement|invoice|ticket|summons|demand|application|"
               r"booklet|guide|instructions|document|certificate|card|message)\b")


def _paper(step: dict, guide: dict, cl: list[str]) -> str | None:
    """The close-up for the action in these clauses, or None."""
    kind = step.get("kind")
    doc_type = guide.get("doc_type")
    dated = any(DATE.search(c) for c in cl)
    if kind == "when" and dated:
        return "calendar_date"
    if _any(r"\bsign\b(?! (?:up|in|into|on to|language|of))|\bsignature\b|\b(?:box|line) (?:called|marked|that says) signed\b", cl):
        return "sign_here"
    if _any(r"\btick\b|\b(?:put a )?cross in (?:the|a) box\b|\bmark (?:the|a|one) box\b|\bcheck (?:the|a|one) box\b", cl):
        return "tick_box"
    # Paying in parts: "Pay each instalment", "spread your payments", "monthly payments".
    if _any(r"\beach instalment\b|\binstalments\b|\bspread\b.*\b(?:re)?payments?\b|\bpayment plan\b|\bin (?:equal )?parts\b"
            r"|\bmonthly (?:direct debit )?(?:re)?payments?\b|\bpay (?:it )?(?:each|every) (?:week|month)\b", cl) \
            and not _any(r"\bset up\b", cl):
        return "instalments"
    # Money coming to you: "We will pay £20 into your bank account", "you will get a refund".
    if _any(MONEY_IN, cl):
        return "bank_transfer"
    # "pay" the verb (not "how to pay", not a name such as "Payment Helpline" or "payment reference").
    if _any(r"(?<!how to )(?<!ways to )(?<!where to )\bpay\b|\b(?:make|send|set up) (?:a |the |your )?payments?\b", cl):
        if _any(r"\bbank transfer\b|\bdirect debit\b|\bstanding order\b|\bsort code\b|\baccount number\b|\bat your bank\b", cl):
            return "pay_bank"
        if _any(r"\bby post\b|\bcheque\b|\bpostal order\b", cl):
            return "post_letter"  # paying by post is not a card payment
        return "pay_card"
    if doc_type == "form" and _any(r"\bwrite\b|\bfill (?:in|out)\b|\bthe box\b", cl):
        return "write_in_box"  # "Find the box called Telephone No. Write your number." is writing, not a call
    # "Have your reference ready when you phone" is getting papers ready, not the call itself.
    if _any(r"(?<!when you )(?<!before you )(?<!if you )\b(?:call|phone|ring|telephone)\b(?! (?:number|numbers|no\b|bill))", cl):
        return "phone_call"
    if _any(r"\bemail (?:us|them|it|the|your|a|this)\b|\bby e-?mail\b|\bsend (?:an |us an |them an )?e-?mail\b|\be-mail (?:us|them)\b", cl):
        return "email_send"
    raw = step_clauses_raw(step)
    if _any(r"\bonline\b|\bwebsite\b|\bwww\.|\.gov\.uk\b|\.nhs\.uk\b|\blog ?in\b|\bsign in\b|\binternet\b|\bon the app\b", raw):
        if _any(r"\bfill (?:in|out)\b|\bform\b|\bapply\b|\bclaim\b|\bregister\b|\bapplication\b|\bbook\b|\bappeal\b|\bchallenge\b", raw):
            return "online_form"
        return "go_online"
    if _any(r"\bwrite\b(?! to\b)|\bfill (?:in|out)\b|\bcomplete (?:the|this|your|each) (?:form|box|boxes|section|page)\b"
            r"|\bprint your name\b|\bin capital letters\b", cl) \
            or (doc_type == "form" and kind == "how" and (_any(r"\b(?:write|fill|put|enter|add)\b", cl)
                                                          or re.match(r"^[^:.]{1,40}:\s*\S", step.get("text_en") or ""))):
        return "write_in_box"
    if _any(r"\bpost\b(?!code)|\bpostbox\b|\bpost box\b|\benvelope\b|\bfreepost\b|\bsend (?:it|this|the \w+) back\b", cl):
        return "post_letter"
    if _any(r"\b(?:visit|go to|go into|call in at|drop in at|come to|come into|go in to)\b(?: \w+){0,2} (?:office|branch|post office|"
            r"bank|council|jobcentre|job centre|library|town hall|reception|desk|counter|centre|center|pharmacy|shop|store|school)\b", cl):
        return "building_visit"
    bring = r"\b(?:bring|show|take|have)\b.*"
    if _any(bring + r"\b(?:photo id|id card|ids?|proof of (?:identity|id)|identification|passport|driving licen[cs]e)\b", cl) \
            and not _any(r"\b(?:letter|form|document|documents|paperwork|payslips?|statements?|certificate)\b", cl):
        return "bring_id"
    if _any(r"\b(?:bring|show|take)\b.*\b(?:id|passport|letter|document|documents|proof|licence|license|payslips?|"
            r"statements?|paperwork|appointment card|this form|the form|birth certificate)\b", cl):
        return "bring_document"
    if _any(r"\b(?:national insurance|ni|nhs|reference|account|customer|policy|case|claim|pcn|penalty charge notice|"
            r"vehicle registration|registration|tax|unique taxpayer|ut|membership|order|booking) (?:number|no|code)\b"
            r"|\bpayment reference\b|\bhave (?:your|the|this)\b.*\bready\b", cl):
        return "id_number_find"
    if _any(r"\bkeep (?:this|the|these|your|it|a copy)\b.*\b(?:safe|copy|letter|papers?|document|form|receipt)\b|\bkeep a copy\b", cl):
        return "keep_safe"
    if _any(r"\b(?:check|count|lay out|unpack|find|sort)\b.*\b(?:parts?|pieces|fittings|components)\b", cl):
        return "parts_check"
    if _any(r"\b(?:screws?|screwdriver|bolts?|allen key|hex key|tighten)\b", cl):
        return "screwdriver_turn"
    if _any(r"\bplug (?:it |the \w+ )?in\b|\bplug (?:it )?into\b|\b(?:wall |power )?socket\b", cl):
        return "plug_in"
    if _any(r"\bmeter readings?\b|\bread (?:your|the) meter\b|\bsmart meter\b", cl):
        return "meter_reading"
    if _any(r"\b(?:decide|choose|pick one|think about|compare|whether you want|switch(?:ing)? to|weigh up)\b", cl):
        return "decide"
    if dated and _any(r"\b(?:appointment|by|on|before|deadline|date)\b", cl):
        return "calendar_date"
    if _any(r"\b(?:go|come|get|travel|turn up|arrive)\b(?: \w+){0,2} (?:to|at|for) (?:your |the |our |this |a )?"
            r"(?:appointment|clinic|hospital|surgery|meeting|hearing|interview|assessment|session|exam|court|tribunal|scan)\b"
            r"|\battend (?:your|the|this|a|an)\b|\bin person\b|\bdirections\b|\bhow to get there\b", cl):
        return "appointment_go"
    if _any(r"\b(?:we|they|the \w+) will (?:write|send you a letter|send (?:you )?(?:a|another) letter)\b|\bwait for (?:a|our|the|another|their) letter\b"
            r"|\byou will (?:get|receive) (?:a|another|our) letter\b|\blook out for (?:a|our|their) letter\b", cl):
        return "letter_arrive"
    if _any(r"\b(?:ask|talk|speak|tell|contact|discuss|check with|get in touch|let (?:us|them|the \w+) know)\b"
            r"|\bget (?:free |some )?(?:advice|help|support)\b", cl):
        return "ask_help"
    if _any(r"\b(?:find|check|look for|note|write down|remember|put) (?:the|this|that|your) (?:date|day|time)\b", cl):
        return "calendar_date"
    if _any(r"\b(?:check|look at|see|note|find|look for)\b.*(?:" + MONEY + ")", cl):
        return "check_amount"
    if _any(r"^(?:read|look (?:at|for|through)|go through|find)\b|\bread (?:the|this|your|all|section|page|it|both|every|each|more)\b", cl):
        return "read_letter"
    if _any(DEADLINE, cl):
        return "deadline_clock"
    if _any(r"\bwait\b", cl):
        return "clock_wait"
    return None


def step_clauses_raw(step: dict) -> list[str]:
    """Clauses that are not negated (conditions kept): 'If you can, go online' still means go online."""
    text = step.get("text_en") or ""
    return [p for p in re.split(r"[.!?;]\s+|[.!?]$", text.strip()) if p.strip() and not NEG.search(p)]


def _intro(step: dict, pos: int | None) -> str | None:
    """'This letter is from the council ...' / 'Read this reminder from ...': the paper itself."""
    text = (step.get("text_en") or "").strip()
    first = re.split(r"(?<=[.!?])\s+", text)[0]
    if re.match(r"^(?:this|it|here) (?:is |was )?(?:a |an |the |your |sample |example )*(?:\w+'s |\w+ ){0,4}?" + PAPER_WORDS, first, re.I) \
            or re.match(r"^(?:this|the) (?:\w+ ){0,3}" + PAPER_WORDS + r" (?:is from|from|says|tells|explains|is about|asks|reminds|shows)", first, re.I) \
            or re.match(r"^(?:read|open) (?:this|the|your) (?:\w+ ){0,3}" + PAPER_WORDS, first, re.I) \
            or re.search(r"\b(?:wrote|sent) (?:you )?this " + PAPER_WORDS, first, re.I):
        return "letter_open" if pos in (None, 0) or step.get("kind") == "what" else "read_letter"
    return None


def _topic(step: dict, cl: list[str]) -> str | None:
    """What a step is about when it names no action: an amount, a date or deadline, a warning."""
    text = step.get("text_en") or ""
    if _any(MONEY_IN, cl):
        return "bank_transfer"
    if _any(MONEY, cl or [text]):
        return "check_amount"
    if any(DATE.search(c) for c in cl) or _any(r"\b(?:date|deadline|due)\b", cl):
        return "calendar_date"
    if _any(DEADLINE, cl):
        return "deadline_clock"
    if step.get("kind") == "warning":
        return "warning_attention"
    return None


def choose_closeup(step: dict, guide: dict, pos: int | None = None) -> str | None:
    """The close-up id (one of CLOSEUP_IDS) for this step, or None when no close-up clearly fits.
    `pos` is the step's place in the guide (the first step may be the paper's introduction)."""
    kind = step.get("kind")
    text = step.get("text_en") or ""
    if not text.strip():
        return None
    if pos is None and isinstance(step.get("index"), int):
        pos = step["index"]
    medicine = guide.get("domain") == "medicine" or _device(guide) not in ("", "unknown", "none") or bool(step.get("technique"))
    cl = _clauses(text)
    pick = None
    if medicine and cl and (kind in ACTION_KINDS or kind == "what" and re.match(r"^(?:take|swallow|use|apply|put)\b", text.strip(), re.I)):
        pick = _medicine(step, guide, cl)
        if pick is None and step.get("technique"):
            return None  # a checked technique line with no matching picture stays without one
    if pick is None and kind == "what":
        pick = _intro(step, pos) or _topic(step, cl)
    if pick is None and cl:
        # The step's first action leads ("Phone the helpline ... to agree how to pay" is a phone call).
        # On a form the box's instruction leads ("Find the line ... Write your child's name" is writing).
        first = cl if guide.get("doc_type") == "form" else cl[:1]
        pick = _paper(step, guide, first) or _paper(step, guide, cl)
        if kind == "warning" and pick not in WARNING_OK:
            pick = None
        if kind == "get_help" and pick not in HELP_OK:
            pick = "ask_help" if _any(r"\b(?:ask|talk|speak|tell|contact|advice|help|support|see)\b", cl) else None
    if pick is None and kind == "warning":
        pick = "warning_attention"  # a warning about money or a date is still a warning first
    if pick is None and kind in ("how", "when") and not (medicine and kind == "when"):
        pick = (_intro(step, pos) if kind == "how" else None) or _topic(step, cl)
    if pick and medicine and pick not in MEDICINE_SAFE and not _is_medicine_id(pick):
        return None
    return pick if pick in CLOSEUP_IDS else None


MEDICINE_IDS = {"inhaler_cap_off", "inhaler_shake", "inhaler_breathe_out", "inhaler_press_breathe_in", "inhaler_hold_breath",
                "inhaler_wait", "inhaler_cap_on", "spacer_use", "tablet_with_water", "eye_drops", "liquid_measure_spoon",
                "cream_apply", "rinse_mouth"}


def _is_medicine_id(cid: str) -> bool:
    return cid in MEDICINE_IDS


def visual_for(step: dict, guide: dict, pos: int | None = None) -> dict | None:
    cid = choose_closeup(step, guide, pos)
    return {"kind": "closeup", "id": cid} if cid else None


def attach_visuals(steps: list[dict], guide: dict) -> list[dict]:
    """Every step gets `visual`: {kind: "closeup", id} or None."""
    return [{**s, "visual": visual_for(s, guide, i)} for i, s in enumerate(steps)]
