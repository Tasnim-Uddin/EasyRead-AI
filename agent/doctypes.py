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


_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
           "november", "december"]


def _facts_in(text: str) -> set[str]:
    """Money, numbers and months in a line (£72.02, 27, 9:15, november), so we can tell if a step already carries them.
    Date and time spellings are unified first: 15/11/2026 == 15 November 2026, 9.15am == 9:15."""
    t = re.sub(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b",
               lambda m: f"{m.group(1)} {_MONTHS[int(m.group(2)) - 1] if 1 <= int(m.group(2)) <= 12 else m.group(2)} {m.group(3)}",
               text.lower())
    t = re.sub(r"\b(\d{1,2})\.(\d{2})\s*(am|pm)\b", r"\1:\2", t)
    months = {w for w in _MONTHS if re.search(rf"\b{w}\b", t)}
    return months | set(re.findall(r"£\s?\d[\d,]*(?:\.\d+)?|\d+(?:[:.]\d+)?", t.replace(" ", "")))


_URL = re.compile(r"\b[\w.-]+@[\w-]+(?:\.[\w-]+)+|\b(?:https?://)?[a-z0-9-]+(?:\.[a-z0-9-]+)+/[\w/.-]*|\b(?:www\.)?[a-z0-9-]+\.(?:example|gov\.uk|nhs\.uk|org\.uk|co\.uk|com|org|uk)\b", re.I)


def _links_in(text: str) -> set[str]:
    """Web addresses and emails in a line (fenwick.example/ctax, help@x.org): a way to act is a fact too."""
    return {m.lower().rstrip("/.") for m in _URL.findall(text)}


def _covered(item: dict, steps: list[dict]) -> bool:
    """A content line is covered when, for each of its sentences, ONE step carries all its numbers/links AND says
    the same action (a shared date alone is not enough: "pay by 30 Nov" does not cover "return the form by 30 Nov")."""
    parts = [p for p in re.split(r"(?<=[.!?])\s+", item["text_en"].strip()) if p]
    if item.get("kind") == "when" or len(parts) < 2:
        return _sentence_covered(item["text_en"], steps)
    return all(_sentence_covered(p, steps) for p in parts)


def _sentence_covered(text: str, steps: list[dict]) -> bool:
    item = {"text_en": text}
    need = _facts_in(text) | _links_in(text)
    for s in steps:
        t = s.get("text_en") or ""
        if need and not need <= (_facts_in(t) | _links_in(t)):
            continue
        if any(n.startswith("£") for n in need):
            return True  # an amount is its own fact: the step that carries it covers it
        if postprocess.similar(item["text_en"], t) or _overlap(_action(item["text_en"]), t, _COMMON) >= 0.6:
            return True
    return False


def _action(text: str) -> str:
    """The words of a line without its dates, times and amounts ("By 30 November: Sign the form" -> "Sign the form")."""
    text = re.sub(r"^By [^:]+:\s*", "", text)
    return re.sub("|".join(_MONTHS) + r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday", " ", text, flags=re.I)


def ground_examples(steps: list[dict], content: dict | None) -> list[dict]:
    """A step may add a made-up example ("Example: Jane Smith", "For example, Town Bank, Leeds"). An example is only
    kept when its words come from the paper (the extracted content); otherwise the sentence is removed."""
    src = " ".join(str(v) for v in _walk(content)).lower()
    out = []
    for s in steps:
        parts = re.split(r"(?<=[.!?])\s+", (s.get("text_en") or "").strip())
        keep = []
        for p in parts:
            m = re.match(r"^(?:for )?example[:,]?\s*(.+)$", p, re.I)
            if m and not _overlap_all(m.group(1), src):
                continue
            keep.append(p)
        text = " ".join(keep).strip()
        if text:
            out.append({**s, "text_en": text})
    return out


def _walk(v):
    if isinstance(v, dict):
        for x in v.values():
            yield from _walk(x)
    elif isinstance(v, list):
        for x in v:
            yield from _walk(x)
    elif isinstance(v, str):
        yield v


def _overlap_all(example: str, src: str) -> bool:
    """True when every word and number of the example appears in the source text."""
    words = re.findall(r"[a-z0-9]+", example.lower())
    have = set(re.findall(r"[a-z0-9]+", src))
    return bool(words) and all(w in have for w in words)


def ensure_content_facts(steps: list[dict], doc_type: str, content: dict | None) -> list[dict]:
    """letter/bill/other: the rewriter may drop a date, time, amount, web address or a whole action (a bill total,
    a trip date, "return the form by 30 Nov", "visit x.example to set up a plan"). Any content line no step covers
    is added back as its deterministic step. Every type: made-up examples are removed."""
    steps = ground_examples(steps, content)
    if doc_type not in ("letter", "bill", "other") or not content:
        return steps
    out = list(steps)
    for s in content_to_steps(doc_type, content):
        if s["kind"] == "what" and not out:
            out.append(s)
        elif s is not None and not _covered(s, out) and not (s["kind"] == "what" and not _facts_in(s["text_en"]) and out):
            out.append(s)
    return out


_COMMON = {"your", "with", "this", "that", "will", "have", "from", "they", "them", "their", "about", "there", "what",
           "when", "also", "into", "been", "must", "need", "please"}


def _overlap(a: str, b: str, skip: set[str] = frozenset()) -> float:
    """Share of a's content words (4+ letters, minus `skip`) that also appear in b."""
    wa = {w for w in re.findall(r"[a-z]{4,}", a.lower()) if w not in skip}
    wb = {w for w in re.findall(r"[a-z]{4,}", b.lower())}
    return len(wa & wb) / len(wa) if wa else 1.0


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
        date = str(b.get("date") or "")
        text = f"By {date}: {b['what']}" if re.search(r"\d", date) else str(b["what"])
        text = text if re.search(r"[.!?]$", text.strip()) else text.strip() + "."  # "date to come by letter" -> just the action
        out.append(_step("when", text, "a calendar page with one day circled"))
    for a in content["amounts"][:3]:
        out.append(_step("what", f"{a['what']}: {a['amount']}".strip(": "), "a hand holding a few coins"))
    return out


def finish_steps(steps: list[dict], doc_type: str, domain: str, conflicts: list, device_type: str | None = None) -> list[dict]:
    """Tidy the steps (split, dedupe, technique check, STYLE.md order), make sure the conflict flag and the
    safety line are present, then cap the length."""
    steps = postprocess.tidy(steps, doc_type, domain, device_type, bool(conflicts))
    if conflicts and not any(postprocess.is_conflict(s["text_en"]) for s in steps):
        steps.insert(0, _step("warning", CONFLICT_TEXT, "a person holding a medicine box and a leaflet, looking unsure"))
    for line in safety_lines(doc_type, domain):
        key = "999" if domain == "medicine" else "ask for help" if doc_type == "how_to" else "free advice"
        if not any(key in s["text_en"] for s in steps):
            steps.append(_step("get_help", line, "a person on the phone talking to a helper"))
    if doc_type == "how_to":
        steps = postprocess.fit_warnings(steps)
    return postprocess.cap(steps, doc_type, domain)
