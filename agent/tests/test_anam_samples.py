def test_sample_guides_work_on_the_server(client):
    for gid in ("g_sample_inhaler", "g_sample_council_letter", "g_sample_flatpack"):
        r = client.post("/api/anam/session", json={"guide_id": gid, "language": "en", "step_index": 1})
        assert r.status_code == 200 and r.json()["mock"] is True
        assert "read step with index 1" in r.json()["personaConfig"]["systemPrompt"]
        assert client.get(f"/api/guides/{gid}").json()["id"] == gid


def test_sample_q_and_a_and_tools(client):
    r = client.post("/api/guides/g_sample_inhaler/ask", json={"question": "how many puffs?"})
    assert r.status_code == 200 and r.json()["answer"]
    r = client.post("/api/tools/check_understanding", json={"guide_id": "g_sample_flatpack"})
    assert r.status_code == 200 and r.json()["say"]


def test_load_samples_ignores_bad_files(tmp_path):
    from agent import main
    (tmp_path / "guide_bad.json").write_text("{nope")
    (tmp_path / "guide_other.json").write_text('{"id": "real_guide"}')
    assert main.load_samples(tmp_path) == []


def test_per_language_voice(monkeypatch):
    from agent import persona
    monkeypatch.delenv("ANAM_VOICE_ID", raising=False)
    monkeypatch.setenv("ANAM_VOICE_ID_ES", "voice-es")
    monkeypatch.setenv("ANAM_VOICE_ID_AR", "voice-ar")

    def pc(lang):
        return persona.persona_config({"steps": []}, lang)["voiceId"]

    assert pc("es") == "voice-es" and pc("ar") == "voice-ar"
    assert pc("pl") == persona.DEFAULTS["voiceId"] and pc("en") == persona.DEFAULTS["voiceId"]
    monkeypatch.setenv("ANAM_VOICE_ID", "generic")
    assert pc("pl") == "generic" and pc("es") == "voice-es"
    assert persona.voice_id("../x") == "generic"
