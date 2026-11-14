import time
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "ANAM_API_KEY", "MONGODB_URI"):
        monkeypatch.delenv(k, raising=False)
    from agent.main import app
    with TestClient(app) as c:
        yield c


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


def test_language_and_library_and_404(client):
    g = make_guide(client)
    assert client.post(f"/api/guides/{g['id']}/language", json={"language": "es"}).json()["language"] == "es"
    assert "clips" in client.get("/api/library").json()
    assert client.get("/api/guides/nope").status_code == 404
