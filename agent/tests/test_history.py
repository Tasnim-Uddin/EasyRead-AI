"""Saved guides ("My papers"): file persistence, the per-device list, delete and the access gate. No live API calls."""
import json

from agent.store import Store, summary


def _guide(gid, created="2026-11-14T10:00:00Z", **kw):
    g = {"id": gid, "status": "ready", "language": "en", "doc_type": "how_to", "domain": "medicine",
         "source": {"kind": "other", "image_urls": [], "is_sample": False}, "content": None, "safety_lines": [],
         "facts": {"medicine": "Salbutamol inhaler"},
         "steps": [{"index": 0, "text": "Shake it.", "image_url": "https://img/0.png", "status": "ready"}],
         "created_at": created}
    g.update(kw)
    return g


def test_persist_and_reload(tmp_path, monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    s = Store(tmp_path)
    s.put(_guide("g_abc123"))
    f = tmp_path / "g_abc123.json"
    assert f.is_file() and json.loads(f.read_text())["facts"]["medicine"] == "Salbutamol inhaler"
    s2 = Store(tmp_path)  # a restart
    assert s2.get("g_abc123")["steps"][0]["text"] == "Shake it."


def test_status_change_is_saved(tmp_path, monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    s = Store(tmp_path)
    g = _guide("g_st1", status="extracting", steps=[])
    s.put(g)
    g["status"] = "illustrating"
    s.put(g)
    assert json.loads((tmp_path / "g_st1.json").read_text())["status"] == "illustrating"


def test_unfinished_guide_settles_on_restart(tmp_path, monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    s = Store(tmp_path)
    s.put(_guide("g_half", status="illustrating", steps=[{"index": 0, "text": "A", "image_url": None, "status": "pending"}]))
    s.put(_guide("g_none", status="extracting", steps=[]))
    s2 = Store(tmp_path)
    assert s2.get("g_half")["status"] == "ready" and s2.get("g_half")["steps"][0]["status"] == "failed"
    assert s2.get("g_none")["status"] == "failed"


def test_samples_and_bad_ids_never_saved(tmp_path, monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    s = Store(tmp_path)
    s.put(_guide("g_sample_inhaler"))
    s.put(_guide("g_../../evil"))
    assert list(tmp_path.iterdir()) == []


def test_no_raw_files_in_saved_json(tmp_path, monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    s = Store(tmp_path)
    s.put(_guide("g_raw"))
    text = (tmp_path / "g_raw.json").read_text()
    assert "base64" not in text


def test_summary_titles():
    assert summary(_guide("g_1"))["title"] == "Salbutamol inhaler"
    letter = _guide("g_2", facts={"medicine": None}, content={"what_this_is": "A council tax letter"})
    assert summary(letter)["title"] == "A council tax letter"
    plain = _guide("g_3", facts=None)
    row = summary(plain)
    assert row["title"] == "Shake it." and row["thumbnail"] == "https://img/0.png"
    assert set(row) == {"id", "title", "language", "doc_type", "created_at", "status", "thumbnail"}


def _seed(client, *guides):
    from agent.main import store
    for g in guides:
        store.put(g)


def test_list_only_given_ids_newest_first(client):
    _seed(client, _guide("g_old1", created="2026-11-13T09:00:00Z"), _guide("g_new1", created="2026-11-14T09:00:00Z"),
          _guide("g_other1"))
    r = client.get("/api/guides", params={"ids": "g_old1,g_new1,g_missing,g_sample_inhaler"})
    assert r.status_code == 200
    assert [x["id"] for x in r.json()["guides"]] == ["g_new1", "g_old1"]


def test_list_without_ids_is_empty(client):
    _seed(client, _guide("g_hidden1"))
    assert client.get("/api/guides").json() == {"guides": []}


def test_delete(client, tmp_path):
    from agent.main import store, UPLOADS
    _seed(client, _guide("g_del1"))
    up = UPLOADS / "g_del1_abc_photo.jpg"
    up.write_bytes(b"x")
    assert client.delete("/api/guides/g_del1").json() == {"deleted": "g_del1"}
    assert client.get("/api/guides/g_del1").status_code == 404
    assert client.get("/api/guides", params={"ids": "g_del1"}).json() == {"guides": []}
    assert not up.exists()
    assert client.delete("/api/guides/g_del1").status_code == 404
    # a late update from a still-running pipeline does not bring it back
    store.put(_guide("g_del1"))
    assert client.get("/api/guides/g_del1").status_code == 404


def test_samples_cannot_be_deleted(client):
    assert client.delete("/api/guides/g_sample_inhaler").status_code == 404
    assert client.get("/api/guides/g_sample_inhaler").status_code == 200


def test_access_gate_covers_history(client, monkeypatch):
    _seed(client, _guide("g_gate1"))
    monkeypatch.setenv("ACCESS_CODE", "123456")
    assert client.get("/api/guides", params={"ids": "g_gate1"}).status_code == 401
    assert client.delete("/api/guides/g_gate1").status_code == 401
    ok = {"X-Access-Code": "123456"}
    assert client.get("/api/guides", params={"ids": "g_gate1"}, headers=ok).json()["guides"][0]["id"] == "g_gate1"
    assert client.delete("/api/guides/g_gate1", headers=ok).status_code == 200


def test_created_guide_is_saved(client):
    from agent.main import store
    gid = client.post("/api/guides", data={"language": "en"}).json()["guide_id"]
    assert store._path(gid).is_file()
