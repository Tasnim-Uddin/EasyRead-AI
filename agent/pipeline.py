"""Guide pipeline: extract -> identify device -> Easy Read rewrite -> pictures. Falls back to the fixture without keys."""
import asyncio, copy, json, os, pathlib, datetime as dt, logging
from . import llm
from .docs import ROLES
from .rewriter import write_easy_read
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
- letter, bill, other: "what_this_is": one Easy Read sentence; "what_to_do": [short action sentences, action first];
  "by_when": [{{"date": str, "what": str}}]; "amounts": [{{"what": str, "amount": str}}]
- form: "fields": [{{"label": str, "what_to_write": str}}] in Easy Read words, one per box on the form"""


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text())


def load_library() -> list[dict]:
    try:
        return [c for c in json.loads(LIBRARY.read_text()).get("clips", []) if c.get("checked_by")]
    except Exception:
        return []


def attach_clips(guide: dict):
    dev = guide["facts"].get("device_type")
    clips = sorted((c for c in load_library() if c["device_type"] == dev), key=lambda c: c.get("order", 0))
    how = [s for s in guide["steps"] if s["kind"] == "how" and not s.get("technique_clip_id")]
    for s, c in zip(how, clips):
        s["technique_clip_id"] = c["id"]


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


async def translate_steps(steps: list[dict], language: str):
    if language == "en":
        for s in steps:
            s["text"] = s["text_en"]
        return
    if not llm.available():
        return  # keep current text; no key to translate with
    out = await llm.complete_json(
        f"Translate each Easy Read sentence into BCP-47 language '{language}'. Keep it short and simple, "
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
                raw = content_to_steps(dt, ex["content"])
            else:
                raw = await write_easy_read(facts, language)
            raw = finish_steps(raw, dt, domain, facts["conflicts"])
            guide["steps"] = [{"index": i, "text": r["text_en"], "text_en": r["text_en"], "kind": r["kind"],
                               "picture_prompt": r["picture_prompt"], "image_url": None,
                               "technique_clip_id": None, "status": "pending"} for i, r in enumerate(raw)]
            await translate_steps(guide["steps"], language)
        else:
            fx = load_fixture()
            guide["source"] = {**fx["source"], "image_urls": image_urls}
            guide["facts"], guide["steps"] = fx["facts"], fx["steps"]
            guide["doc_type"], guide["domain"] = fx.get("doc_type", "how_to"), fx.get("domain", "medicine")
            guide["content"], guide["safety_lines"] = fx.get("content"), fx.get("safety_lines") or safety_lines("how_to", "medicine")
            await asyncio.sleep(0.3)
            status("writing")
            await asyncio.sleep(0.3)
            if language != "en":
                await translate_steps(guide["steps"], language)
        attach_clips(guide)
        status("illustrating")
        await illustrate(guide, emit)
        status("ready")
    except Exception as e:
        log.exception("pipeline failed")
        guide["error"] = str(e)
        status("failed")
