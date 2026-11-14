import time
import pytest


def make_guide(client):
    gid = client.post("/api/guides", data={"language": "en"}).json()["guide_id"]
    for _ in range(50):
        g = client.get(f"/api/guides/{gid}").json()
        if g["status"] in ("ready", "failed"):
            return g
        time.sleep(0.1)
    raise AssertionError("timeout")


class _FakeResp:
    def __init__(self, status, body):
        self.status_code, self._b, self.text = status, body, "secret upstream body"

    def json(self):
        return self._b


def _fake_httpx(monkeypatch, status, body, seen):
    import httpx
    from agent import main

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            seen.update(url=url, headers=headers, json=json)
            if status == "boom":
                raise httpx.ConnectError("down")
            return _FakeResp(status, body)

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)


def test_anam_real_token_request(client, monkeypatch):
    g = make_guide(client)
    monkeypatch.setenv("ANAM_API_KEY", "test-key-not-real")
    seen = {}
    _fake_httpx(monkeypatch, 200, {"sessionToken": "jwt-abc"}, seen)
    r = client.post("/api/anam/session", json={"guide_id": g["id"], "language": "es", "step_index": 2}).json()
    assert r == {"sessionToken": "jwt-abc"}
    assert seen["url"] == "https://api.anam.ai/v1/auth/session-token"
    assert seen["headers"]["Authorization"] == "Bearer test-key-not-real"
    pc = seen["json"]["personaConfig"]
    assert pc["languageCode"] == "es" and "show_step with index 2" in pc["systemPrompt"]
    assert pc["avatarId"] and pc["voiceId"] and pc["llmId"] and pc["maxSessionLengthSeconds"] <= 600
    assert all(t["type"] == "client" for t in pc["tools"])


@pytest.mark.parametrize("status", [401, 403, "boom"])
def test_anam_token_errors_are_502_without_upstream_body(client, monkeypatch, status):
    g = make_guide(client)
    monkeypatch.setenv("ANAM_API_KEY", "test-key-not-real")
    _fake_httpx(monkeypatch, status, {}, {})
    r = client.post("/api/anam/session", json={"guide_id": g["id"], "language": "en"})
    assert r.status_code == 502 and "secret" not in r.text and "test-key" not in r.text


def test_persona_language_and_env_override(monkeypatch):
    from agent import persona
    monkeypatch.setenv("ANAM_VOICE_ID", "custom-voice")
    cfg = persona.persona_config({"steps": []}, "bn")
    assert cfg["voiceId"] == "custom-voice" and cfg["languageCode"] == "bn"
    assert "languageCode" not in persona.persona_config({"steps": []}, "en")
