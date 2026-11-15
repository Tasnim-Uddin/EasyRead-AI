"""Post-processing for finished guide steps: split, dedupe, order, technique check, cap.

All pure functions over [{text_en, kind, picture_prompt}], so they are testable without an LLM.
"""
import difflib
import re
from . import technique, visuals

STOP = {"a", "an", "the", "your", "you", "to", "of", "is", "are", "and", "this", "that", "it", "for", "on", "in", "if"}
MONEY = re.compile(r"£\s?\d[\d,]*(?:\.\d+)?")
# Step caps by guide shape. Easy Read guides aim for 6-12 steps; a letter's facts (every action, date, amount)
# matter more than brevity, so letters get 10 (plus a few more only when every extra step holds its own date, time or amount). How-to steps are one action each, so they get more room.
CAPS = {"letter": 10, "bill": 10, "other": 10, "form": 14, "medicine": 16, "how_to": 12}
CONFLICT_TEXT = "Your label and leaflet say different things. Ask your pharmacist."
RANK = {"what": 0, "how": 1, "when": 2, "warning": 3, "get_help": 4}
# Template placeholders printed on a blank or sample paper: «PCN_Amount», <<Name>>, {{date}}, [date], DD/MM/CCYY,
# £XX.XX, ______. They are not values: a step must never read one out as if it were the amount or the date.
PLACEHOLDER = re.compile(r"«[^»]{1,60}»|<<[^>]{1,60}>>|\{\{[^}]{1,60}\}\}|\[[A-Za-z_]{2,20}(?: [A-Za-z_]{2,14})?\]"
                         r"|\b(?:DD|dd)\s?[/.-]?\s?(?:MM|mm|Month|month)\s?[/.-]?\s?(?:CCYY|YYYY|yyyy|YY|yy)\b"
                         r"|£\s?X+(?:\.X+)?\b|_{3,}")
BLANK = "(blank on your paper)"


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
                dates = re.findall(r"\b\d{1,2} [A-Z][a-z]+(?: \d{4})?|\b\d+ (?:working )?(?:days?|weeks?|months?)\b", s["text_en"])
                # Same date is not the same fact: "pay by 30 Nov" does not cover "return the form by 30 Nov".
                if dates and all(d.replace(" ", "") in before for d in dates) and any(
                        all(d in k["text_en"] for d in dates) and _same_action(s["text_en"], k["text_en"]) for k in out):
                    continue
        out.append(s)
    return out


_DAYS = re.compile(r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december"
                   r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|^by [^:]+:", re.I)
_COMMON = {"your", "with", "this", "that", "will", "have", "from", "they", "them", "their", "about", "there", "what",
           "when", "also", "into", "been", "must", "need", "please"}


def _same_action(a: str, b: str) -> bool:
    """At least 60% of a's content words (dates removed) also appear in b."""
    wa = {w for w in re.findall(r"[a-z]{4,}", _DAYS.sub(" ", a.lower())) if w not in _COMMON}
    wb = set(re.findall(r"[a-z]{4,}", b.lower()))
    return not wa or len(wa & wb) / len(wa) >= 0.6


LIMIT = re.compile(r"\b(more than|more often|more times|maximum|at most|no more)\b", re.I)


def is_dose_limit(s: dict) -> bool:
    return s["kind"] == "what" and bool(LIMIT.search(s["text_en"])) and not is_conflict(s["text_en"])


def merge_dose_limits(steps: list[dict]) -> list[dict]:
    """Consecutive 'what' dose-limit steps become one step of at most 2 short sentences. Vague ones ('Do not use it
    more often than advised') are dropped when a concrete limit (one with a number) exists. Numbers are never dropped:
    a third concrete limit stays as its own step."""
    out, i = [], 0
    while i < len(steps):
        if not is_dose_limit(steps[i]):
            out.append(steps[i])
            i += 1
            continue
        j = i
        while j < len(steps) and is_dose_limit(steps[j]):
            j += 1
        run = steps[i:j]
        concrete = [s for s in run if re.search(r"\d", s["text_en"])]
        if not concrete:
            out += run[:1]
        else:
            out.append({**concrete[0], "text_en": " ".join(s["text_en"].strip() for s in concrete[:2])})
            out += concrete[2:]
        i = j
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
    first_money = next((i for i, s in enumerate(steps) if i > 0 and s["kind"] == "what" and MONEY.search(s["text_en"])), None) \
        if doc_type == "bill" and not (steps and MONEY.search(steps[0]["text_en"])) else None

    def key(ix):
        i, s = ix
        if is_conflict(s["text_en"]):
            return (-1, i)
        r = rank.get(s["kind"], 1)
        if s["kind"] == "what" and i > 0:
            r = 1
            if i == first_money:
                r = 0  # a bill's total to pay comes straight after "what this is"
        return (r, i)
    return [s for _, s in sorted(enumerate(steps), key=key)]


def cap(steps: list[dict], doc_type: str, domain: str) -> list[dict]:
    """Trim to the type's cap. Drops extra 'what' steps, then the last 'how' steps. Warnings, help and
    the first step are never dropped."""
    limit = CAPS["medicine"] if domain == "medicine" else CAPS.get(doc_type, 12)
    steps = list(steps)
    while len(steps) > limit:
        # A step holding a date, time or amount no other step has is a fact; keep it unless the guide is far too long.
        keep = len(steps) <= limit + EXTRA_FOR_FACTS
        def droppable(i, s):
            return i > 0 and not (keep and unique_numbers(s, steps))
        cands = [i for i, s in enumerate(steps) if s["kind"] == "what" and droppable(i, s)] or \
                [i for i, s in enumerate(steps) if s["kind"] in ("how", "when") and droppable(i, s)
                 and not s.get("technique")]  # a checked technique line is never trimmed
        if not cands:
            break
        steps.pop(cands[-1])
    return steps


EXTRA_FOR_FACTS = 4
NUM = re.compile(r"£\s?\d[\d,]*(?:\.\d+)?|\d+(?:[:.]\d+)?")


def unique_numbers(step: dict, steps: list[dict]) -> bool:
    """True when the step has a number (date, time, amount, dose) that no other step mentions."""
    mine = set(NUM.findall(step["text_en"]))
    others = set().union(*(set(NUM.findall(s["text_en"])) for s in steps if s is not step)) if len(steps) > 1 else set()
    return bool(mine - others)


KNOW = re.compile(r"^(?:you\s+)?(?:need\s+to\s+)?know\s+(?:that\s+)?", re.I)


def drop_know(steps: list[dict]) -> list[dict]:
    """'Know that the council says...' -> 'The council says...'. The verb-first rule makes the model start fact
    steps with 'Know'; a plain statement reads better. Only for what/when steps, and only if words remain."""
    out = []
    for s in steps:
        t = s["text_en"]
        rest = KNOW.sub("", t, count=1) if s["kind"] in ("what", "when") else t
        if rest != t and len(rest.split()) >= 2:
            t = rest[0].upper() + rest[1:]
        out.append({**s, "text_en": t})
    return out


# Words on a label or leaflet that name the device type, for when no device photo was given.
DEVICE_WORDS = [
    ("inhaler_mdi", re.compile(r"evohaler|pressuri[sz]ed (?:metered[- ]dose )?inhaler|metered[- ]dose inhaler|aerosol inhaler"
                               r"|\bpmdi\b|\bmdi\b", re.I)),
    ("inhaler_dry_powder", re.compile(r"dry[- ]powder inhaler|accuhaler|turbohaler|easyhaler|ellipta|\bdpi\b", re.I)),
    ("eye_drops", re.compile(r"eye drops?", re.I)),
    ("nasal_spray", re.compile(r"nasal spray", re.I)),
]


def device_from_facts(facts: dict) -> str | None:
    """The device type the label/leaflet text names, or None. Used when the extractor gave no (or an unknown)
    device type, so the checked technique still applies without a device photo."""
    dev = facts.get("device_type")
    if dev and dev != "unknown" and technique.outline(dev):
        return dev
    text = " ".join(str(facts.get(k) or "") for k in ("medicine", "route", "title"))
    for name, rx in DEVICE_WORDS:
        if rx.search(text):
            return name
    return dev if dev else None


def use_checked_technique(steps: list[dict], device_type: str | None) -> list[dict]:
    """For a known device, the how steps ARE the checked technique outline (one step per line, in order).
    Model how steps that cover an outline line are replaced; any other model how step is kept after the outline."""
    items = technique.outline(device_type)
    if not items:
        return steps
    keys = [k for it in items for k in it["keywords"]]
    first = next((i for i, s in enumerate(steps) if s["kind"] == "how"), None)
    if first is None:
        first = next((i for i, s in enumerate(steps) if s["kind"] not in ("what", "when") and not is_conflict(s["text_en"])), len(steps))
    keep_before = [s for s in steps[:first]]
    rest = steps[first:]
    extra_how = [s for s in rest if s["kind"] == "how" and not any(k in s["text_en"].lower() for k in keys)]
    others = [s for s in rest if s["kind"] != "how"]
    checked = [{"text_en": it["text"], "kind": "how", "picture_prompt": it["picture_prompt"], "technique": True} for it in items]
    return keep_before + checked + extra_how + others


RESTATES_DOSE = re.compile(r"\b(label|leaflet)\b|not agree|disagree|different things|how many|how much|usual dose is|may take up to", re.I)
MAX_WARNINGS = 4


def compress_warnings(steps: list[dict], has_conflict: bool) -> list[dict]:
    """Fewer repeated warnings, no safety fact lost:
    - with a label/leaflet conflict, the conflict is shown ONCE (the conflict step + the Summary conflict card), so
      warning steps that restate either dose ('Your label says 2 puffs', 'Ask how many puffs') are dropped;
    - all dose-limit warnings become one step (at most 2 concrete limits per step); a vague limit ('not more often
      than advised') is dropped when a concrete one exists;
    - more than MAX_WARNINGS warnings: the shortest neighbours are joined two to a step (nothing is dropped)."""
    out = []
    for s in steps:
        if s["kind"] == "warning" and not is_conflict(s["text_en"]) and has_conflict and RESTATES_DOSE.search(s["text_en"]) \
                and not LIMIT.search(s["text_en"]):
            continue
        out.append(s)
    limits = [s for s in out if s["kind"] == "warning" and LIMIT.search(s["text_en"]) and not is_conflict(s["text_en"])]
    if len(limits) > 1:
        concrete = [s for s in limits if re.search(r"\d", s["text_en"])]
        keep = concrete or limits[:1]
        merged = [{**keep[i], "text_en": " ".join(k["text_en"].strip() for k in keep[i:i + 2])} for i in range(0, len(keep), 2)]
        pos = out.index(limits[0])
        out = [s for s in out if s not in limits]
        out[pos:pos] = merged
    plain = [i for i, s in enumerate(out) if s["kind"] == "warning" and not is_conflict(s["text_en"])]
    while len(plain) > MAX_WARNINGS:
        # join the two adjacent single-sentence warnings with the fewest words
        pairs = [(len(out[a]["text_en"].split()) + len(out[b]["text_en"].split()), a, b) for a, b in zip(plain, plain[1:])
                 if len(re.findall(r"[.!?](?:\s|$)", out[a]["text_en"].strip() + " ")) <= 1
                 and len(re.findall(r"[.!?](?:\s|$)", out[b]["text_en"].strip() + " ")) <= 1]
        if not pairs:
            break
        _, a, b = min(pairs)
        out[a] = {**out[a], "text_en": out[a]["text_en"].strip() + " " + out[b]["text_en"].strip()}
        del out[b]
        plain = [i for i, s in enumerate(out) if s["kind"] == "warning" and not is_conflict(s["text_en"])]
    return out


TARGET_STEPS = 12
JOIN_MAX_WORDS = 20


def fit_warnings(steps: list[dict], limit: int = TARGET_STEPS) -> list[dict]:
    """Over the 6-12 step target: join the two shortest adjacent one-sentence warnings into one step (at most
    JOIN_MAX_WORDS words), until the guide fits. Nothing is dropped; the checked technique steps are untouched."""
    out = list(steps)
    while len(out) > limit:
        idx = [i for i, s in enumerate(out) if s["kind"] == "warning" and not is_conflict(s["text_en"])
               and len(re.findall(r"[.!?](?:\s|$)", s["text_en"].strip() + " ")) <= 1]
        pairs = [(len(out[a]["text_en"].split()) + len(out[b]["text_en"].split()), a, b) for a, b in zip(idx, idx[1:])
                 if b == a + 1]
        pairs = [p for p in pairs if p[0] <= JOIN_MAX_WORDS]
        if not pairs:
            break
        _, a, b = min(pairs)
        out[a] = {**out[a], "text_en": out[a]["text_en"].strip() + " " + out[b]["text_en"].strip()}
        del out[b]
    return out


def honest_blanks(steps: list[dict]) -> list[dict]:
    """A placeholder copied into a step ("Pay by DD/MM/CCYY", "Fine: «PCN_Amount»") is said as what it is:
    "(blank on your paper)". Never a made-up value, never the template code."""
    out = []
    for s in steps:
        t = s["text_en"]
        if PLACEHOLDER.search(t):
            t = PLACEHOLDER.sub(BLANK, t)
            t = re.sub(r"\(\s*\(blank on your paper\)\s*\)", BLANK, t)
            t = re.sub(r"\bnot filled in\s*\(blank on your paper\)", BLANK, t, flags=re.I)
            t = re.sub(r"\s{2,}", " ", t).strip()
        out.append({**s, "text_en": t})
    return out


def tidy(steps: list[dict], doc_type: str, domain: str, device_type: str | None = None, has_conflict: bool = False) -> list[dict]:
    steps = drop_know(honest_blanks(steps))
    steps = dedupe(drop_restated(split_warnings(dedupe(normalise_conflict(steps))), doc_type))
    steps = merge_dose_limits(steps)
    if doc_type == "how_to" and domain == "medicine":
        if technique.outline(device_type):
            steps = use_checked_technique(steps, device_type)
        else:
            steps = dedupe(split_technique(steps, device_type))
            steps = ensure_technique(steps, device_type)
        steps = compress_warnings(steps, has_conflict or any(is_conflict(s["text_en"]) for s in steps))
    # Each step gets `visual`: an animated close-up from the web library, or None (agent/visuals.py).
    guide = {"doc_type": doc_type, "domain": domain, "facts": {"device_type": device_type}}
    return visuals.attach_visuals(order(steps, doc_type), guide)
