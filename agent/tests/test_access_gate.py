import importlib


def test_open_when_unset(client, monkeypatch):
    monkeypatch.delenv("ACCESS_CODE", raising=False)
    assert client.get("/api/health").status_code == 200


def test_gate(client, monkeypatch):
    monkeypatch.setenv("ACCESS_CODE", "123456")
    r = client.get("/api/health")
    assert r.status_code == 401 and r.json()["error"] == "access_code_required"
    assert client.get("/api/health", headers={"X-Access-Code": "000000"}).status_code == 401
    assert client.get("/api/health", headers={"X-Access-Code": "123456"}).status_code == 200
    assert client.post("/api/guides", data={}).status_code == 401


def test_cookie_via_query(client, monkeypatch):
    monkeypatch.setenv("ACCESS_CODE", "123456")
    client.get("/?code=nope")
    assert client.get("/api/health").status_code == 401
    client.get("/?code=123456")
    assert client.cookies.get("er_access") == "123456"
    assert client.get("/api/health").status_code == 200


def test_static_spa(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "a.js").write_text("x=1")
    monkeypatch.setenv("WEB_DIST", str(tmp_path))
    import agent.main as m
    m = importlib.reload(m)
    try:
        from fastapi.testclient import TestClient
        c = TestClient(m.app)
        assert "app" in c.get("/").text and "app" in c.get("/some/route").text
        assert c.get("/assets/a.js").text == "x=1"
        assert c.get("/api/health").json()["ok"] is True
        assert c.get("/api/nope").status_code == 404
        assert "import" not in c.get("/..%2fmain.py").text
    finally:
        monkeypatch.delenv("WEB_DIST")
        importlib.reload(m)
