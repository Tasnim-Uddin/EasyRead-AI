"""Guide store with SSE event fan-out. Mirrors to MongoDB when MONGODB_URI is set; otherwise each guide is saved as
JSON under GUIDES_DIR (default <repo>/data/guides) so guides survive a restart. Only the guide JSON is written (text,
facts and URLs); uploaded files are never copied here."""
import asyncio, copy, json, logging, os, pathlib, re

log = logging.getLogger(__name__)
DEFAULT_GUIDES_DIR = pathlib.Path(__file__).resolve().parents[1] / "data" / "guides"
_SAFE_ID = re.compile(r"^g_[A-Za-z0-9_-]{1,64}$")


def is_sample(gid: str) -> bool:
    return gid.startswith("g_sample")


def summary(g: dict) -> dict:
    """The short row for the "My papers" list."""
    facts = g.get("facts") or {}
    content = g.get("content") or {}
    steps = g.get("steps") or []
    title = (g.get("title_override") or facts.get("medicine") or (content.get("what_this_is") if isinstance(content, dict) else None)
             or facts.get("title") or (steps[0].get("text") if steps else None) or "")
    thumb = next((s.get("image_url") for s in steps if s.get("image_url")), None)
    return {"id": g["id"], "title": title, "language": g.get("language", "en"), "doc_type": g.get("doc_type", "how_to"),
            "created_at": g.get("created_at"), "status": g.get("status"), "thumbnail": thumb}


class Store:
    def __init__(self, guides_dir: str | os.PathLike | None = None):
        self.guides: dict[str, dict] = {}
        self.history: dict[str, list[dict]] = {}
        self.subs: dict[str, list[asyncio.Queue]] = {}
        self.deleted: set[str] = set()
        self._col = None
        self._dir: pathlib.Path | None = None
        uri = os.environ.get("MONGODB_URI")
        if uri:
            try:
                from pymongo import MongoClient
                self._col = MongoClient(uri, serverSelectionTimeoutMS=2000)["easyread"]["guides"]
            except Exception:
                self._col = None
        if self._col is None:
            self._dir = pathlib.Path(guides_dir or os.environ.get("GUIDES_DIR") or DEFAULT_GUIDES_DIR)
            try:
                self._dir.mkdir(parents=True, exist_ok=True)
                self._load_files()
            except OSError as e:
                log.warning("guide files disabled: %s", e)
                self._dir = None

    # ---- file fallback ----
    def _path(self, gid: str) -> pathlib.Path | None:
        if self._dir is None or not _SAFE_ID.match(gid):
            return None
        return self._dir / f"{gid}.json"

    def _load_files(self):
        for f in sorted(self._dir.glob("g_*.json")):
            try:
                g = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(g, dict) or not isinstance(g.get("id"), str) or is_sample(g["id"]):
                continue
            # A guide that was still being made when the server stopped will never finish: keep what was written.
            if g.get("status") not in ("ready", "failed"):
                if g.get("steps"):
                    g["status"] = "ready"
                    for s in g["steps"]:
                        if s.get("status") in ("pending", "generating"):
                            s["status"] = "failed"
                else:
                    g["status"] = "failed"
                    g.setdefault("error", "The server stopped before this guide was finished.")
            self.guides[g["id"]] = g

    def _write_file(self, guide: dict):
        p = self._path(guide["id"])
        if p is None:
            return
        try:
            tmp = p.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(guide, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, p)
        except OSError as e:
            log.warning("could not save guide %s: %s", guide["id"], e)

    # ---- store API ----
    def put(self, guide: dict):
        gid = guide["id"]
        if gid in self.deleted:
            return  # deleted while it was still being made: never bring it back
        self.guides[gid] = guide
        if is_sample(gid):
            return  # samples are read-only fixtures: never saved
        if self._col is not None:
            try:
                self._col.replace_one({"_id": gid}, {**copy.deepcopy(guide), "_id": gid}, upsert=True)
            except Exception:
                pass
        else:
            self._write_file(guide)

    def get(self, gid: str) -> dict | None:
        if gid in self.deleted:
            return None
        g = self.guides.get(gid)
        if g is None and self._col is not None:
            try:
                d = self._col.find_one({"_id": gid})
                if d:
                    d.pop("_id", None)
                    self.guides[gid] = g = d
            except Exception:
                pass
        return g

    def summaries(self, ids: list[str]) -> list[dict]:
        """Summaries of the given guides only (never every guide), newest first. Unknown ids and samples are skipped."""
        out, seen = [], set()
        for gid in ids:
            if gid in seen or is_sample(gid):
                continue
            seen.add(gid)
            g = self.get(gid)
            if g:
                out.append(summary(g))
        out.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return out

    def rename(self, gid: str, title: str | None) -> dict | None:
        """Sets the user's own name for a guide (title_override); an empty title clears it. None for unknown ids and samples."""
        if is_sample(gid):
            return None
        g = self.get(gid)
        if g is None:
            return None
        t = " ".join((title or "").split())[:120]
        g["title_override"] = t or None
        self.put(g)
        return g

    def delete(self, gid: str) -> bool:
        if is_sample(gid) or self.get(gid) is None:
            return False
        self.guides.pop(gid, None)
        self.history.pop(gid, None)
        self.deleted.add(gid)
        if self._col is not None:
            try:
                self._col.delete_one({"_id": gid})
            except Exception:
                pass
        p = self._path(gid)
        if p is not None:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        return True

    def emit(self, gid: str, event: dict):
        self.history.setdefault(gid, []).append(event)
        for q in self.subs.get(gid, []):
            q.put_nowait(event)

    def subscribe(self, gid: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        for e in self.history.get(gid, []):
            q.put_nowait(e)
        self.subs.setdefault(gid, []).append(q)
        return q

    def unsubscribe(self, gid: str, q):
        if q in self.subs.get(gid, []):
            self.subs[gid].remove(q)
