import importlib.util
import json
import pathlib


def test_cached_runs_are_loaded(tmp_path):
    from agent import main
    assert "g_sample_cached_inhaler" in main.load_samples()
    g = main.store.guides["g_sample_cached_inhaler"]
    assert g["source"]["is_sample"] and g["source"]["image_urls"] == []
    assert all(s["image_url"] for s in g["steps"])
    d = tmp_path / "cached"
    d.mkdir()
    (d / "guide_cached_x.json").write_text(json.dumps({"id": "g_sample_cached_x"}))
    (d / "guide_cached_y.json").write_text(json.dumps({"id": "g_real"}))
    assert main.load_samples(tmp_path) == ["g_sample_cached_x"]


def test_cache_run_script(tmp_path):
    p = pathlib.Path(__file__).resolve().parents[2] / "demo" / "cache_run.py"
    spec = importlib.util.spec_from_file_location("cache_run", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    src = tmp_path / "g.json"
    src.write_text(json.dumps({"id": "g_1", "source": {"image_urls": ["/api/uploads/a.png"], "documents": [{"image_url": "/x"}]},
                               "steps": [{"index": 0, "kind": "what", "image_url": None, "status": "skipped"}]}))
    out = m.main([str(src), "--name", "t", "--out-dir", str(tmp_path / "o")])
    g = json.loads(out.read_text())
    assert g["id"] == "g_sample_cached_t" and g["source"]["is_sample"] and g["source"]["image_urls"] == []
    assert g["steps"][0]["image_url"].startswith("/fixtures/img/") and g["steps"][0]["status"] == "ready"


def test_translated_samples_are_served():
    from fastapi.testclient import TestClient
    from agent import main
    ids = main.load_samples()
    assert "g_sample_inhaler_es" in ids and "g_sample_council_letter_ar" in ids
    r = TestClient(main.app).get("/api/guides/g_sample_inhaler_es")
    assert r.status_code == 200 and r.json()["language"] == "es"
