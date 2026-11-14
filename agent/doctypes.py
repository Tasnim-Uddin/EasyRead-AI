"""Document types: normalise the extraction output, merge label vs leaflet, safety lines, steps for non-how_to guides."""
import re
from . import postprocess

DOC_TYPES = ["how_to", "letter", "bill", "form", "other"]
DOMAINS = ["medicine", "money", "legal", "school", "council", "other"]

CONFLICT_TEXT = postprocess.CONFLICT_TEXT
SAFETY_MEDICINE = "In an emergency, call 999. For advice, call 111 or ask your pharmacist or GP."
SAFETY_HOWTO = "If something breaks or feels unsafe, stop and ask for help."
SAFETY_ADVICE = "Get free advice before you sign or pay. For example, Citizens Advice."

STYLE_RULES = """STYLE (Easy Read):
- One idea per sentence. At most 15 words. Everyday words. Active voice, present tense.
- Action first ("Call the council by 5 May"), not background first.
- Numbers, dates and money as digits ("2 puffs", "5 May", "£45").
- Plain, calm, neutral tone. No emoji. No exclamation marks, except inside a real warning copied from the document.
- Never write chatty or AI-sounding phrases such as "Great question", "Let's dive in", "Absolutely", "Don't worry", "Certainly", "I hope this helps".
- Never invent facts. If you cannot read something, say so in "unreadable"."""

_NUM_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
              "eight": "8", "nine": "9", "ten": "10", "once": "1", "twice": "2"}


def _s(v):
    return v.strip() if isinstance(v, str) and v.strip() else None


def _list(v):
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9£.]+", text.lower())
    return {_NUM_WORDS.get(w, w) for w in words if w not in {"a", "an", "the", "of", "to", "per", "x", "times", "time", "day", "daily"}}


def _differs(a: str | None, b: str | None) -> bool:
    """True when both are present and say different things. Compares numbers if both have them; else the words."""
    if not a or not b:
        return False
    ta, tb = _tokens(a), _tokens(b)
    na, nb = {t for t in ta if re.search(r"\d", t)}, {t for t in tb if re.search(r"\d", t)}
    if na and nb:
        return na != nb
    return not (ta <= tb or tb <= ta)  # one saying more than the other is fine; different words are a clash


def merge_medicine(facts: dict, label: dict | None, leaflet: dict | None) -> dict:
    """Label wins over leaflet for dose and frequency. Any disagreement is flagged, never silently resolved."""
    conflicts = []
    for k in ("dose", "frequency"):
        lv, fv = _s((label or {}).get(k)), _s((leaflet or {}).get(k))
        if lv:
            facts[k] = lv
        elif fv and not facts.get(k):
            facts[k] = fv
        if _differs(lv, fv):
            conflicts.append({"field": k, "label": lv, "leaflet": fv})
    facts["conflicts"] = conflicts
    if conflicts:
        facts["warnings"] = [CONFLICT_TEXT] + [w for w in facts["warnings"] if w != CONFLICT_TEXT]
    return facts


def safety_lines(doc_type: str, domain: str) -> list[str]:
    if domain == "medicine":
        return [SAFETY_MEDICINE]
    if doc_type == "how_to":
        return [SAFETY_HOWTO]
    if doc_type in ("letter", "bill", "form", "other") or domain in ("money", "legal", "council", "school"):
        return [SAFETY_ADVICE]
    return []


def normalise(raw: dict) -> dict:
    """Coerce the model's JSON into: doc_type, domain, source_kind, documents, facts, content."""
    dt = raw.get("doc_type") if raw.get("doc_type") in DOC_TYPES else "other"
    domain = raw.get("domain") if raw.get("domain") in DOMAINS else "other"
    if dt == "how_to" and domain == "other" and (raw.get("medicine") or raw.get("device_type")):
        domain = "medicine"
    facts = {"medicine": _s(raw.get("medicine")), "dose": _s(raw.get("dose")), "frequency": _s(raw.get("frequency")),
             "route": _s(raw.get("route")), "device_type": raw.get("device_type") or "unknown",
             "device_confidence": raw.get("device_confidence") if isinstance(raw.get("device_confidence"), (int, float)) else 0,
             "title": _s(raw.get("title")), "source_steps": _list(raw.get("source_steps")),
             "warnings": _list(raw.get("warnings")), "get_help": _list(raw.get("get_help")),
             "unreadable": _list(raw.get("unreadable")), "conflicts": []}
    content = None
    if dt in ("letter", "bill", "other"):
        content = {"what_this_is": _s(raw.get("what_this_is")) or "",
                   "what_to_do": _list(raw.get("what_to_do")),
                   "by_when": [{"date": _s(x.get("date")) or "", "what": _s(x.get("what")) or ""}
                               for x in raw.get("by_when") or [] if isinstance(x, dict)],
                   "amounts": [{"what": _s(x.get("what")) or "", "amount": _s(x.get("amount")) or ""}
                               for x in raw.get("amounts") or [] if isinstance(x, dict)]}
    elif dt == "form":
        content = {"fields": [{"label": _s(x.get("label")) or "", "what_to_write": _s(x.get("what_to_write")) or ""}
                              for x in raw.get("fields") or [] if isinstance(x, dict)]}
    elif domain == "medicine":
        merge_medicine(facts, raw.get("label") if isinstance(raw.get("label"), dict) else None,
                       raw.get("leaflet") if isinstance(raw.get("leaflet"), dict) else None)
    docs = [{"index": int(d["index"]), "role": d.get("role")} for d in raw.get("documents") or []
            if isinstance(d, dict) and str(d.get("index", "")).isdigit()]
    return {"doc_type": dt, "domain": domain, "source_kind": raw.get("kind") or "other",
            "documents": docs, "facts": facts, "content": content, "is_document": raw.get("is_document") is not False}


def nothing_read(facts: dict, content: dict | None) -> bool:
    """True when the extraction found no usable words at all (a tiny or blurred photo): no medicine facts, no steps,
    and an empty letter/bill/form shape."""
    if any(facts.get(k) for k in ("medicine", "dose", "frequency", "title", "source_steps", "warnings")):
        return False
    if content and any(content.get(k) for k in ("what_this_is", "what_to_do", "by_when", "amounts", "fields")):
        return False
    return True


def _facts_in(text: str) -> set[str]:
    """Money and numbers in a line (£72.02, 27, 9:15), so we can tell if a step already carries them."""
    return set(re.findall(r"£\s?\d[\d,]*(?:\.\d+)?|\d+(?:[:.]\d+)?", text.replace(" ", "")))


def ensure_content_facts(steps: list[dict], doc_type: str, content: dict | None) -> list[dict]:
    """letter/bill/other: the rewriter may drop a date, time or amount (a bill total, a trip date, a new dose).
    Any content line whose numbers no step carries is added back as its deterministic step."""
    if doc_type not in ("letter", "bill", "other") or not content:
        return steps
    have = set().union(*(_facts_in(s.get("text_en") or "") for s in steps)) if steps else set()
    out = list(steps)
    for s in content_to_steps(doc_type, content):
        need = _facts_in(s["text_en"])
        if need and not need <= have:
            out.append(s)
            have |= need
    return out


def _step(kind: str, text: str, prompt: str) -> dict:
    return {"text_en": text, "kind": kind, "picture_prompt": prompt}


def content_to_steps(doc_type: str, content: dict) -> list[dict]:
    """Deterministic steps for letter/bill/other/form guides (the extraction prompt already wrote Easy Read text)."""
    out = []
    if doc_type == "form":
        for f in content["fields"][:12]:
            if f["label"]:
                out.append(_step("how", f"{f['label']}: {f['what_to_write']}".strip(": "),
                                 "a person filling in a form with a pen at a table"))
        return out
    if content["what_this_is"]:
        out.append(_step("what", content["what_this_is"], "a person reading a letter at a table"))
    for t in content["what_to_do"][:10]:
        out.append(_step("how", t, "a person calmly doing one simple task at a desk"))
    for b in content["by_when"][:3]:
        out.append(_step("when", f"By {b['date']}: {b['what']}".replace("By : ", ""), "a calendar page with one day circled"))
    for a in content["amounts"][:3]:
        out.append(_step("what", f"{a['what']}: {a['amount']}".strip(": "), "a hand holding a few coins"))
    return out


def finish_steps(steps: list[dict], doc_type: str, domain: str, conflicts: list, device_type: str | None = None) -> list[dict]:
    """Tidy the steps (split, dedupe, technique check, STYLE.md order), make sure the conflict flag and the
    safety line are present, then cap the length."""
    steps = postprocess.tidy(steps, doc_type, domain, device_type)
    if conflicts and not any(postprocess.is_conflict(s["text_en"]) for s in steps):
        steps.insert(0, _step("warning", CONFLICT_TEXT, "a person holding a medicine box and a leaflet, looking unsure"))
    for line in safety_lines(doc_type, domain):
        key = "999" if domain == "medicine" else "ask for help" if doc_type == "how_to" else "free advice"
        if not any(key in s["text_en"] for s in steps):
            steps.append(_step("get_help", line, "a person on the phone talking to a helper"))
    return postprocess.cap(steps, doc_type, domain)
