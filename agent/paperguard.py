"""Guards on the written steps, so a guide says what the paper says and nothing more.

- No app-added advice or people: a sentence that tells the reader to ask, call or see a pharmacist, doctor, nurse,
  999/111 or "someone for help" is removed unless the paper's own instructions name that person or service.
- No "the paper does not say X" lines for things a normal paper would not say anyway (only kept for key fields
  such as the dose, how often, a date, a time or an amount).
- No computed doses: a "take/give/measure N unit" sentence whose amount is not printed on the paper is removed
  (the app never turns 125mg into 5ml or a number of spoons).
- Paper facts the writer dropped (how long to take it, how much was supplied, dates printed on the paper) are
  added back as plain steps.

All pure functions over [{text_en, kind, picture_prompt}]; the role and verb lists cover en es ar ur pl bn.
"""
import datetime as dt
import re
from . import appstrings

# Who a sentence may send the reader to. A group is allowed only when the paper's instructions mention it.
ROLES = {
    "pharmacist": r"pharmacist|pharmacy|chemist|farmac[eé]utic|farmacia|صيدل|فارماس|دوا\s?ساز|farmaceut|aptek|ফার্মাসি",
    "doctor": r"\bdoctors?\b|\bgps?\b|general practitioner|prescriber|\bsurgery\b|m[eé]dic[oa]s?\b|طبيب|ڈاکٹر|lekar|ডাক্তার|চিকিৎসক",
    "nurse": r"\bnurses?\b|enfermer|ممرض|نرس|pielęgniar|নার্স",
    "emergency": r"\b999\b|\b111\b|\b112\b|\b911\b|\ba&e\b|emergency|urgencias|طوارئ|ایمرجنسی|pogotowi|জরুরি",
    "help": r"\bfor help\b|\bfor advice\b|\bsomeone\b|\bsomebody\b|\ba carer\b|\ba friend\b|ayuda|مساعدة|مدد|pomoc|সাহায্য",
}
_ROLE_RX = {k: re.compile(v, re.I) for k, v in ROLES.items()}
# "Ask / check with / talk to / call / see ..." in the 6 UI languages.
ASK = re.compile(
    r"\b(?:ask|asks|check with|speak (?:to|with)|talk (?:to|with)|contact|call|phone|ring|see|visit|go to|tell|get)\b"
    r"|pregunt|consult|hable con|llame|contacte|acuda"
    r"|اسأل|استشر|تحدث|اتصل|راجع"
    r"|پوچھ|مشورہ|بات کریں|رابطہ|کال کریں"
    r"|zapytaj|skonsultuj|porozmawiaj|zadzwoń|skontaktuj|idź do"
    r"|জিজ্ঞেস|পরামর্শ|কথা বলুন|ফোন করুন|যোগাযোগ", re.I)

SENT = re.compile(r"(?<=[.!?।۔])\s+")


def sentences(text: str) -> list[str]:
    return [p.strip() for p in SENT.split((text or "").strip()) if p.strip()]


def paper_instructions(facts: dict | None, content: dict | None) -> str:
    """The words the paper itself uses for instructions (not addresses, sender names or the 'what this is' line):
    an address label such as 'Pharmacy:' is not an instruction to ask a pharmacist."""
    f = facts or {}
    parts = [f.get(k) for k in ("dose", "frequency", "route", "duration")]
    parts += list(f.get("warnings") or []) + list(f.get("get_help") or []) + list(f.get("source_steps") or [])
    c = content or {}
    parts += list(c.get("what_to_do") or [])
    parts += [b.get("what") for b in c.get("by_when") or [] if isinstance(b, dict)]
    parts += [x.get("what_to_write") for x in c.get("fields") or [] if isinstance(x, dict)]
    return " ".join(str(p) for p in parts if p)


def allowed_roles(paper_text: str) -> set[str]:
    return {k for k, rx in _ROLE_RX.items() if rx.search(paper_text or "")}


def is_app_advice(sentence: str, allowed: set[str]) -> bool:
    """True when the sentence sends the reader to a person or service the paper's instructions never name."""
    if not ASK.search(sentence):
        return False
    roles = {k for k, rx in _ROLE_RX.items() if rx.search(sentence)}
    return bool(roles) and not roles <= allowed


# "The paper does not say which spoon to use": dropped. Kept when it is about a key field the reader needs.
NOT_SAID = re.compile(r"\b(?:the|this|your) (?:paper|label|leaflet|letter|prescription|slip|form) (?:does not|doesn't|did not) "
                      r"(?:say|show|tell|give|explain)", re.I)
KEY_FIELD = re.compile(r"\b(?:dose|how much|how many|how often|when|date|time|amount|strength|how long|day|days|"
                       r"pay|sign|deadline)\b", re.I)


def is_not_said_filler(sentence: str) -> bool:
    return bool(NOT_SAID.search(sentence)) and not KEY_FIELD.search(sentence)


UNITS = r"(?:mg|milligrams?|ml|millilitres?|mcg|micrograms?|g|grams?|puffs?|doses?|tablets?|capsules?|drops?|" \
        r"spoonfuls?|teaspoons?|teaspoonfuls?|sachets?|units?)"
AMOUNT = re.compile(r"(\d+(?:\.\d+)?)\s*(" + UNITS + r")\b", re.I)
TAKE = re.compile(r"\b(?:take|takes|give|have|use|measure|swallow|inhale|drink|put|dose is|each time|every time)\b", re.I)
_NUMWORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8",
             "nine": "9", "ten": "10", "half": "0.5"}


def _amounts(text: str) -> set[tuple[str, str]]:
    t = re.sub(r"[A-Za-z]+", lambda m: _NUMWORDS.get(m.group(0).lower(), m.group(0)), text or "")
    out = set()
    for n, u in AMOUNT.findall(t):
        u = u.lower()
        u = {"milligram": "mg", "milligrams": "mg", "millilitre": "ml", "millilitres": "ml", "microgram": "mcg",
             "micrograms": "mcg", "gram": "g", "grams": "g"}.get(u, u.rstrip("s") if len(u) > 2 else u)
        out.add((n.rstrip("0").rstrip(".") if "." in n else n, u))
    return out


# A strength (125mg/5ml, 100 micrograms/dose) names the medicine; it is not an amount to take.
STRENGTH = re.compile(r"\d+(?:\.\d+)?\s*[a-zA-Zµ]+\s*/\s*(?:\d+(?:\.\d+)?\s*)?[a-zA-Zµ]+")


def is_computed_dose(sentence: str, printed: set[tuple[str, str]]) -> bool:
    """A 'take N unit' sentence whose amount is not printed on the paper (or in the checked technique)."""
    if not TAKE.search(sentence):
        return False
    mine = _amounts(STRENGTH.sub(" ", sentence))
    return bool(mine) and not mine <= printed


def guard_steps(steps: list[dict], facts: dict | None, content: dict | None, doc_type: str, domain: str,
                extra_printed: str = "", key: str = "text_en") -> list[dict]:
    """Remove app-added advice, filler 'the paper does not say' lines (how-to guides) and computed doses
    (medicine). Fixed app sentences (the conflict line, the blank-date line) are never touched. A step left
    with no sentence is dropped."""
    allowed = allowed_roles(paper_instructions(facts, content))
    f = facts or {}
    # The amounts a step may tell the reader to take: the printed dose lines (not the strength in the name).
    printed = _amounts(" ".join(str(f.get(k) or "") for k in ("dose", "frequency", "quantity"))
                       + " " + " ".join(f.get("source_steps") or []) + " " + " ".join(f.get("warnings") or [])
                       + " " + extra_printed)
    out = []
    for s in steps:
        text = s.get(key) or ""
        if appstrings.fixed(s.get("text_en") or text, "es"):
            out.append(s)
            continue
        keep = []
        for p in sentences(text):
            if is_app_advice(p, allowed):
                continue
            if doc_type == "how_to" and is_not_said_filler(p):
                continue
            if domain == "medicine" and is_computed_dose(p, printed):
                continue
            keep.append(p)
        if not keep:
            continue
        new = " ".join(keep)
        out.append(s if new == text.strip() else {**s, key: new})
    return out


def guard_translated(steps: list[dict], facts: dict | None, content: dict | None) -> None:
    """Second pass on the translated `text` (in place): an advice sentence the translation added is removed
    (the step keeps its text if nothing else would be left)."""
    allowed = allowed_roles(paper_instructions(facts, content))
    for s in steps:
        text = s.get("text") or ""
        if not text or text == s.get("text_en") or appstrings.fixed(s.get("text_en") or "", "es"):
            continue
        keep = [p for p in sentences(text) if not is_app_advice(p, allowed)]
        if keep and len(keep) < len(sentences(text)):
            s["text"] = " ".join(keep)


# ---------- merge one idea told over several steps ----------

_PRONOUN = re.compile(r"\b(?:them|they|these|those)\b", re.I)
_VERBS = {"take", "takes", "using", "read", "make", "keep", "have", "says", "said", "tell", "give", "with", "this",
          "that", "your", "from", "they", "them", "these", "those", "before", "after", "when", "what", "about", "paper"}


def _nouns(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", text.lower()) if w not in _VERBS}


def merge_related(steps: list[dict], max_words: int = 32) -> list[dict]:
    """Adjacent warning/get_help/what steps about the same thing ("Read the notes on the back." / "Read them before
    you use it." / "The notes on the back are too faint to read.") become ONE step. A step joins the one before when
    it refers back to it (them/they/these/those) or shares most of its nouns. Never touches how steps, the checked
    technique, fixed app lines, or steps that would grow past `max_words`."""
    out: list[dict] = []
    for s in steps:
        prev = out[-1] if out else None
        if prev and _mergeable(prev) and _mergeable(s) and len((prev["text_en"] + " " + s["text_en"]).split()) <= max_words:
            a, b = _nouns(prev["text_en"]), _nouns(s["text_en"])
            shared = a & b
            refers = bool(_PRONOUN.search(s["text_en"])) and len(s["text_en"].split()) <= 10
            if refers or (len(shared) >= 2 and len(shared) / max(1, len(b)) >= 0.6):
                text = prev["text_en"].rstrip()
                text = text if re.search(r"[.!?]$", text) else text + "."
                kind = "warning" if "warning" in (prev["kind"], s["kind"]) else prev["kind"]
                out[-1] = {**prev, "text_en": f"{text} {s['text_en'].strip()}", "kind": kind}
                continue
        out.append(s)
    return out


def _mergeable(s: dict) -> bool:
    return s.get("kind") in ("warning", "get_help") and not s.get("technique") \
        and not appstrings.fixed(s.get("text_en") or "", "es")


# ---------- paper facts the writer must not drop ----------

_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _flat(text: str) -> str:
    t = re.sub(r"[A-Za-z]+", lambda m: _NUMWORDS.get(m.group(0).lower(), m.group(0)), text or "")
    return re.sub(r"\s+", "", t.lower())


def _value_covered(value: str, steps: list[dict]) -> bool:
    """Every 'number unit' chunk of the value (5 days, 100ml, 120 dose) is in one step's text."""
    words = re.sub(r"[A-Za-z]+", lambda m: _NUMWORDS.get(m.group(0).lower(), m.group(0)), value or "")
    chunks = [re.sub(r"\s+", "", c.lower()) for c in re.findall(r"\d+(?:\.\d+)?\s*[a-zA-Zµ]*", words)]
    chunks = [re.sub(r"s$", "", c) for c in chunks]
    if not chunks:
        return any((value or "").lower() in (s.get("text_en") or "").lower() for s in steps)
    return any(all(c in _flat(s.get("text_en") or "") for c in chunks) for s in steps)


def date_covered(date_iso: str, steps: list[dict]) -> bool:
    """A step names this day: the day number and the month (name, short name or number)."""
    try:
        d = dt.date.fromisoformat(str(date_iso)[:10])
    except ValueError:
        return True
    mon = _MONTHS[d.month - 1]
    day = rf"\b0?{d.day}(?:st|nd|rd|th)?\b"
    for s in steps:
        t = (s.get("text_en") or "").lower()
        if re.search(day + rf"[^.]{{0,12}}\b{mon}", t) or re.search(rf"\b{mon}[a-z]*\.?\s+0?{d.day}\b", t) \
                or re.search(rf"\b0?{d.day}[/.-]0?{d.month}\b", t):
            return True
    return False


def _sentence(text: str) -> str:
    text = text.strip()
    text = text[0].upper() + text[1:] if text else text
    return text if re.search(r"[.!?]$", text) else text + "."


def ensure_paper_facts(steps: list[dict], facts: dict | None, dates: list[dict] | None) -> list[dict]:
    """how-to guides: how long to take it, how much was supplied and each date printed on the paper are stated in
    a step. Any the writer dropped is added as a plain step before the warnings (words as printed, no arithmetic)."""
    f = facts or {}
    add = []
    dose = (f.get("dose") or "").strip()
    if dose and re.search(r"\d|\b(?:one|two|three|four|five|half)\b", dose, re.I) and not _value_covered(dose, steps):
        add.append({"text_en": _sentence(f"Your dose: {dose}"), "kind": "how",
                    "picture_prompt": "a medicine bottle next to a measuring spoon"})
    duration = (f.get("duration") or "").strip()
    if duration and not _value_covered(duration, steps):
        simple = re.fullmatch(r"\d+\s*(?:days?|weeks?|months?)", duration, re.I)
        add.append({"text_en": f"Take it for {duration}." if simple else _sentence(f"How long to take it: {duration}"),
                    "kind": "when", "picture_prompt": "a calendar page with a row of days marked"})
    quantity = (f.get("quantity") or "").strip()
    if quantity and not _value_covered(quantity, steps):
        add.append({"text_en": _sentence(f"Amount supplied: {quantity}"), "kind": "what",
                    "picture_prompt": "a medicine bottle and box on a table"})
    seen = []
    for d in dates or []:
        if not d.get("date") or not d.get("quote") or d["date"] in seen:
            continue
        if date_covered(d["date"], steps + add):
            continue
        seen.append(d["date"])
        what = (d.get("what_en") or d.get("what") or "Date").strip().rstrip(".:")
        add.append({"text_en": _sentence(f"{what}: {d['quote'].strip()}"), "kind": "when",
                    "picture_prompt": "a calendar page with one day circled"})
    if not add:
        return steps
    pos = next((i for i, s in enumerate(steps) if s.get("kind") in ("warning", "get_help")), len(steps))
    return steps[:pos] + add + steps[pos:]


# ---------- dates ----------

def future_only(dates: list[dict], today: dt.date | None = None) -> list[dict]:
    """Remind me / Add to calendar only for days still to come: a past date stays a fact in the steps."""
    today = (today or dt.date.today()).isoformat()
    return [d for d in dates if str(d.get("date") or "") >= today]


def for_writer(dates: list[dict], today: dt.date | None = None) -> list[dict]:
    """The dates the writer must state, each marked past or not (a past date is said plainly, never as a to-do)."""
    today = (today or dt.date.today()).isoformat()
    return [{"what": d.get("what_en") or d.get("what"), "as_printed": d.get("quote"),
             "past": str(d.get("date") or "") < today} for d in dates if d.get("quote")]


# ---------- short title ----------

def short_medicine(medicine: str | None) -> str:
    """'Flutiform 125micrograms/dose ... (Napp); Ventolin 100micrograms/dose Evohaler (GSK)' -> 'Flutiform and Ventolin'."""
    names = []
    for part in re.split(r";|\n|\s\+\s", medicine or ""):
        words = []
        for w in re.sub(r"\(.*?\)", " ", part).split():
            if re.search(r"\d", w) or w in ("/", "-", ",") or w.lower() in ("tablets", "tablet", "capsules"):
                break
            words.append(w.strip(","))
        if words:
            names.append(" ".join(words[:3]))
    return " and ".join(names[:3])


def short_title(raw_title: str | None, facts: dict | None, max_words: int = 6) -> str | None:
    t = " ".join((raw_title or "").split()).strip(" .")
    if not t:
        t = short_medicine((facts or {}).get("medicine")) or (facts or {}).get("title") or ""
    words = t.split()
    return " ".join(words[:max_words]) if words else None
