"""Guide pipeline: extract -> identify device -> Easy Read rewrite -> pictures. Falls back to the fixture without keys."""
import asyncio, base64, copy, json, os, pathlib, datetime as dt, logging
from . import langs, llm, technique
from .docs import ROLES
from .rewriter import write_easy_read, write_generic_howto
from .doctypes import STYLE_RULES, content_to_steps, finish_steps, normalise, safety_lines

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

First classify the whole set. doc_type is one of:
- how_to: something to use or take, such as a medicine (set domain "medicine")
- letter: a letter or notice that asks the reader to do something
- bill: a bill, invoice or fine
- form: a form the reader must fill in
- other: anything else
domain is one of medicine, money, legal, school, council, other.

{STYLE_RULES}

Return JSON only. Always include: "doc_type", "domain", "kind" (prescription|leaflet|letter|other),
"documents": [{{"index": N, "role": str}}] for every file, "unreadable": [str].
Then, by doc_type:
- how_to (medicine): "medicine", "dose", "frequency", "route", "device_type", "device_confidence" (0-1), "warnings": [str], "get_help": [str]
  (copy warnings and get_help faithfully). device_type is one of {DEVICE_TYPES}; if a device_photo is included, use it
  (a metered-dose inhaler is shaken; a dry-powder inhaler is not). If both a label and a leaflet are present, also give
  "label": {{"dose", "frequency"}} and "leaflet": {{"dose", "frequency"}} exactly as each one says. Do not merge them yourself.
- how_to (not medicine, for example furniture, a phone, a boiler): "title", "source_steps": [the document's own steps, in order,
  one action each, copied faithfully], "warnings": [str], "get_help": [str]. Leave the medicine fields null.
- letter, bill, other: "what_this_is": one Easy Read sentence; "what_to_do": [at most 3 short action sentences, action first, in the order to do them; never repeat a date or amount that is already in by_when or amounts];
  "by_when": [{{"date": str, "what": str}}]; "amounts": [{{"what": str, "amount": str}}]
- form: "fields": [{{"label": str, "what_to_write": str}}] in Easy Read words, one per box on the form"""


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
            "doc_type": "how_to", "domain": "other", "content": None, "safety_lines": [],
            "facts": None, "steps": [], "created_at": now()}


def build_blocks(docs: list[tuple[bytes, str, str | None]]) -> list[dict]:
    """One content list for ONE extraction call: a label line plus a file block per upload, then the instruction."""
    content = []
    for i, (data, mime, role) in enumerate(docs, 1):
        content.append({"type": "text", "text": f"Document {i} (role: {role or 'detect'}):"})
        content.append(llm.file_block(data, mime))
    content.append({"type": "text", "text": "Extract the facts."})
    return content


async def extract(files, device_photo=None) -> dict:
    """files: [(bytes, mime)] or [(bytes, mime, role|None)]. Returns normalise()'d output; one model call."""
    docs = [(f[0], f[1], f[2] if len(f) > 2 else None) for f in files]
    if device_photo:
        docs.append((device_photo[0], device_photo[1], "device_photo"))
    raw = await llm.complete_json(EXTRACT_SYSTEM, build_blocks(docs), 2500)
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


async def translate_steps(steps: list[dict], language: str):
    await _translate(steps, language)
    for s in steps:
        s["say"] = make_say(s, language)


async def translate_safety(guide: dict, language: str):
    """The 999 / pharmacist / advice lines must read in the guide's language. The English originals are kept."""
    en = guide.setdefault("safety_lines_en", list(guide.get("safety_lines") or []))
    if language == "en" or not en:
        guide["safety_lines"] = list(en)
        return
    if not llm.available():
        return
    try:
        out = await llm.complete_json(
            f"Translate each safety sentence into {langs.name_of(language)}. Keep it short and simple, keep numbers such as 999 and 111 "
            "as digits, never weaken or change the meaning. Return a JSON array of strings, same order.",
            json.dumps(en, ensure_ascii=False))
        if isinstance(out, list) and len(out) == len(en) and all(isinstance(x, str) and x.strip() for x in out):
            guide["safety_lines"] = out
    except Exception:
        log.warning("safety line translation failed")


def summary_line_en(guide: dict) -> str:
    f = guide.get("facts") or {}
    return ", ".join(str(x) for x in (f.get("dose"), f.get("frequency")) if x)


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


async def illustrate(guide: dict, emit):
    try:
        from media import make_step_picture  # type: ignore
    except ImportError:
        make_step_picture = None
    for s in guide["steps"]:
        if s.get("image_url"):
            s["status"] = "ready"  # already illustrated (fixture or earlier run)
        elif not make_step_picture or not os.environ.get("FAL_KEY"):
            s["status"] = "skipped"  # offline: no media module or no key, not an error
        else:
            s["status"] = "generating"
            emit({"type": "step_updated", "guide_id": guide["id"], "step": s})
            try:
                s["image_url"] = await make_step_picture(s["picture_prompt"])
                s["status"] = "ready"
            except Exception as e:
                log.warning("picture failed: %s", e)
                s["status"] = "failed"
        emit({"type": "step_updated", "guide_id": guide["id"], "step": s})


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
    if not device_photo or not os.environ.get("FAL_KEY"):
        return
    labels = DEVICE_LABELS.get((guide.get("facts") or {}).get("device_type"))
    if not labels:
        return
    try:
        from media import annotate_photo  # type: ignore
        data, mime = device_photo[0], device_photo[1]
        uri = f"data:{mime};base64,{base64.b64encode(data).decode()}"
        url = await annotate_photo(uri, labels, numbered=True)
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


async def run(store, gid: str, files, device_photo, language: str, image_urls: list[str]):
    guide = store.get(gid)

    def status(st):
        guide["status"] = st
        store.put(guide)
        store.emit(gid, {"type": "guide_status", "guide_id": gid, "status": st})

    def emit(e):
        store.put(guide)
        store.emit(gid, e)

    try:
        status("extracting")
        if llm.available():
            ex = await extract(files, device_photo)
            facts, dt, domain = ex["facts"], ex["doc_type"], ex["domain"]
            guide["source"]["kind"] = ex["source_kind"]
            guide["source"]["image_urls"] = image_urls
            guide["source"]["documents"] = [{**d, "image_url": image_urls[d["index"] - 1] if d["index"] <= len(image_urls) else None}
                                            for d in ex["documents"]]
            guide.update(doc_type=dt, domain=domain, content=ex["content"], facts=facts,
                         safety_lines=safety_lines(dt, domain))
            status("writing")
            if ex["content"] is not None:
                raw = await write_typed(facts, language, dt, ex["content"])
            elif domain != "medicine":
                raw = await write_generic_howto(facts, language)
            else:
                raw = await write_easy_read(with_technique(facts), language)
            raw = finish_steps(raw, dt, domain, facts["conflicts"], facts.get("device_type"))
            guide["steps"] = [{"index": i, "text": r["text_en"], "text_en": r["text_en"], "kind": r["kind"],
                               "picture_prompt": r["picture_prompt"], "image_url": None,
                               "technique_clip_id": None, "status": "pending"} for i, r in enumerate(raw)]
            await translate_steps(guide["steps"], language)
            await translate_safety(guide, language)
            await translate_summary(guide, language)
        else:
            fx = load_fixture()
            guide["source"] = {**fx["source"], "image_urls": image_urls}
            guide["facts"], guide["steps"] = fx["facts"], fx["steps"]
            guide["doc_type"], guide["domain"] = fx.get("doc_type", "how_to"), fx.get("domain", "medicine")
            guide["content"], guide["safety_lines"] = fx.get("content"), fx.get("safety_lines") or safety_lines("how_to", "medicine")
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
    except Exception as e:
        log.exception("pipeline failed")
        guide["error"] = str(e)
        status("failed")
