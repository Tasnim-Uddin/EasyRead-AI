"""Guide pipeline: extract -> identify device -> Easy Read rewrite -> pictures. Falls back to the fixture without keys."""
import asyncio, copy, json, pathlib, datetime as dt, logging
from . import llm
from .rewriter import write_easy_read

log = logging.getLogger("agent.pipeline")
ROOT = pathlib.Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "demo" / "fixtures" / "guide_inhaler.json"
LIBRARY = ROOT / "library" / "index.json"
DEVICE_TYPES = ["inhaler_mdi", "inhaler_mdi_spacer", "inhaler_dry_powder", "cream_ointment", "tablets",
                "eye_drops", "nasal_spray", "unknown"]

EXTRACT_SYSTEM = f"""You read a photo or PDF of a medicine label, leaflet or letter and extract facts.
Copy only what is in the document; never invent. Use null for anything absent. Put anything you cannot read in "unreadable".
If a photo of the user's actual device is included, use it to set device_type (a metered-dose inhaler is shaken; a dry-powder inhaler is not).
device_type is one of {DEVICE_TYPES}. Return JSON only:
{{"kind": "prescription|leaflet|letter|other", "medicine": str|null, "dose": str|null, "frequency": str|null,
"route": str|null, "device_type": str, "device_confidence": number 0-1, "warnings": [str], "get_help": [str], "unreadable": [str]}}"""


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
            "facts": None, "steps": [], "created_at": now()}


async def extract(files: list[tuple[bytes, str]], device_photo: tuple[bytes, str] | None) -> dict:
    content = [llm.file_block(d, m) for d, m in files]
    if device_photo:
        content.append({"type": "text", "text": "The next image is the user's own device photo."})
        content.append(llm.file_block(*device_photo))
    content.append({"type": "text", "text": "Extract the facts."})
    f = await llm.complete_json(EXTRACT_SYSTEM, content)
    if f.get("device_type") not in DEVICE_TYPES:
        f["device_type"] = "unknown"
    return f


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
        if make_step_picture and not s.get("image_url"):
            s["status"] = "generating"
            emit({"type": "step_updated", "guide_id": guide["id"], "step": s})
            try:
                s["image_url"] = await make_step_picture(s["picture_prompt"])
                s["status"] = "ready"
            except Exception as e:
                log.warning("picture failed: %s", e)
                s["status"] = "failed"
        else:
            s["status"] = "ready"
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
            facts = await extract(files, device_photo)
            guide["source"]["kind"] = facts.pop("kind", "other")
            guide["source"]["image_urls"] = image_urls
            guide["facts"] = facts
            status("writing")
            raw = await write_easy_read(facts, language)
            guide["steps"] = [{"index": i, "text": r["text_en"], "text_en": r["text_en"], "kind": r["kind"],
                               "picture_prompt": r["picture_prompt"], "image_url": None,
                               "technique_clip_id": None, "status": "pending"} for i, r in enumerate(raw)]
            await translate_steps(guide["steps"], language)
        else:
            fx = load_fixture()
            guide["source"] = {**fx["source"], "image_urls": image_urls}
            guide["facts"], guide["steps"] = fx["facts"], fx["steps"]
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
