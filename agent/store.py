"""In-memory guide store with SSE event fan-out. Mirrors to MongoDB when MONGODB_URI is set."""
import asyncio, copy, os


class Store:
    def __init__(self):
        self.guides: dict[str, dict] = {}
        self.history: dict[str, list[dict]] = {}
        self.subs: dict[str, list[asyncio.Queue]] = {}
        self._col = None
        uri = os.environ.get("MONGODB_URI")
        if uri:
            try:
                from pymongo import MongoClient
                self._col = MongoClient(uri, serverSelectionTimeoutMS=2000)["easyread"]["guides"]
            except Exception:
                self._col = None

    def put(self, guide: dict):
        self.guides[guide["id"]] = guide
        if self._col is not None:
            try:
                self._col.replace_one({"_id": guide["id"]}, {**copy.deepcopy(guide), "_id": guide["id"]}, upsert=True)
            except Exception:
                pass

    def get(self, gid: str) -> dict | None:
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
