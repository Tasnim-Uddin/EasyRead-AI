"""Fixes from the keyed run. Mocks only, no live calls."""
import json
from agent import llm, postprocess


def _conflict_guide(client):
    from agent.main import store
    g = {"id": "g_conf", "status": "ready", "language": "en", "doc_type": "how_to", "domain": "medicine",
         "facts": {"medicine": "Salbutamol", "dose": "TWO puffs", "frequency": "When needed for wheeze", "device_type": "inhaler_mdi",
                   "conflicts": [{"field": "dose", "label": "TWO puffs", "leaflet": "ONE puff, up to 2"}]},
         "steps": [{"text_en": "Your label and leaflet say different things. Ask your pharmacist.",
                    "text": "Your label and leaflet say different things. Ask your pharmacist.", "kind": "warning", "image_url": "/a.png"},
                   {"text_en": "Shake your inhaler.", "text": "Agite su inhalador.", "kind": "how", "image_url": "/b.png"}],
         "safety_lines": ["In an emergency, call 999.", "Not urgent? Call 111.", "Ask your pharmacist."], "source": {}}
    store.put(g)
    return g


def test_tellback_conflict_does_not_ask_dose(client):
    _conflict_guide(client)
    r = client.post("/api/guides/g_conf/check_understanding", json={}).json()
    assert "different" in r["say"] and "puffs" not in r["say"]
    ok = client.post("/api/guides/g_conf/check_understanding", json={"answer": "Ask my pharmacist"}).json()
    assert ok["correct"] is True
    bad = client.post("/api/guides/g_conf/check_understanding", json={"answer": "two puffs"}).json()
    assert bad["correct"] is False and "TWO" not in bad["say"]


def test_summary_line_translated_and_english_kept(monkeypatch, client):
    _conflict_guide(client)

    async def fake(system, content, max_tokens=4000):
        return ["t:" + x for x in json.loads(content)]
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post("/api/guides/g_conf/language", json={"language": "es"}).json()
    assert r["summary_line"] == "t:TWO puffs, When needed for wheeze"
    assert r["summary_line_en"] == "TWO puffs, When needed for wheeze"
    r = client.post("/api/guides/g_conf/language", json={"language": "en"}).json()
    assert r["summary_line"] == "TWO puffs, When needed for wheeze"


def test_sheet_layout(client):
    g = _conflict_guide(client)
    g["language"] = "ar"
    h = client.get("/api/guides/g_conf/sheet").text
    assert '<html lang="ar" dir=auto>' in h and "@page{size:A4" in h
    assert h.count("<li class=row>") == 1 and 'src="/b.png"' in h and "class=warn" in h
    assert "call 999" in h and "Call 111" in h and "pharmacist" in h
    assert "font-size:18pt" in h and "width:45mm" in h and "page-break-inside:avoid" in h and "list-style:none" in h


def test_dose_limit_steps_merge_into_one():
    mk = lambda t: {"text_en": t, "kind": "what", "picture_prompt": "x"}
    steps = [mk("Use your inhaler no more than 4 times in 24 hours."), mk("Do not take more than 8 puffs in 24 hours."),
             mk("Do not use it more often than advised.")]
    out = postprocess.tidy(steps, "how_to", "medicine")
    assert len(out) == 1
    assert "4 times" in out[0]["text_en"] and "8 puffs" in out[0]["text_en"] and "advised" not in out[0]["text_en"]


def test_vague_limit_kept_when_alone():
    out = postprocess.merge_dose_limits([{"text_en": "Do not use it more often than advised.", "kind": "what", "picture_prompt": "x"}])
    assert len(out) == 1


def test_drop_know_prefix_on_fact_steps():
    from agent import postprocess
    steps = [{"text_en": "Know that the council says you have not paid.", "kind": "what", "picture_prompt": "x"},
             {"text_en": "Know the overdue instalment is £212.50.", "kind": "what", "picture_prompt": "x"},
             {"text_en": "Know your rights.", "kind": "how", "picture_prompt": "x"}]
    out = postprocess.drop_know(steps)
    assert [s["text_en"] for s in out] == ["The council says you have not paid.",
                                           "The overdue instalment is £212.50.", "Know your rights."]
