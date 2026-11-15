"""Guide pipeline: extract -> identify device -> Easy Read rewrite -> pictures. Falls back to the fixture without keys."""
import asyncio, base64, copy, json, os, pathlib, re, datetime as dt, logging
from . import langs, llm, locate, postprocess, technique
from .docs import ROLES
from .rewriter import write_easy_read, write_generic_howto
from .doctypes import STYLE_RULES, content_to_steps, ensure_content_facts, finish_steps, normalise, nothing_read, safety_lines

log = logging.getLogger("agent.pipeline")
ROOT = pathlib.Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "demo" / "fixtures" / "guide_inhaler.json"
LIBRARY = ROOT / "library" / "index.json"
DEVICE_TYPES = ["inhaler_mdi", "inhaler_mdi_spacer", "inhaler_dry_powder", "cream_ointment", "tablets",
                "eye_drops", "nasal_spray", "unknown"]

EXTRACT_SYSTEM = f"""You read photos and PDFs the user uploaded (one or several: a medicine label, a leaflet, a letter, a bill, a form,
a photo of their own device) and extract facts in ONE pass. Each file is introduced by a line "Document N (role: ...)".
If the role says "detect", decide it: one of label, leaflet, device_photo, letter, form, other.
Copy only what is in the documents; never invent. Use null for anything absent. Put anything you cannot read in "unreadable".
A blank box or a template placeholder (for example «Amount», [date], [time], DD/MM/YYYY, XX.XX, ______) is NOT a value:
never copy it as one and never guess it. Keep the action and say plainly that the paper does not show the value, for
example "Pay by the date on your letter. This paper does not show the date." Give no "dates" entry for it, and in
"amounts" write "not shown on the paper" as the amount. Never add urgency the paper does not print ("now", "today",
"straight away"): if the paper gives no date, do not make one up.

First decide if this is a paper at all. Set "is_document": false only when NO file is a document, label, leaflet, letter,
bill, form, instructions or a medicine or device (for example a drawing, a selfie, a pet, a view). Otherwise true.
If you cannot read any words at all (too small, too blurred, too dark), put that in "unreadable" and leave the other fields empty.

Then classify the whole set. doc_type is one of:
- how_to: something to use or take, such as a medicine (set domain "medicine")
- letter: a letter or notice that asks the reader to do something
- bill: a bill, invoice or fine
- form: a form the reader must fill in
- other: anything else
domain is one of medicine, money, legal, school, council, other. Use medicine for ANY health paper too: a GP or hospital letter,
an appointment, a test, a discharge letter.

{STYLE_RULES}

Return JSON only. Always include: "doc_type", "domain", "kind" (prescription|leaflet|letter|other),
"documents": [{{"index": N, "role": str}}] for every file, "unreadable": [str].
Then, by doc_type:
- how_to (medicine): "medicine", "dose", "frequency", "route", "device_type", "device_confidence" (0-1), "warnings": [str], "get_help": [str]
  (copy warnings and get_help faithfully). device_type is one of {DEVICE_TYPES}; if a device_photo is included, use it
  (a metered-dose inhaler is shaken; a dry-powder inhaler is not). Pick a *_spacer type only if the paper says to always
  use a spacer or the device photo shows one; "use a spacer if you have one" is not enough. If both a label and a leaflet are present, also give
  "label": {{"dose", "frequency"}} and "leaflet": {{"dose", "frequency"}} exactly as each one says. Do not merge them yourself.
- how_to (not medicine, for example furniture, a phone, a boiler): "title", "source_steps": [the document's own steps, in order,
  one action each, copied faithfully], "warnings": [str], "get_help": [str]. Leave the medicine fields null.
- letter, bill, other: "what_this_is": one Easy Read sentence; "what_to_do": [at most 5 short action sentences, action first, in the order to do them; never repeat a date or amount that is already in by_when or amounts;
  keep any exception the paper gives, for example "You can drink water"; for a list of medicine changes (stop, start, change a dose)
  give one sentence per medicine with its name and dose, up to 10];
  "by_when": [{{"date": str, "what": str}}]; "amounts": [{{"what": str, "amount": str}}] (at most 3, the total to pay first, then fees; leave out line items)
- form: "fields": [{{"label": str, "what_to_write": str}}] in Easy Read words, one per box on the form

Also always include (keep them short; copy printed words character for character, as printed, never reworded):
"quotes": [{{"t": str, "p": N}}] at most 12: the printed words a reader must find on the paper: each amount, date, time,
  reference or account number, phone number, web address, form box label (the label only, for example "Name(s) of account holder(s)"),
  and the dose line. 1 to 5 words each. p = document number.
"sender": {{"name": str, "kind": "pharmacy|gp|hospital|council|school|company|government|other", "contact": str|null}} or null.
"dates": [{{"what": short English action, "date": "YYYY-MM-DD", "time": "HH:MM"|null, "quote": the printed date words, "amount": str|null}}]
  for each thing to do by or on a date (pay by, appointment, return the form by). Not the date the letter was written.
  If the year is not printed, use the next time that date comes after today.
"unreadable_parts": [{{"p": N, "near": printed words next to it, "note": str}}] for parts you cannot read ([] if none).
"differ": [{{"field": "amount|date|dose|time", "a": str, "a_doc": N, "b": str, "b_doc": N}}] only when two different files
  say different things about the same amount, date or dose ([] if none)."""


def with_technique(facts: dict) -> dict:
    """Copy of the facts with the checked technique outline for the device type, so the rewriter covers each step."""
    outline = technique.outline_for_prompt(facts.get("device_type"))
    return {**facts, "technique_outline": outline} if outline else facts


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text())


def load_library() -> list[dict]:
    """Checked clips only. DEMO ONLY: SHOW_UNCHECKED_CLIPS=1 also returns clips that have a video but no human sign-off,
    each marked "unchecked": true so the UI shows a visible 'not yet checked' badge. Default off."""
    demo = os.environ.get("SHOW_UNCHECKED_CLIPS") == "1"
    try:
        clips = json.loads(LIBRARY.read_text()).get("clips", [])
    except Exception:
        return []
    out = [c for c in clips if c.get("checked_by")]
    if demo:
        out += [{**c, "unchecked": True} for c in clips if not c.get("checked_by") and c.get("video_url")]
    return out


_SUFFIX_MATCH = {"shake": ["shake"], "hold": ["hold your breath"],
                 "press": ["press your inhaler", "press the inhaler", "press down"]}


def _clip_keywords(clip: dict) -> list[str]:
    kw = clip.get("match") or _SUFFIX_MATCH.get(clip["id"].rsplit("_", 1)[-1], [])
    return [k.lower() for k in kw]


def _device_applies(clip_dev: str, guide_dev: str | None) -> bool:
    """A clip for "inhaler_mdi" also applies to "inhaler_mdi_spacer" (same family)."""
    return bool(guide_dev) and (clip_dev == guide_dev or guide_dev.startswith(clip_dev + "_"))


def attach_clips(guide: dict):
    dev = guide["facts"].get("device_type")
    # A clip marked "exact_device" (e.g. press without a spacer) only applies to that exact device type.
    clips = sorted((c for c in load_library() if (c["device_type"] == dev if c.get("exact_device")
                                                  else _device_applies(c["device_type"], dev))),
                   key=lambda c: c.get("order", 0))
    how = [s for s in guide["steps"] if s["kind"] == "how" and not s.get("technique_clip_id")]
    for c in clips:
        kws = _clip_keywords(c)
        for s in how:
            text = (s.get("text_en") or s.get("text") or "").lower()
            if kws and any(k in text for k in kws):
                s["technique_clip_id"] = c["id"]
                how.remove(s)
                break


def new_guide(gid: str, language: str) -> dict:
    return {"id": gid, "status": "extracting", "language": language,
            "source": {"kind": "other", "image_urls": [], "is_sample": False},
            "doc_type": "how_to", "domain": "other", "content": None, "safety_lines": [], "sender": None, "dates": [],
            "unreadable_regions": [],
            "facts": None, "steps": [], "created_at": now()}


def build_blocks(docs: list[tuple[bytes, str, str | None]]) -> list[dict]:
    """One content list for ONE extraction call: a label line plus a file block per upload, then the instruction."""
    content = []
    for i, (data, mime, role) in enumerate(docs, 1):
        content.append({"type": "text", "text": f"Document {i} (role: {role or 'detect'}):"})
        content.append(llm.file_block(data, mime))
    content.append({"type": "text", "text": f"Today is {dt.date.today().isoformat()}. Extract the facts."})
    return content


async def extract(files, device_photo=None) -> dict:
    """files: [(bytes, mime)] or [(bytes, mime, role|None)]. Returns normalise()'d output; one model call."""
    docs = [(f[0], f[1], f[2] if len(f) > 2 else None) for f in files]
    if device_photo:
        docs.append((device_photo[0], device_photo[1], "device_photo"))
    raw = await llm.complete_json(EXTRACT_SYSTEM, build_blocks(docs), 3000)
    out = normalise(raw)
    if out["facts"]["device_type"] not in DEVICE_TYPES:
        out["facts"]["device_type"] = "unknown"
    given = {i: r for i, (_, _, r) in enumerate(docs, 1) if r}
    found = {d["index"]: d["role"] for d in out["documents"]}
    out["documents"] = [{"index": i, "role": given.get(i) or (found.get(i) if found.get(i) in ROLES else "other"),
                         "role_source": "client" if i in given else "detected"} for i in range(1, len(docs) + 1)]
    return out


# What the guide adds after reading a step aloud, by step kind. English only: other languages get the
# translated step text as it is, so we never show a half-translated line.
SAY_TAIL = {"how": "Take your time.", "warning": "Take care with this one.",
            "get_help": ""}


def make_say(step: dict, language: str) -> str:
    """Deterministic default for `step.say`: the line the guide speaks in its bubble."""
    text = step.get("text") or step.get("text_en") or ""
    tail = SAY_TAIL.get(step.get("kind", ""), "") if language == "en" else ""
    return f"{text} {tail}".strip()


async def translate_steps(steps: list[dict], language: str, dates: list[dict] | None = None):
    """Steps (and the dated actions' `what`, in the same call) into the guide's language."""
    extra = [{"text_en": d.get("what_en") or d.get("what") or "", "text": d.get("what") or ""} for d in dates or []]
    await _translate(steps + extra, language)
    for d, x in zip(dates or [], extra):
        d["what"] = x.get("text") or d.get("what_en") or ""
    for s in steps:
        s["say"] = make_say(s, language)


async def translate_safety(guide: dict, language: str):
    """The app adds no safety or advice lines of its own any more: always an empty list (older guides are cleared)."""
    guide["safety_lines"] = []
    guide.pop("safety_lines_en", None)


_DIGITS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8",
           "nine": "9", "ten": "10", "once": "1 time", "twice": "2 times"}


def easy_numbers(text: str) -> str:
    """Label shouting to Easy Read: 'TWO puffs' -> '2 puffs', 'into BOTH eyes' -> 'into both eyes' (STYLE: digits)."""
    def word(m):
        w = m.group(0)
        d = _DIGITS.get(w.lower())
        if d:
            return d
        return w.lower() if len(w) > 1 and w.isupper() and w.isalpha() and w not in ("NHS", "GP") else w
    return re.sub(r"[A-Za-z]+", word, text)


def summary_line_en(guide: dict) -> str:
    f = guide.get("facts") or {}
    parts = [str(x).strip() for x in (f.get("dose"), f.get("frequency")) if x and str(x).strip()]
    # 'When needed' after a comma reads 'when needed' (keep acronyms like NHS, GP).
    parts = parts[:1] + [p[0].lower() + p[1:] if len(p) > 1 and p[0].isupper() and p[1].islower() else p for p in parts[1:]]
    line = ", ".join(parts)
    return easy_numbers(line[0].upper() + line[1:]) if line else line


async def translate_summary(guide: dict, language: str):
    """The dose / when line on the summary card, translated like the steps. The English original is kept in summary_line_en."""
    en = guide.get("summary_line_en") or summary_line_en(guide)
    if not en:
        return
    guide["summary_line_en"] = en
    if language == "en":
        guide["summary_line"] = en
        return
    if not llm.available():
        guide.setdefault("summary_line", en)
        return
    try:
        out = await llm.complete_json(
            f"Translate this medicine dose line into {langs.name_of(language)}. Keep it short and simple, keep numbers as digits, "
            "never change doses or timings. Return a JSON array with one string.", json.dumps([en], ensure_ascii=False))
        if isinstance(out, list) and len(out) == 1 and isinstance(out[0], str) and out[0].strip():
            guide["summary_line"] = out[0]
    except Exception:
        log.warning("summary line translation failed")


async def _translate(steps: list[dict], language: str):
    if language == "en":
        for s in steps:
            s["text"] = s["text_en"]
        return
    if not llm.available():
        return  # keep current text; no key to translate with
    out = await llm.complete_json(
        f"Translate each Easy Read sentence into {langs.name_of(language)}. Keep it short and simple, "
        "keep numbers as digits, never change doses or timings. Return a JSON array of strings, same order.",
        json.dumps([s["text_en"] for s in steps], ensure_ascii=False))
    for s, t in zip(steps, out):
        s["text"] = t


PICTURE_TIMEOUT_S = float(os.environ.get("PICTURE_TIMEOUT_S", "150"))


def picture_concurrency() -> int:
    """How many step pictures are made at once (PICTURE_CONCURRENCY, default 9: a whole guide at once, at least 1)."""
    try:
        return max(1, int(os.environ.get("PICTURE_CONCURRENCY", "9")))
    except ValueError:
        return 9


async def illustrate(guide: dict, emit):
    """Make step pictures concurrently (bounded). Each step goes generating -> ready/failed and emits step_updated."""
    try:
        from media import make_step_picture  # type: ignore
    except ImportError:
        make_step_picture = None
    sem = asyncio.Semaphore(picture_concurrency())

    async def one(s: dict):
        async with sem:
            try:
                s["image_url"] = await asyncio.wait_for(make_step_picture(s["picture_prompt"]), PICTURE_TIMEOUT_S)
                s["status"] = "ready"
            except Exception as e:
                log.warning("picture failed: %s", e)
                s["status"] = "failed"
            emit({"type": "step_updated", "guide_id": guide["id"], "step": s})

    todo = []
    for s in guide["steps"]:
        if s.get("image_url"):
            s["status"] = "ready"  # already illustrated (fixture or earlier run)
        elif not make_step_picture or not os.environ.get("FAL_KEY"):
            s["status"] = "skipped"  # offline: no media module or no key, not an error
        else:
            todo.append(s)
            continue
        emit({"type": "step_updated", "guide_id": guide["id"], "step": s})
    # Every queued step is "generating" up front, so the UI shows a placeholder for it straight away.
    for s in todo:
        s["status"] = "generating"
        emit({"type": "step_updated", "guide_id": guide["id"], "step": s})
    await asyncio.gather(*(one(s) for s in todo))


DEVICE_LABELS = {
    "inhaler_mdi": ["cap", "mouthpiece", "canister"],
    "inhaler_mdi_spacer": ["cap", "mouthpiece", "canister"],
    "inhaler_dry_powder": ["mouthpiece", "counter"],
    "cream_ointment": ["cap", "nozzle"],
    "eye_drops": ["cap", "nozzle"],
    "nasal_spray": ["cap", "nozzle"],
}


async def label_device_photo(guide: dict, device_photo, image_urls: list[str]):
    """ONE fal edit of the user's own device photo: numbered circles on its parts. Never blocks or fails the guide."""
    # Off by default: a live check put the numbered circles beside the device, not on its parts. DEVICE_PHOTO_LABELS=1 turns it on.
    if os.environ.get("DEVICE_PHOTO_LABELS") != "1" or not device_photo or not os.environ.get("FAL_KEY"):
        return
    labels = DEVICE_LABELS.get((guide.get("facts") or {}).get("device_type"))
    if not labels:
        return
    try:
        from media import annotate_photo  # type: ignore
        data, mime = device_photo[0], device_photo[1]
        uri = f"data:{mime};base64,{base64.b64encode(data).decode()}"
        url = await asyncio.wait_for(annotate_photo(uri, labels, numbered=True), PICTURE_TIMEOUT_S)
        guide["source"]["device_photo_url"] = image_urls[-1] if image_urls else None
        guide["source"]["device_photo_labelled_url"] = url
        guide["source"]["device_photo_labels"] = labels
    except Exception as e:
        log.warning("device photo labels skipped: %s", e)


async def write_typed(facts: dict, language: str, dt: str, content: dict) -> list[dict]:
    """letter/bill/form: tuned rewriter with doc_type + content; fall back to the deterministic steps."""
    if dt in ("letter", "bill", "form"):
        try:
            raw = await write_easy_read(facts, language, dt, content)
            if raw and all(isinstance(r, dict) and r.get("text_en") for r in raw):
                return [{"text_en": r["text_en"], "kind": r.get("kind") or "how",
                         "picture_prompt": r.get("picture_prompt") or "a person doing one simple task"} for r in raw]
        except Exception as e:
            log.warning("typed rewrite failed, using content steps: %s", e)
    return content_to_steps(dt, content)


NOT_READABLE = {"not_a_document": "This is not a photo of a paper. Try another.",
                "unreadable": "We could not read this photo. Take a clearer photo in good light."}


def not_readable(ex: dict) -> str | None:
    """'not_a_document' (a drawing, a selfie) or 'unreadable' (no words could be read), else None. A guide made from
    nothing would be invented, so these stop with a clear message instead."""
    if not ex.get("is_document", True):
        return "not_a_document"
    if nothing_read(ex["facts"], ex["content"]):
        return "unreadable"
    return None


async def place_on_paper(guide: dict, ex: dict, files, ocr_task) -> None:
    """Highlights, number cards, checked dates and unreadable regions from the OCR of the user's own pages.
    Never fails the guide: without OCR, steps simply have no highlights."""
    import time
    t = time.perf_counter()
    try:
        pages = await ocr_task if ocr_task else [None] * len(files)
    except Exception as e:
        log.warning("ocr skipped: %s", e)
        pages = [None] * len(files)
    wait_ms = int((time.perf_counter() - t) * 1000)
    try:
        pdfs = [locate.pdf_text(f[0]) if f[1] == "application/pdf" else "" for f in files]
        locate.ground_urgency(guide["steps"], locate.page_words(pages, pdfs))
        stats = locate.attach(guide, ex.get("quotes") or [], pages)
        ocr_ok = any(p is not None for p in pages) or any(pdfs)
        guide["dates"] = locate.check_dates(ex.get("dates") or [], pages, pdfs, ocr_ok)
        guide["unreadable_regions"] = locate.unreadable_regions(pages, ex.get("unreadable_parts") or [])
        log.info("located %d/%d quotes; %d/%d dates kept; ocr wait %d ms", stats["located"], stats["quotes"],
                 len(guide["dates"]), len(ex.get("dates") or []), wait_ms)
    except Exception:
        log.exception("placing quotes failed")


async def run(store, gid: str, files, device_photo, language: str, image_urls: list[str]):
    guide = store.get(gid)

    def status(st):
        guide["status"] = st
        store.put(guide)
        store.emit(gid, {"type": "guide_status", "guide_id": gid, "status": st})

    def emit(e):
        store.put(guide)
        store.emit(gid, e)

    ocr_task = None
    try:
        status("extracting")
        if llm.available():
            # OCR the stored pages in worker threads while the model reads them (adds no time when it finishes first).
            ocr_task = asyncio.create_task(locate.ocr_pages(locate.page_bytes(image_urls[:len(files)], files)))
            ex = await extract(files, device_photo)
            facts, dt, domain = ex["facts"], ex["doc_type"], ex["domain"]
            problem = not_readable(ex)
            if problem:
                guide.update(facts=facts, error_code=problem, error=NOT_READABLE[problem])
                guide["source"]["image_urls"] = image_urls
                status("failed")
                return
            guide["source"]["kind"] = ex["source_kind"]
            guide["source"]["image_urls"] = image_urls
            guide["source"]["documents"] = [{**d, "image_url": image_urls[d["index"] - 1] if d["index"] <= len(image_urls) else None}
                                            for d in ex["documents"]]
            if domain == "medicine":
                # No device photo: the label/leaflet text may still name the device (Evohaler, pressurised inhaler).
                dev = postprocess.device_from_facts(facts)
                if dev and dev != facts.get("device_type"):
                    facts["device_type"] = dev
            guide.update(doc_type=dt, domain=domain, content=ex["content"], facts=facts, safety_lines=[],
                         sender=ex.get("sender"))
            status("writing")
            if ex["content"] is not None:
                raw = ensure_content_facts(await write_typed(facts, language, dt, ex["content"]), dt, ex["content"])
            elif domain != "medicine":
                raw = await write_generic_howto(facts, language)
            else:
                raw = await write_easy_read(with_technique(facts), language)
            raw = finish_steps(raw, dt, domain, facts["conflicts"], facts.get("device_type"))
            guide["steps"] = [{"index": i, "text": r["text_en"], "text_en": r["text_en"], "kind": r["kind"],
                               "picture_prompt": r["picture_prompt"], "image_url": None,
                               "technique_clip_id": None, "status": "pending", "visual": r.get("visual")} for i, r in enumerate(raw)]
            await place_on_paper(guide, ex, files, ocr_task)
            await translate_steps(guide["steps"], language, guide.get("dates"))
            await translate_safety(guide, language)
            await translate_summary(guide, language)
        elif os.environ.get("EASYREAD_ALLOW_FIXTURE") != "1":
            # No key: never pass the inhaler sample off as the user's own paper. Samples (?demo=1, #/sample) are client-side.
            guide.update(error_code="demo_mode_no_key",
                         error="Demo mode: this server has no AI key, so it cannot read your photo. Open a sample instead.")
            guide["source"]["image_urls"] = image_urls
            status("failed")
            return
        else:
            fx = load_fixture()
            guide["source"] = {**fx["source"], "image_urls": image_urls}
            guide["facts"], guide["steps"] = fx["facts"], fx["steps"]
            guide["doc_type"], guide["domain"] = fx.get("doc_type", "how_to"), fx.get("domain", "medicine")
            guide["content"], guide["safety_lines"] = fx.get("content"), []
            await asyncio.sleep(0.3)
            status("writing")
            await asyncio.sleep(0.3)
            await translate_steps(guide["steps"], language)
            await translate_safety(guide, language)
            await translate_summary(guide, language)
        attach_clips(guide)
        status("illustrating")
        await asyncio.gather(illustrate(guide, emit), label_device_photo(guide, device_photo, image_urls))
        store.put(guide)
        status("ready")
    except llm.LLMError as e:
        if ocr_task:
            ocr_task.cancel()
        log.warning("pipeline failed: %s", e.code)
        guide.update(error_code=e.code, error=e.detail)
        status("failed")
    except Exception as e:
        log.exception("pipeline failed")
        guide["error"] = str(e)
        status("failed")
