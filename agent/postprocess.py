"""Post-processing for finished guide steps: split, dedupe, order, technique check, cap.

All pure functions over [{text_en, kind, picture_prompt}], so they are testable without an LLM.
"""
import difflib
import re
from . import technique

STOP = {"a", "an", "the", "your", "you", "to", "of", "is", "are", "and", "this", "that", "it", "for", "on", "in", "if"}
MONEY = re.compile(r"£\s?\d[\d,]*(?:\.\d+)?")
# Step caps by guide shape (STYLE.md section 5: a letter is 1 line + 1-3 actions + by when + help;
# how-to steps are one action each, so they get more room).
CAPS = {"letter": 8, "bill": 8, "other": 8, "form": 14, "medicine": 16, "how_to": 12}
CONFLICT_TEXT = "Your label and leaflet say different things. Ask your pharmacist."
RANK = {"what": 0, "how": 1, "when": 2, "warning": 3, "get_help": 4}


def _norm(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9£.]+", text.lower().replace("’", "'")) if w not in STOP]


def similar(a: str, b: str) -> bool:
    """Near-identical after normalising. Different digits (box 3 vs box 4, 2 vs 4 puffs) are never duplicates."""
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    if {w for w in na if re.search(r"\d", w)} != {w for w in nb if re.search(r"\d", w)}:
        return False
    sa, sb = set(na), set(nb)
    jac = len(sa & sb) / len(sa | sb)
    cover = len(sa & sb) / min(len(sa), len(sb))
    ratio = difflib.SequenceMatcher(None, " ".join(na), " ".join(nb)).ratio()
    return ratio >= 0.8 or jac >= 0.7 or (cover >= 0.9 and min(len(sa), len(sb)) >= 6)


def is_conflict(text: str) -> bool:
    t = text.lower()
    return "label" in t and "leaflet" in t and ("different" in t or "disagree" in t)


def normalise_conflict(steps: list[dict]) -> list[dict]:
    """A model-written conflict step often carries extra sentences (the two doses, the limits). Keep the one
    canonical flag, and turn extra sentences that do not talk about label/leaflet into their own warning steps."""
    out = []
    for s in steps:
        if not is_conflict(s["text_en"]):
            out.append(s)
            continue
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", s["text_en"].strip()) if p.strip()]
        extra = [p for p in parts if not re.search(r"label|leaflet|pharmacist|\bsays?\b", p, re.I)]
        out.append({**s, "text_en": CONFLICT_TEXT})
        out += [{**s, "text_en": p, "kind": "warning"} for p in extra]
    return out


def _items_in(sentence: str, items: list[dict]) -> set[int]:
    low = sentence.lower()
    return {n for n, it in enumerate(items) if any(k in low for k in it["keywords"])}


def split_technique(steps: list[dict], device_type: str | None) -> list[dict]:
    """A how step that covers two different technique lines (hold + wait, breathe out + mouthpiece) is split
    into one step per line (one idea per step)."""
    items = technique.outline(device_type)
    if not items:
        return steps
    out = []
    for s in steps:
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", s["text_en"].strip()) if p.strip()]
        if s["kind"] != "how" or len(parts) < 2:
            out.append(s)
            continue
        chunks, cur_items = [[parts[0]]], _items_in(parts[0], items)
        for p in parts[1:]:
            ids = _items_in(p, items)
            if ids and cur_items and not (ids & cur_items):
                chunks.append([p])
                cur_items = ids
            else:
                chunks[-1].append(p)
                cur_items = cur_items | ids
        out += [{**s, "text_en": " ".join(c)} for c in chunks]
    return out


def split_warnings(steps: list[dict]) -> list[dict]:
    """A warning step with several sentences becomes one step per sentence (one idea per step)."""
    out = []
    for s in steps:
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", s["text_en"].strip()) if p.strip()]
        if s["kind"] == "warning" and not is_conflict(s["text_en"]) and len(parts) > 1 and all(len(p.split()) >= 3 for p in parts):
            out += [{**s, "text_en": p} for p in parts]
        else:
            out.append(s)
    return out


def dedupe(steps: list[dict]) -> list[dict]:
    """Keep the first of any near-identical pair. Any two conflict warnings count as identical."""
    out = []
    for s in steps:
        if any(similar(s["text_en"], k["text_en"]) or (is_conflict(s["text_en"]) and is_conflict(k["text_en"])) for k in out):
            continue
        out.append(s)
    return out


def drop_restated(steps: list[dict], doc_type: str) -> list[dict]:
    """letter/bill/other: a later what/when step whose money (or, with no money, date) already appears in an
    earlier step is a content field re-appended; drop it."""
    if doc_type not in ("letter", "bill", "other"):
        return steps
    out = []
    for i, s in enumerate(steps):
        if i > 0 and s["kind"] in ("what", "when"):
            before = " ".join(k["text_en"] for k in out if k["kind"] != "warning").replace(" ", "")
            money = MONEY.findall(s["text_en"])
            if money and all(m.replace(" ", "") in before for m in money):
                continue
            if not money:
                dates = re.findall(r"\b\d{1,2} [A-Z][a-z]+(?: \d{4})?", s["text_en"])
                if dates and all(d.replace(" ", "") in before for d in dates):
                    continue
        out.append(s)
    return out


def ensure_technique(steps: list[dict], device_type: str | None) -> list[dict]:
    """Insert any outline line that no how step covers, at its place in the outline."""
    items = technique.outline(device_type)
    if not items:
        return steps
    steps = list(steps)

    def match(it):
        for i, s in enumerate(steps):
            if s["kind"] == "how" and any(k in s["text_en"].lower() for k in it["keywords"]):
                return i
        return None
    last = -1  # index of the latest step that covers an earlier outline line
    for n, it in enumerate(items):
        m = match(it)
        if m is not None:
            last = max(last, m)
            continue
        later = [x for x in (match(j) for j in items[n + 1:]) if x is not None]
        if last >= 0:
            pos = last + 1
        elif later:
            pos = min(later)
        else:
            pos = next((i for i, s in enumerate(steps) if s["kind"] != "what"), len(steps))
        steps.insert(pos, {"text_en": it["text"], "kind": "how", "picture_prompt": it["picture_prompt"]})
        last = pos
    return steps


def order(steps: list[dict], doc_type: str) -> list[dict]:
    """letter/bill/other: what -> how -> when -> warning -> get_help. how-to: what -> how -> warning -> get_help.
    Forms keep the box order. A conflict warning goes first so no step states a dose before it."""
    if doc_type == "form":
        return steps
    rank = dict(RANK)
    if doc_type == "how_to":
        rank["when"] = 1

    def key(ix):
        i, s = ix
        if is_conflict(s["text_en"]):
            return (-1, i)
        r = rank.get(s["kind"], 1)
        if s["kind"] == "what" and i > 0:
            r = 1
        return (r, i)
    return [s for _, s in sorted(enumerate(steps), key=key)]


def cap(steps: list[dict], doc_type: str, domain: str) -> list[dict]:
    """Trim to the type's cap. Drops extra 'what' steps, then the last 'how' steps. Warnings, help and
    the first step are never dropped."""
    limit = CAPS["medicine"] if domain == "medicine" else CAPS.get(doc_type, 12)
    steps = list(steps)
    while len(steps) > limit:
        cands = [i for i, s in enumerate(steps) if s["kind"] == "what" and i > 0] or \
                [i for i, s in enumerate(steps) if s["kind"] in ("how", "when") and i > 0]
        if not cands:
            break
        steps.pop(cands[-1])
    return steps


def tidy(steps: list[dict], doc_type: str, domain: str, device_type: str | None = None) -> list[dict]:
    steps = dedupe(drop_restated(split_warnings(dedupe(normalise_conflict(steps))), doc_type))
    if doc_type == "how_to" and domain == "medicine":
        steps = dedupe(split_technique(steps, device_type))
        steps = ensure_technique(steps, device_type)
    return order(steps, doc_type)
