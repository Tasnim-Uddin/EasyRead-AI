"""Which steps get a fal picture: only steps with no close-up and no highlight, at most PICTURE_CAP (default 4),
most concrete objects first. Mocks only, no live calls."""
import asyncio, sys, types
from agent import pipeline


def _step(i, prompt="a hand holding a letter", kind="how", **kw):
    return {"index": i, "kind": kind, "picture_prompt": prompt, "image_url": None, "status": "pending", **kw}


def _fake_media(monkeypatch):
    calls = []

    async def make_step_picture(prompt, seed=None):
        calls.append(prompt)
        return "https://img/x.png"
    monkeypatch.setitem(sys.modules, "media", types.SimpleNamespace(make_step_picture=make_step_picture))
    monkeypatch.setenv("FAL_KEY", "test")
    return calls


def test_skip_steps_with_closeup_or_highlight(monkeypatch):
    monkeypatch.delenv("PICTURE_CAP", raising=False)
    steps = [_step(0, visual={"kind": "closeup", "id": "phone_call"}),
             _step(1, highlights=[{"page": 0, "text": "12 March", "quad": [[0, 0]] * 4}]),
             _step(2)]
    assert pipeline.pick_picture_steps(steps) == [steps[2]]
    # an empty highlight list or a null visual does not count
    assert pipeline.needs_picture(_step(3, visual=None, highlights=[]))
    assert not pipeline.needs_picture(_step(4, prompt="  "))
    assert not pipeline.needs_picture(_step(5, image_url="/done.png"))


def test_cap_is_four_by_default_and_picks_most_concrete(monkeypatch):
    monkeypatch.delenv("PICTURE_CAP", raising=False)
    assert pipeline.picture_cap() == 4
    steps = [_step(0, "hands doing one simple task"),
             _step(1, "a hand putting a letter into an envelope"),          # 2 objects
             _step(2, "a hand writing in a diary with a pen"),               # 2
             _step(3, "a hand holding a phone"),                             # 1
             _step(4, "hands resting"),                                      # 0
             _step(5, "a bank card, a bill and a phone on a table"),         # 4
             _step(6, "a hand holding a key")]                               # 1
    picked = pipeline.pick_picture_steps(steps)
    assert len(picked) == 4
    assert [s["index"] for s in picked] == [1, 2, 3, 5]  # step order kept; ties go to the earlier step


def test_intro_what_step_gets_its_paper_picture():
    steps = [_step(0, "two hands holding a letter", kind="what")] + [_step(i, "a hand holding a phone") for i in range(1, 6)]
    picked = pipeline.pick_picture_steps(steps, cap=2)
    assert picked[0] is steps[0] and len(picked) == 2


def test_cap_env(monkeypatch):
    monkeypatch.setenv("PICTURE_CAP", "0")
    assert pipeline.pick_picture_steps([_step(0)]) == []
    monkeypatch.setenv("PICTURE_CAP", "x")
    assert pipeline.picture_cap() == 4


def test_illustrate_only_calls_fal_for_picked_steps(monkeypatch):
    monkeypatch.delenv("PICTURE_CAP", raising=False)
    calls = _fake_media(monkeypatch)
    g = {"id": "g", "steps": [_step(0, visual={"kind": "closeup", "id": "x"}),
                              _step(1, highlights=[{"page": 0, "text": "t", "quad": []}])]
         + [_step(i, f"a hand holding a phone {i}") for i in range(2, 9)]}
    events = []
    asyncio.run(pipeline.illustrate(g, events.append))
    assert len(calls) == 4
    st = [s["status"] for s in g["steps"]]
    assert st[:2] == ["skipped", "skipped"] and st.count("ready") == 4 and st.count("skipped") == 5
    assert all(s["image_url"] is None for s in g["steps"] if s["status"] == "skipped")
    # every step is reported once; drawn steps once more (generating, then done)
    assert len(events) == 9 + 4
