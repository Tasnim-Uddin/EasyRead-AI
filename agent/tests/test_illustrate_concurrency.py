"""illustrate() makes step pictures concurrently, with a bound. Mocks only, no live calls."""
import asyncio, sys, types
import pytest
from agent import pipeline


def _guide(n):
    return {"id": "g_conc", "steps": [{"index": i, "picture_prompt": f"step {i}", "image_url": None, "status": "pending"}
                                      for i in range(n)]}


def _fake_media(monkeypatch, fail_on=None, delay=0.02):
    state = {"now": 0, "max": 0, "calls": 0}

    async def make_step_picture(prompt, seed=None):
        state["now"] += 1
        state["calls"] += 1
        state["max"] = max(state["max"], state["now"])
        try:
            await asyncio.sleep(delay)
            if fail_on and prompt == fail_on:
                raise RuntimeError("fal down")
            return f"https://img/{prompt.replace(' ', '_')}.png"
        finally:
            state["now"] -= 1
    monkeypatch.setitem(sys.modules, "media", types.SimpleNamespace(make_step_picture=make_step_picture))
    monkeypatch.setenv("FAL_KEY", "test")
    return state


def _run(g):
    events = []
    asyncio.run(pipeline.illustrate(g, events.append))
    return events


def test_all_steps_ready_and_bound_respected(monkeypatch):
    monkeypatch.setenv("PICTURE_CONCURRENCY", "3")
    state = _fake_media(monkeypatch)
    g = _guide(10)
    events = _run(g)
    assert all(s["status"] == "ready" and s["image_url"] == f"https://img/step_{s['index']}.png" for s in g["steps"])
    assert state["calls"] == 10
    assert state["max"] == 3  # concurrent, but never more than the bound
    # every step is emitted as generating, then once more when done
    assert len(events) == 20 and all(e["type"] == "step_updated" for e in events)


def test_default_concurrency_is_six(monkeypatch):
    monkeypatch.delenv("PICTURE_CONCURRENCY", raising=False)
    state = _fake_media(monkeypatch)
    _run(_guide(16))
    assert state["max"] == 6


@pytest.mark.parametrize("bad", ["0", "-2", "abc"])
def test_bad_concurrency_value_is_safe(monkeypatch, bad):
    monkeypatch.setenv("PICTURE_CONCURRENCY", bad)
    assert pipeline.picture_concurrency() >= 1


def test_one_failed_picture_does_not_stop_the_others(monkeypatch):
    _fake_media(monkeypatch, fail_on="step 2")
    g = _guide(5)
    _run(g)
    assert g["steps"][2]["status"] == "failed" and g["steps"][2]["image_url"] is None
    assert all(s["status"] == "ready" for i, s in enumerate(g["steps"]) if i != 2)


def test_existing_images_kept_and_no_key_skips(monkeypatch):
    state = _fake_media(monkeypatch)
    g = _guide(3)
    g["steps"][0]["image_url"] = "/fixture.png"
    _run(g)
    assert g["steps"][0]["status"] == "ready" and g["steps"][0]["image_url"] == "/fixture.png"
    assert state["calls"] == 2
    monkeypatch.delenv("FAL_KEY")
    g2 = _guide(2)
    _run(g2)
    assert [s["status"] for s in g2["steps"]] == ["skipped", "skipped"]


def test_run_reaches_ready_with_concurrent_pictures(monkeypatch):
    """Full keyless run (fixture text) with mocked fal: guide ends ready, every step ready, statuses in order."""
    from agent.store import Store
    _fake_media(monkeypatch)
    monkeypatch.setattr(pipeline.llm, "available", lambda: False)
    fx = pipeline.load_fixture()
    for s in fx["steps"]:
        s["image_url"] = None
    monkeypatch.setattr(pipeline, "load_fixture", lambda: fx)
    monkeypatch.delenv("MONGODB_URI", raising=False)
    store = Store()
    store.put(pipeline.new_guide("g_run", "en"))
    asyncio.run(pipeline.run(store, "g_run", [], None, "en", []))
    g = store.get("g_run")
    assert g["status"] == "ready"
    assert all(s["status"] == "ready" and s["image_url"] for s in g["steps"])
    statuses = [e["status"] for e in store.history["g_run"] if e["type"] == "guide_status"]
    assert statuses == ["extracting", "writing", "illustrating", "ready"]


def test_sheet_while_pictures_are_still_coming():
    from agent import sheet
    g = {"id": "g_s", "language": "en", "facts": {"medicine": "Salbutamol"}, "safety_lines": ["Call 999."],
         "steps": [{"index": 0, "text": "Shake it.", "image_url": "/a.png", "status": "ready"},
                   {"index": 1, "text": "Breathe in.", "image_url": None, "status": "generating"},
                   {"index": 2, "text": "Hold it.", "status": "failed"}]}
    html = sheet.render(g)
    assert html.count("<img") == 1 and "Breathe in." in html and "Hold it." in html
