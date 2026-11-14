"""Deterministic cleaning of the filtered Easy Read SFT rows for Adaption run 2.

    python -m finetune.clean_v2 [SRC.jsonl] [OUT.jsonl]

Rules: (1) how-steps start with the verb, (2) UK money/phone/dates in prompt and completion alike,
(3) one answer per identical input (relaxed to 2, then more, only if under MIN_ROWS), (4) hard re-validation.
"""
import json, re, sys, collections
from finetune.rubric import score_generic, _sentences, PIC_BAD, KINDS

MIN_ROWS = 1000
YEAR = "2026"
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
BIG_WORDS = re.compile(r"\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|"
                       r"thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|zero)\b", re.I)
NUM_WORD = re.compile(r"\b(one|two|three|four|five|six|seven|eight|nine|ten)\b(?=\s+(dollars?|pounds?|days?|weeks?|"
                      r"times?|months?|years?|puffs?|tablets?)\b)", re.I)
US_WORDS = re.compile(r"\bdollars?\b|\bcents?\b|\bDMV\b|\bzip\b", re.I)

# --- rule 1: how-steps start with the verb --------------------------------------------------------------
LEAD_DROP = re.compile(r"^You (need to|must|should|have to) ", re.I)
NOT_VERB = set("""can cannot could would may might will shall are is am was were have has had need must should
do did does owe also only then first always usually never still just now soon next later all each every any some
the a an your you my our their this that these those it we they he she to in on at if when for with not no and or
but so as by from of up out over after before once than too very really already even again please""".split())
IRREG_PAST = {"paid", "got", "went", "made", "took", "sent", "gave", "saw", "bought", "came", "left", "kept", "told",
              "felt", "found", "knew", "met", "ran", "sat", "stood", "wrote", "read"}
BASE_VERBS = {"bring", "ring", "sing", "swing", "feed", "bleed", "speed", "need"}
SUBJ_FIRST = re.compile(r"^(you|your|the|a|an|this|it|we|they|our|their|he|she|these|those|there)\b", re.I)


def _lead(sen):
    """Rewrite one sentence that starts with 'You ...' into an imperative when that is safe."""
    m = LEAD_DROP.match(sen)
    if m:
        rest = sen[m.end():]
        return rest[:1].upper() + rest[1:] if rest else sen
    if re.match(r"^You do not ", sen):
        return "Do not " + sen[len("You do not "):]
    m = re.match(r"^You (\w+)\b(.*)$", sen, re.S)
    if not m:
        return sen
    w = m.group(1).lower()
    if w in NOT_VERB or w in IRREG_PAST or not w.isalpha() or (w.endswith(("ly", "ed", "ing")) and w not in BASE_VERBS):
        return sen
    if w.endswith("s") and not w.endswith("ss"):
        return sen
    return m.group(1)[:1].upper() + m.group(1)[1:] + m.group(2)


def rewrite_text(text):
    parts = re.split(r"(?<=[.!?])(\s+)", text)
    return "".join(_lead(p) if i % 2 == 0 else p for i, p in enumerate(parts))


def rewrite_steps(steps):
    n = 0
    for s in steps:
        if s.get("kind") == "how":
            new = rewrite_text(s["text_en"])
            n += new != s["text_en"]
            s["text_en"] = new
    return n


def verb_first_ratio(steps):
    how = [s for s in steps if s.get("kind") == "how"]
    if not how:
        return 1.0
    return sum(not SUBJ_FIRST.match(s["text_en"].strip()) for s in how) / len(how)


# --- rule 2: UK money, phone numbers, dates ------------------------------------------------------------
def _amounts(t):
    return {m.replace(",", "").replace(".00", "") for m in re.findall(r"£\s?(\d[\d,]*(?:\.\d+)?)", t)}


_ONES = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen "
                                    "fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_TENS = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split())}
_WORDNUM = (r"(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|"
            r"seven|eight|nine))?|" + "|".join(sorted(_ONES, key=len, reverse=True)) + ")")


def _word_to_int(w):
    w = w.lower().replace("-", " ").split()
    return sum(_TENS.get(x, _ONES.get(x, 0)) for x in w)


def _money(t):
    """Dollar amounts to pounds. Number words directly before 'dollars' become digits."""
    t = re.sub(rf"\b({_WORDNUM})(?= dollars?\b)", lambda m: str(_word_to_int(m.group(1))), t, flags=re.I)
    t = re.sub(r"(\d[\d,]*) dollars? and (\d{1,2}) cents?\b", lambda m: f"£{m.group(1)}.{int(m.group(2)):02d}", t)
    t = re.sub(r"(\d[\d,]*(?:\.\d+)?)[ -]dollars?\b", r"£\1", t)
    t = re.sub(r"\bdollar (bills?|notes?)\b", lambda m: "pound note" + m.group(1)[4:], t)
    return re.sub(r"\$(\d)", r"£\1", t)


def ukify(prompt, completion):
    """Return (prompt, completion, changed_kinds), or None if it cannot be made consistent."""
    kinds = set()
    p, c = prompt, completion
    if US_WORDS.search(p + c) or "$" in p + c:
        p, c = _money(p), _money(c)
        if "$" in p + c or US_WORDS.search(p + c):
            return None
        kinds.add("money")
    ph = re.compile(r"\b555[- ](\d{4})\b")
    if ph.search(p + c):
        p, c = (ph.sub(lambda m: "0300 000 " + m.group(1), x) for x in (p, c))
        kinds.add("phone")
    dre = re.compile(rf"\b({MONTHS}) (\d{{1,2}}), (\d{{4}})\b")
    if dre.search(p + c):
        p, c = (dre.sub(lambda m: f"{m.group(2)} {m.group(1)} {YEAR}", x) for x in (p, c))
        kinds.add("date")
    # consistency: money, years and phone numbers in the answer must come from the input
    yrs = lambda t: set(re.findall(r"\b(?:19|20)\d\d\b", t))
    phones = lambda t: set(re.findall(r"0300 000 \d{4}", t))
    if not (_amounts(c) <= _amounts(p) and yrs(c) <= yrs(p) and phones(c) <= phones(p)):
        return None
    return p, c, kinds


# --- rule 4: hard validation ---------------------------------------------------------------------------
def valid(steps):
    if not score_generic(steps)["passed"]:
        return False
    for s in steps:
        t = s["text_en"]
        if not t.strip() or s["kind"] not in KINDS or NUM_WORD.search(t) or BIG_WORDS.search(t):
            return False
        if any(len(x.split()) > 15 for x in _sentences(t)):
            return False
        pp = s["picture_prompt"]
        if len(pp.split()) < 3 or PIC_BAD.search(pp) or re.search(r"\d", pp):
            return False
    return True


def clean(rows, min_rows=MIN_ROWS):
    st = collections.Counter()
    cands = []
    for r in rows:
        st["input"] += 1
        try:
            steps = json.loads(r["completion"]) if isinstance(r["completion"], str) else r["completion"]
            assert isinstance(steps, list) and all(isinstance(s, dict) for s in steps)
        except Exception:
            st["drop_invalid_json"] += 1
            continue
        u = ukify(r["prompt"], json.dumps(steps, ensure_ascii=False))
        if u is None:
            st["drop_usisms_inconsistent"] += 1
            continue
        prompt, comp, kinds = u
        for k in sorted(kinds):
            st["changed_" + k] += 1
        steps = json.loads(comp)
        n = rewrite_steps(steps)
        st["changed_verb_first_rows"] += n > 0
        st["steps_rewritten"] += n
        if not valid(steps):
            st["drop_rule4_validation"] += 1
            continue
        ratio = verb_first_ratio(steps)
        if ratio < 0.5:
            st["drop_not_verb_first"] += 1
            continue
        cands.append((prompt, (ratio, score_generic(steps)["score"]), json.dumps(steps, ensure_ascii=False)))
    by = collections.defaultdict(list)
    for p, key, comp in cands:
        by[p].append((key, comp))
    st["unique_inputs_after_rules"] = len(by)
    cap = 1
    while True:
        out = []
        for p in by:
            ranked = sorted(by[p], reverse=True)  # best score first; completion text breaks ties deterministically
            out += [{"prompt": p, "completion": comp} for _, comp in ranked[:cap]]
        if len(out) >= min_rows or cap >= 50:
            break
        cap += 1
    st["answers_per_input_cap"] = cap
    st["drop_duplicate_inputs"] = len(cands) - len(out)
    st["final"] = len(out)
    return out, st


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "finetune/data/train_filtered.jsonl"
    dst = sys.argv[2] if len(sys.argv) > 2 else "finetune/data/train_v2.jsonl"
    with open(src) as f:
        rows = [json.loads(l) for l in f if l.strip()]
    out, st = clean(rows)
    with open(dst, "w") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(json.dumps(st, indent=1))


if __name__ == "__main__":
    main()
