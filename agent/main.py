"""EasyRead AI server. Run from repo root: uvicorn agent.main:app --reload --port 8000"""
import asyncio, json, os, pathlib, time, uuid, tempfile
import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import llm, persona, pipeline, qa
from .store import Store

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="EasyRead AI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
store = Store()
UPLOADS = pathlib.Path(os.environ.get("UPLOAD_DIR", tempfile.gettempdir())) / "easyread_uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOADS), name="uploads")
_tasks: set = set()


class LangReq(BaseModel):
    language: str = "en"


class AskReq(BaseModel):
    question: str
    language: str = "en"


class SessionReq(BaseModel):
    guide_id: str
    language: str = "en"


class CheckReq(BaseModel):
    answer: str | None = None
    language: str = "en"


def _guide(gid: str) -> dict:
    g = store.get(gid)
    if not g:
        raise HTTPException(404, "guide not found")
    return g


async def _save(f: UploadFile, gid: str):
    data = await f.read()
    mt = f.content_type or "application/octet-stream"
    name = f"{gid}_{uuid.uuid4().hex[:6]}_{pathlib.Path(f.filename or 'file').name}"
    (UPLOADS / name).write_bytes(data)
    return (data, mt), f"/api/uploads/{name}"


@app.get("/api/health")
def health():
    return {"ok": True, "anthropic": llm.available(), "anam": bool(os.environ.get("ANAM_API_KEY")),
            "mongo": store._col is not None}


@app.post("/api/guides")
async def create_guide(document: list[UploadFile] = File(default=[]), device_photo: UploadFile | None = File(None),
                       language: str = Form("en")):
    gid = "g_" + uuid.uuid4().hex[:10]
    files, urls = [], []
    for d in document:
        blob, url = await _save(d, gid)
        files.append(blob)
        urls.append(url)
    dev = None
    if device_photo is not None and device_photo.filename:
        dev, _ = await _save(device_photo, gid)
    if not files and llm.available():
        raise HTTPException(400, "document required")
    g = pipeline.new_guide(gid, language)
    store.put(g)
    t = asyncio.create_task(pipeline.run(store, gid, files, dev, language, urls))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return {"guide_id": gid}


@app.get("/api/guides/{gid}")
def get_guide(gid: str):
    return _guide(gid)


@app.get("/api/guides/{gid}/events")
async def events(gid: str, once: bool = False):
    """SSE. `once=1` closes after the guide reaches ready/failed (handy for tests and curl)."""
    _guide(gid)
    q = store.subscribe(gid)

    async def gen():
        try:
            while True:
                try:
                    e = await asyncio.wait_for(q.get(), 15)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                yield f"data: {json.dumps(e, ensure_ascii=False)}\n\n"
                if once and e.get("type") == "guide_status" and e["status"] in ("ready", "failed"):
                    return
        finally:
            store.unsubscribe(gid, q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/api/guides/{gid}/language")
async def set_language(gid: str, req: LangReq):
    g = _guide(gid)
    try:
        await pipeline.translate_steps(g["steps"], req.language)
    except Exception:
        pass  # keep existing text if translation fails
    g["language"] = req.language
    store.put(g)
    for s in g["steps"]:
        store.emit(gid, {"type": "step_updated", "guide_id": gid, "step": s})
    return g


@app.post("/api/guides/{gid}/ask")
async def ask(gid: str, req: AskReq):
    t = time.perf_counter()
    r = await qa.ask(_guide(gid), req.question, req.language)
    store.emit(gid, {"type": "tool_log", "tool": "answer_from_document", "args": {"question": req.question},
                     "ms": int((time.perf_counter() - t) * 1000)})
    return r


@app.post("/api/guides/{gid}/check_understanding")
async def check_understanding(gid: str, req: CheckReq):
    g = _guide(gid)
    f = g.get("facts") or {}
    if not req.answer:
        say = "Can you tell me in your own words how many puffs, and when you use it?" if f.get("device_type", "").startswith("inhaler") \
            else "Can you tell me in your own words how much to take, and when?"
        return {"say": say, "correct": None}
    words = qa._words(req.answer)
    key = qa._words(" ".join(str(f.get(k) or "") for k in ("dose", "frequency")))
    ok = bool(key) and len(words & key) >= max(1, len(key) // 2)
    say = ("Well done, that is right." if ok else
           f"Nearly. Remember: {f.get('dose')}, {f.get('frequency')}. Please ask your pharmacist if unsure.")
    return {"say": say, "correct": ok}


@app.post("/api/tools/{name}")
async def tool(name: str, body: dict):
    """Server-side Anam tools. Body: {guide_id, ...args}. Returns {say, ...}."""
    gid = body.get("guide_id", "")
    lang = body.get("language", _guide(gid).get("language", "en"))
    if name == "answer_from_document":
        r = await ask(gid, AskReq(question=body.get("question", ""), language=lang))
        return {"say": r["answer"], **r}
    if name == "check_understanding":
        return await check_understanding(gid, CheckReq(answer=body.get("answer"), language=lang))
    if name == "set_language":
        g = await set_language(gid, LangReq(language=body.get("language", "en")))
        return {"say": "Okay, I changed the language.", "language": g["language"], "guide": g}
    raise HTTPException(404, "unknown tool")


@app.post("/api/anam/session")
async def anam_session(req: SessionReq):
    g = _guide(req.guide_id)
    cfg = persona.persona_config(g, req.language)
    key = os.environ.get("ANAM_API_KEY")
    if not key:
        return {"sessionToken": "dev-mock-token", "mock": True, "personaConfig": cfg}
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post("https://api.anam.ai/v1/auth/session-token",
                         headers={"Authorization": f"Bearer {key}"}, json={"personaConfig": cfg})
    if r.status_code >= 400:
        raise HTTPException(502, f"Anam token request failed ({r.status_code}): {r.text[:300]}")
    return {"sessionToken": r.json()["sessionToken"]}


@app.get("/api/library")
def library():
    return {"clips": pipeline.load_library()}


@app.get("/api/guides/{gid}/sheet", response_class=HTMLResponse)
def sheet(gid: str):
    g = _guide(gid)
    items = "".join(f"<li><div class=p>{'<img src=\"%s\">' % s['image_url'] if s.get('image_url') else ''}</div>"
                    f"<p>{s['text']}</p></li>" for s in g["steps"])
    return (f"<!doctype html><meta charset=utf-8><title>Easy Read</title><style>body{{font:24px sans-serif;max-width:800px;margin:auto}}"
            f"li{{margin:1em 0;page-break-inside:avoid}}img{{max-width:240px}}</style><h1>{(g['facts'] or {}).get('medicine') or 'Your guide'}</h1><ol>{items}</ol>")
