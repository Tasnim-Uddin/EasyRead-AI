import time
import pytest
from fastapi.testclient import TestClient


def make_guide(client):
    gid = client.post("/api/guides", data={"language": "en"}).json()["guide_id"]
    for _ in range(50):
        g = client.get(f"/api/guides/{gid}").json()
        if g["status"] in ("ready", "failed"):
            return g
        time.sleep(0.1)
    raise AssertionError("timeout")


def test_pipeline_fixture(client):
    g = make_guide(client)
    assert g["status"] == "ready" and g["facts"]["device_type"] == "inhaler_mdi" and len(g["steps"]) >= 6


def test_sse(client):
    gid = client.post("/api/guides", data={}).json()["guide_id"]
    with client.stream("GET", f"/api/guides/{gid}/events?once=1") as r:
        body = "".join(r.iter_text())
    assert '"status": "ready"' in body and "step_updated" in body


@pytest.mark.parametrize("q,lang", [("I have chest pain", "en"), ("no puedo respirar", "es"), ("I think I took an overdose", "en")])
def test_999(client, q, lang):
    g = make_guide(client)
    r = client.post(f"/api/guides/{g['id']}/ask", json={"question": q, "language": lang}).json()
    assert r["escalate"] == "999" and "999" in r["answer"]


def test_ask_grounded_and_ungrounded(client):
    g = make_guide(client)
    r = client.post(f"/api/guides/{g['id']}/ask", json={"question": "how many puffs of the inhaler", "language": "en"}).json()
    assert r["grounded"] is True
    r = client.post(f"/api/guides/{g['id']}/ask", json={"question": "can I drink wine", "language": "en"}).json()
    assert r["grounded"] is False and r["escalate"] == "pharmacist"


def test_anam_mock_and_persona(client):
    g = make_guide(client)
    r = client.post("/api/anam/session", json={"guide_id": g["id"], "language": "en"}).json()
    assert r["sessionToken"] and r["mock"]
    cfg = r["personaConfig"]
    assert {t["name"] for t in cfg["tools"]} == {"show_step", "next_step", "previous_step", "play_technique",
                                                  "answer_from_document", "check_understanding", "set_language"}
    assert all(t["awaitResult"] and t["toolTimeoutSeconds"] <= 30 for t in cfg["tools"])
    assert "999" in cfg["systemPrompt"] and "Salbutamol" in cfg["systemPrompt"]


def test_every_step_has_say(client):
    g = make_guide(client)
    for s in g["steps"]:
        assert s["say"].startswith(s["text"])
    warn = next(s for s in g["steps"] if s["kind"] == "warning")
    assert warn["say"] == f"{warn['text']} Take care with this one."
    # other languages keep the translated text only (no English tail on a translated line)
    es = client.post(f"/api/guides/{g['id']}/language", json={"language": "es"}).json()
    assert all(s["say"] == s["text"] for s in es["steps"])


def test_language_and_library_and_404(client):
    g = make_guide(client)
    assert client.post(f"/api/guides/{g['id']}/language", json={"language": "es"}).json()["language"] == "es"
    assert "clips" in client.get("/api/library").json()
    assert client.get("/api/guides/nope").status_code == 404


def test_tools_endpoint(client):
    g = make_guide(client)
    r = client.post("/api/tools/answer_from_document", json={"guide_id": g["id"], "question": "chest pain"}).json()
    assert r["escalate"] == "999" and "999" in r["say"]
    assert client.post("/api/tools/check_understanding", json={"guide_id": g["id"]}).json()["say"]
    assert client.post("/api/tools/set_language", json={"guide_id": g["id"], "language": "es"}).json()["language"] == "es"


def test_illustrate_never_fails_offline(client):
    g = make_guide(client)
    assert all(s["status"] in ("ready", "skipped") for s in g["steps"])


def test_tts_503_without_key(client):
    r = client.post("/api/tts", json={"text": "Hello", "language": "en"})
    assert r.status_code == 503 and r.json()["error"] == "tts_unavailable"


def test_tts_validation_and_cache(client, monkeypatch):
    import httpx
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key")
    assert client.post("/api/tts", json={"text": "  "}).status_code == 400
    assert client.post("/api/tts", json={"text": "x" * 601}).status_code == 413
    calls = []

    class Fake:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def post(self, url, **kw):
            calls.append((url, kw["json"]))
            return httpx.Response(200, content=b"ID3fake")

    monkeypatch.setattr("agent.tts.httpx.AsyncClient", Fake)
    for _ in range(2):
        r = client.post("/api/tts", json={"text": "Take 2 puffs", "language": "en"})
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg" and r.content == b"ID3fake"
    assert len(calls) == 1 and "text-to-speech" in calls[0][0] and calls[0][1]["model_id"]


def test_unchecked_clips_hidden_unless_demo_flag(monkeypatch):
    from agent import pipeline
    monkeypatch.delenv("SHOW_UNCHECKED_CLIPS", raising=False)
    assert all(c.get("checked_by") for c in pipeline.load_library())
    monkeypatch.setenv("SHOW_UNCHECKED_CLIPS", "1")
    shown = [c for c in pipeline.load_library() if c.get("unchecked")]
    assert {c["id"] for c in shown} >= {"inhaler_mdi_shake", "inhaler_mdi_hold"}
    assert all(not c.get("checked_by") and c["video_url"] for c in shown)
