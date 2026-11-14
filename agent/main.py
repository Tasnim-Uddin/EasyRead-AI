"""EasyRead AI server. Run from repo root: uvicorn agent.main:app --reload --port 8000"""
import asyncio, hmac, json, os, pathlib, re, time, uuid, tempfile
import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from . import docs, langs, llm, persona, pipeline, qa, tellback, tts
from . import sheet as sheet_mod
from .store import Store

if not os.environ.get("EASYREAD_NO_DOTENV"):  # tests set this so a real .env never leaks in
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

app = FastAPI(title="EasyRead AI")


def _access_ok(request: Request, code: str) -> bool:
    given = request.headers.get("x-access-code") or request.cookies.get("er_access") or ""
    return hmac.compare_digest(given.encode(), code.encode())


@app.middleware("http")
async def access_gate(request: Request, call_next):
    """Optional shared-code gate for sharing a test build. Off unless ACCESS_CODE is set. With it set, every /api/*
    request needs the code (cookie er_access or header X-Access-Code). Visiting any page with ?code=... sets the cookie."""
    code = os.environ.get("ACCESS_CODE", "")
    if not code or request.method == "OPTIONS":
        return await call_next(request)
    if request.url.path.startswith("/api/") and not _access_ok(request, code):
        return JSONResponse({"error": "access_code_required", "detail": "Enter the access code."}, status_code=401)
    response = await call_next(request)
    given = request.query_params.get("code")
    if given and hmac.compare_digest(given.encode(), code.encode()):
        response.set_cookie("er_access", code, max_age=60 * 60 * 24 * 30, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https")
    return response


store = Store()
UPLOADS = pathlib.Path(os.environ.get("UPLOAD_DIR", tempfile.gettempdir())) / "easyread_uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOADS), name="uploads")
_CLIPS = pathlib.Path(__file__).resolve().parents[1] / "library" / "clips"
if _CLIPS.is_dir():
    app.mount("/api/library/clips", StaticFiles(directory=_CLIPS), name="library_clips")
_tasks: set = set()

FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "demo" / "fixtures"


def load_samples(directory: pathlib.Path = FIXTURES) -> list[str]:
    """Load the built-in sample guides (demo/fixtures/guide_*.json, read-only) under their own stable ids
    (g_sample_inhaler, g_sample_council_letter, g_sample_flatpack, plus the i18n/ translations such as g_sample_inhaler_es), so the avatar and Q&A work on them."""
    ids = []
    # cached/guide_*.json are saved real runs (demo/cache_run.py), served the same way as the samples
    for f in sorted(directory.glob("guide_*.json")) + sorted((directory / "cached").glob("guide_*.json")) + sorted((directory / "i18n").glob("guide_*.json")):
        try:
            g = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(g, dict) and str(g.get("id", "")).startswith("g_sample"):
            store.guides[g["id"]] = g  # memory only: never mirrored to MongoDB
            ids.append(g["id"])
    return ids


load_samples()


class _Lang(BaseModel):
    """Any language code or name is accepted, cut down to letters, hyphens and spaces (max 40) before it can reach a prompt."""
    language: str = "en"

    @field_validator("language", mode="before")
    @classmethod
    def _clean_language(cls, v):
        return langs.clean(v)


class LangReq(_Lang):
    pass


class AskReq(_Lang):
    question: str


class TTSReq(_Lang):
    text: str


class SessionReq(_Lang):
    guide_id: str
    step_index: int = 0


class CheckReq(_Lang):
    answer: str | None = None
    correct: bool | None = None  # the on-screen multiple-choice result; when set, the server only speaks it


def _guide(gid: str) -> dict:
    g = store.get(gid)
    if not g:
        raise HTTPException(404, "guide not found")
    return g


def _store_file(f: UploadFile, data: bytes, gid: str) -> str:
    name = f"{gid}_{uuid.uuid4().hex[:6]}_{pathlib.Path(f.filename or 'file').name}"
    (UPLOADS / name).write_bytes(data)
    return f"/api/uploads/{name}"


@app.get("/api/health")
def health():
    return {"ok": True, "anthropic": llm.available(), "anam": bool(os.environ.get("ANAM_API_KEY")),
            "mongo": store._col is not None}


@app.post("/api/guides")
async def create_guide(document: list[UploadFile] = File(default=[]), device_photo: UploadFile | None = File(None),
                       language: str = Form("en"), roles: str | None = Form(None)):
    """One or several files (images and/or PDFs). `roles`: optional JSON array or comma list aligned with `document`."""
    gid = "g_" + uuid.uuid4().hex[:10]
    language = langs.clean(language)
    try:
        role_list = docs.parse_roles(roles, len(document))
        files, raw_files = [], []
        for d, role in zip(document, role_list):
            data = await d.read()
            mt = docs.sniff(data, d.content_type)
            if mt is None:
                raise docs.UploadError(400, "unsupported_file_type", f"We could not use {d.filename or 'this file'}. Add a photo (JPEG, PNG, WebP, GIF) or a PDF.")
            files.append((data, mt, role))
            raw_files.append((d, data))
        dev = None
        if device_photo is not None and device_photo.filename:
            data = await device_photo.read()
            mt = docs.sniff(data, device_photo.content_type)
            if mt is None or mt == "application/pdf":
                raise docs.UploadError(400, "unsupported_file_type", "We could not use this device photo. Add a JPEG, PNG, WebP or GIF photo.")
            dev = (data, mt)
        docs.check_limits([(f[0], f[1]) for f in files] + ([dev] if dev else []))
    except docs.UploadError as e:
        return JSONResponse({"error": e.error, "detail": e.detail}, status_code=e.status)
    if not files and llm.available():
        return JSONResponse({"error": "document_required", "detail": "We did not get a paper. Add a photo or PDF and try again."}, status_code=400)
    urls = [_store_file(d, data, gid) for d, data in raw_files]
    if dev:
        urls.append(_store_file(device_photo, dev[0], gid))
    g = pipeline.new_guide(gid, language)
    store.put(g)
    t = asyncio.create_task(pipeline.run(store, gid, files, dev, language, urls))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return {"guide_id": gid}


MAX_LIST_IDS = 200


@app.get("/api/guides")
def list_guides(ids: str = ""):
    """"My papers": summaries of the guides whose ids this device kept (comma list), newest first. Never a global
    list: no ids means an empty list, so one phone never sees another person's papers."""
    wanted = [i.strip() for i in ids.split(",") if i.strip()][:MAX_LIST_IDS]
    return {"guides": store.summaries(wanted)}


@app.get("/api/guides/{gid}")
def get_guide(gid: str):
    return _guide(gid)


@app.delete("/api/guides/{gid}")
def delete_guide(gid: str):
    """Removes a guide, its saved JSON and its uploaded files. Samples cannot be deleted."""
    if not store.delete(gid):
        raise HTTPException(404, "guide not found")
    for f in (UPLOADS.glob(f"{gid}_*") if re.fullmatch(r"g_[A-Za-z0-9-]+", gid) else []):
        try:
            f.unlink()
        except OSError:
            pass
    return {"deleted": gid}


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
    await pipeline.translate_safety(g, req.language)
    await pipeline.translate_summary(g, req.language)
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
    lang = req.language if "language" in req.model_fields_set else g.get("language", "en")
    t = tellback.strings(lang)
    conflict = bool(f.get("conflicts"))
    if req.correct is not None:
        # The screen already graded the user's choice: speak that verdict, never re-grade it here.
        if conflict:
            return {"say": t["conflict_ok"] if req.correct else t["conflict_bad"], "correct": req.correct}
        return {"say": t["ok"] if req.correct else t["nearly"].format(dose=f.get("dose"), frequency=f.get("frequency")),
                "correct": req.correct}
    if conflict:
        # The label and the leaflet disagree: never quiz a dose as if one of them were right.
        if not req.answer:
            return {"say": t["conflict_ask"], "correct": None}
        ok = tellback.mentions_pharmacist(lang, req.answer)
        return {"say": t["conflict_ok"] if ok else t["conflict_bad"], "correct": ok}
    if not req.answer:
        say = t["ask_inhaler"] if f.get("device_type", "").startswith("inhaler") else t["ask_other"]
        return {"say": say, "correct": None}
    words = qa._words(req.answer)
    key = qa._words(" ".join(str(f.get(k) or "") for k in ("dose", "frequency")))
    ok = bool(key) and len(words & key) >= max(1, len(key) // 2)
    say = t["ok"] if ok else t["nearly"].format(dose=f.get("dose"), frequency=f.get("frequency"))
    return {"say": say, "correct": ok}


@app.post("/api/tools/{name}")
async def tool(name: str, body: dict):
    """Server-side Anam tools. Body: {guide_id, ...args}. Returns {say, ...}."""
    gid = body.get("guide_id", "")
    lang = langs.clean(body.get("language", _guide(gid).get("language", "en")))
    if name == "answer_from_document":
        r = await ask(gid, AskReq(question=body.get("question", ""), language=lang))
        return {"say": r["answer"], **r}
    if name == "check_understanding":
        return await check_understanding(gid, CheckReq(answer=body.get("answer"), correct=body.get("correct"), language=lang))
    if name == "set_language":
        g = await set_language(gid, LangReq(language=langs.clean(body.get("language", "en"))))
        return {"say": "Okay, I changed the language.", "language": g["language"], "guide": g}
    raise HTTPException(404, "unknown tool")


@app.post("/api/anam/session")
async def anam_session(req: SessionReq):
    g = _guide(req.guide_id)
    step = max(0, min(req.step_index, len(g.get("steps", [])) - 1))
    cfg = persona.persona_config(g, req.language, step)
    key = os.environ.get("ANAM_API_KEY")
    if not key:
        return {"sessionToken": "dev-mock-token", "mock": True, "personaConfig": cfg, "stt_supported": persona.stt_supported(req.language)}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://api.anam.ai/v1/auth/session-token",
                             headers={"Authorization": f"Bearer {key}"},
                             json={"clientLabel": "easyread-web", "expiresInSeconds": 600, "personaConfig": cfg})
    except httpx.HTTPError:
        raise HTTPException(502, "The avatar service did not answer.")
    if r.status_code >= 400:
        # The upstream body is not echoed: it can name the key or plan. The web app falls back to the stand-in.
        raise HTTPException(502, f"Anam token request failed ({r.status_code}).")
    return {"sessionToken": r.json()["sessionToken"], "stt_supported": persona.stt_supported(req.language)}


@app.post("/api/tts")
async def tts_endpoint(req: TTSReq):
    text = req.text.strip()
    if not text:
        return JSONResponse({"error": "text_required", "detail": "There is nothing to read aloud. Add some text and try again."}, status_code=400)
    if len(text) > tts.MAX_CHARS:
        return JSONResponse({"error": "text_too_long", "detail": f"This text is too long to read aloud. Use {tts.MAX_CHARS} characters or fewer."}, status_code=413)
    if not tts.supported(req.language):
        return JSONResponse({"error": "tts_unsupported_language",
                             "detail": "A voice is not available for this language. You can read the words on the screen."}, status_code=422)
    if not tts.api_key():
        return JSONResponse({"error": "tts_unavailable", "detail": "The voice is not available now. Use the voice in your browser."},
                            status_code=503)
    try:
        audio = await tts.synthesize(text, req.language)
    except Exception as e:
        return JSONResponse({"error": "tts_failed", "detail": "We could not make the voice. Try again."}, status_code=502)
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/library")
def library():
    return {"clips": pipeline.load_library()}


@app.get("/api/guides/{gid}/sheet", response_class=HTMLResponse)
def sheet(gid: str):
    return sheet_mod.render(_guide(gid))


# Serve the built web app from this one origin (so a single tunnel port is enough). Registered last so every /api route
# wins. WEB_DIST overrides the default web/dist; without a build nothing is served and the API behaves as before.
_dist = pathlib.Path(os.environ.get("WEB_DIST") or pathlib.Path(__file__).resolve().parents[1] / "web" / "dist")
if (_dist / "index.html").is_file():
    if FIXTURES.is_dir():
        app.mount("/fixtures", StaticFiles(directory=FIXTURES), name="fixtures")

    @app.get("/{path:path}", include_in_schema=False)
    def web_app(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "not found")
        f = (_dist / path).resolve()
        if path and f.is_file() and _dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(_dist / "index.html", headers={"Cache-Control": "no-cache"})


# CORS is added last so it is the outermost layer (even a 401 from the gate carries its headers).
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
