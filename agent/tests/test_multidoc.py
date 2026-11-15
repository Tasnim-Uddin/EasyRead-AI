"""Multi-file guides and document types. Every model call is mocked: nothing here touches the network."""
import json, pathlib, time
import pytest
from agent import docs, doctypes, pipeline

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 50
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 50


def pdf(pages: int) -> bytes:
    return b"%PDF-1.4\n" + b"".join(b"<< /Type /Page >>\n" for _ in range(pages)) + b"<< /Type /Pages >>\n%%EOF"


HOW_TO = {"doc_type": "how_to", "domain": "medicine", "kind": "prescription", "medicine": "Metformin 500 mg tablets",
          "dose": "1 tablet", "frequency": "twice a day", "route": "oral", "device_type": "tablets",
          "device_confidence": 0.9, "warnings": ["Take with food."], "get_help": ["Call 111 if you feel very unwell."],
          "unreadable": [], "documents": [{"index": 1, "role": "label"}, {"index": 2, "role": "leaflet"}]}
LETTER = {"doc_type": "letter", "domain": "council", "kind": "letter", "what_this_is": "This letter is about your council tax.",
          "what_to_do": ["Pay 112 pounds by 1 December."], "by_when": [{"date": "1 December", "what": "pay"}],
          "amounts": [{"what": "Monthly bill", "amount": "£112"}], "unreadable": []}
BILL = {**LETTER, "doc_type": "bill", "domain": "money"}
FORM = {"doc_type": "form", "domain": "council", "kind": "other", "unreadable": [],
        "fields": [{"label": "Box 1", "what_to_write": "Write your full name."}]}


@pytest.fixture
def mocked(client, monkeypatch):
    """Pretend a key is set, record every extraction call, return whatever `state['raw']` says."""
    from agent import llm, pipeline
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    state = {"raw": HOW_TO, "calls": []}

    async def fake_json(system, content, max_tokens=2000):
        state["calls"].append((system, content))
        return json.loads(json.dumps(state["raw"]))

    async def fake_write(facts, language="en"):
        state["facts"] = facts
        return [{"text_en": "Take 1 tablet twice a day.", "kind": "when", "picture_prompt": "a tablet in a hand"},
                {"text_en": "Call 999 if you are very ill.", "kind": "get_help", "picture_prompt": "a phone"}]

    monkeypatch.setattr(llm, "complete_json", fake_json)
    monkeypatch.setattr(pipeline, "write_easy_read", fake_write)
    state["client"] = client
    return state


def post(state, files, **form):
    c = state["client"]
    r = c.post("/api/guides", files=files, data={"language": "en", **form})
    if r.status_code != 200:
        return r
    gid = r.json()["guide_id"]
    for _ in range(50):
        g = c.get(f"/api/guides/{gid}").json()
        if g["status"] in ("ready", "failed"):
            return g
        time.sleep(0.1)
    raise AssertionError("timeout")


def blocks(state):
    assert len(state["calls"]) == 1, "all pages must go to the model in ONE extraction call"
    return state["calls"][0][1]


def test_several_files_one_call(mocked):
    files = [("document", ("label.jpg", JPEG, "image/jpeg")), ("document", ("leaflet.pdf", pdf(3), "application/pdf")),
             ("document", ("p3.png", PNG, "image/png")), ("device_photo", ("dev.jpg", JPEG, "image/jpeg"))]
    g = post(mocked, files, roles="label, leaflet")
    assert g["status"] == "ready"
    b = blocks(mocked)
    kinds = [x["type"] for x in b if x["type"] != "text"]
    assert kinds == ["image", "document", "image", "image"]
    heads = [x["text"] for x in b if x["type"] == "text"]
    assert "Document 1 (role: label):" in heads and "Document 2 (role: leaflet):" in heads
    assert "Document 3 (role: detect):" in heads and "Document 4 (role: device_photo):" in heads
    roles = {d["index"]: (d["role"], d["role_source"]) for d in g["source"]["documents"]}
    assert roles[1] == ("label", "client") and roles[2] == ("leaflet", "client")
    assert roles[3][1] == "detected" and roles[4] == ("device_photo", "client")
    assert len(g["source"]["image_urls"]) == 4


def test_detected_roles_used(mocked):
    mocked["raw"] = {**HOW_TO, "documents": [{"index": 1, "role": "leaflet"}]}
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["source"]["documents"][0] == {"index": 1, "role": "leaflet", "role_source": "detected", "image_url": g["source"]["image_urls"][0]}


def test_single_file_still_works(mocked):
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "ready" and g["doc_type"] == "how_to" and g["facts"]["medicine"].startswith("Metformin")
    assert len([x for x in blocks(mocked) if x["type"] != "text"]) == 1
    assert all(k in g["steps"][0] for k in ("index", "text", "text_en", "kind", "picture_prompt", "image_url", "technique_clip_id", "status"))


def test_label_wins_and_conflict_is_flagged(mocked):
    mocked["raw"] = {**HOW_TO, "label": {"dose": "1 tablet", "frequency": "twice a day"},
                     "leaflet": {"dose": "2 tablets", "frequency": "twice a day"}}
    g = post(mocked, [("document", ("l.jpg", JPEG, "image/jpeg")), ("document", ("f.jpg", JPEG, "image/jpeg"))],
             roles="label,leaflet")
    assert g["facts"]["dose"] == "1 tablet"  # label wins
    assert g["facts"]["conflicts"] == [{"field": "dose", "label": "1 tablet", "leaflet": "2 tablets"}]
    assert doctypes.CONFLICT_TEXT in g["facts"]["warnings"]
    assert doctypes.CONFLICT_TEXT in mocked["facts"]["warnings"]  # the rewriter is told too
    assert sum(doctypes.CONFLICT_TEXT in s["text_en"] for s in g["steps"]) == 1
    assert [s["index"] for s in g["steps"]] == list(range(len(g["steps"])))


def test_matching_label_and_leaflet_no_flag(mocked):
    mocked["raw"] = {**HOW_TO, "label": {"dose": "1 tablet", "frequency": "twice a day"},
                     "leaflet": {"dose": "One tablet", "frequency": "2 times a day"}}
    g = post(mocked, [("document", ("l.jpg", JPEG, "image/jpeg"))])
    assert g["facts"]["conflicts"] == []
    assert not any(doctypes.CONFLICT_TEXT in s["text_en"] for s in g["steps"])


def test_leaflet_fills_gap_label_wins_otherwise():
    f = doctypes.merge_medicine({"dose": None, "frequency": None, "warnings": []}, {"dose": "1 tablet"},
                                {"dose": "1 tablet", "frequency": "once a day"})
    assert f["dose"] == "1 tablet" and f["frequency"] == "once a day" and f["conflicts"] == []


def test_letter_output(mocked):
    mocked["raw"] = LETTER
    g = post(mocked, [("document", ("l.jpg", JPEG, "image/jpeg"))], roles="letter")
    assert g["doc_type"] == "letter" and g["domain"] == "council"
    c = g["content"]
    assert set(c) == {"what_this_is", "what_to_do", "by_when", "amounts"}
    assert c["by_when"] == [{"date": "1 December", "what": "pay"}] and c["amounts"][0]["amount"] == "£112"
    assert g["steps"] and g["steps"][-1]["kind"] == "get_help" and "Citizens Advice" in g["steps"][-1]["text_en"]
    assert "facts" not in mocked  # the rewriter is not used for letters


def test_bill_output(mocked):
    mocked["raw"] = BILL
    g = post(mocked, [("document", ("b.pdf", pdf(1), "application/pdf"))])
    assert g["doc_type"] == "bill" and g["safety_lines"] == [doctypes.SAFETY_ADVICE]
    assert any("£112" in s["text_en"] for s in g["steps"])


def test_form_output(mocked):
    mocked["raw"] = FORM
    g = post(mocked, [("document", ("f.jpg", JPEG, "image/jpeg"))], roles="form")
    assert g["doc_type"] == "form" and g["content"] == {"fields": FORM["fields"]}
    assert any("Write your full name." in s["text_en"] for s in g["steps"])
    assert "free advice" in g["steps"][-1]["text_en"]


def test_medicine_safety_line(mocked):
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["safety_lines"] == [doctypes.SAFETY_MEDICINE]
    assert "111" in doctypes.SAFETY_MEDICINE and "pharmacist" in doctypes.SAFETY_MEDICINE
    assert any("pharmacist" in s["text_en"] for s in g["steps"])


def test_no_999_guard(mocked, monkeypatch):
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    r = mocked["client"].post(f"/api/guides/{g['id']}/ask", json={"question": "I have chest pain", "language": "en"}).json()
    assert r["escalate"] != "999" and "Call 999" not in r["answer"]


def test_letter_guide_ask_uses_content(mocked):
    mocked["raw"] = LETTER
    g = post(mocked, [("document", ("l.jpg", JPEG, "image/jpeg"))])
    r = mocked["client"].post("/api/anam/session", json={"guide_id": g["id"], "language": "en"}).json()
    assert "Citizens Advice" in r["personaConfig"]["systemPrompt"] and "DOCUMENT TYPE: letter" in r["personaConfig"]["systemPrompt"]


# ---- limits and validation (no model involved) ----

def test_too_many_files(client):
    files = [("document", (f"{i}.jpg", JPEG, "image/jpeg")) for i in range(docs.MAX_FILES + 1)]
    r = client.post("/api/guides", files=files)
    assert r.status_code == 413 and r.json()["error"] == "too_many_files"


def test_eight_files_ok(client):
    files = [("document", (f"{i}.jpg", JPEG, "image/jpeg")) for i in range(docs.MAX_FILES)]
    assert client.post("/api/guides", files=files).status_code == 200


def test_too_many_pages(client):
    files = [("document", ("a.pdf", pdf(15), "application/pdf")), ("document", ("b.pdf", pdf(6), "application/pdf"))]
    r = client.post("/api/guides", files=files)
    assert r.status_code == 413 and r.json()["error"] == "too_many_pages"


def test_bad_role_and_bad_type(client):
    f = [("document", ("a.jpg", JPEG, "image/jpeg"))]
    r = client.post("/api/guides", files=f, data={"roles": "banana"})
    assert r.status_code == 400 and r.json()["error"] == "bad_role" and "[" not in r.json()["detail"]
    r = client.post("/api/guides", files=f, data={"roles": "label,leaflet"})
    assert r.status_code == 400 and r.json()["error"] == "bad_roles"
    r = client.post("/api/guides", files=[("document", ("a.txt", b"hello", "text/plain"))])
    assert r.status_code == 400 and r.json()["error"] == "unsupported_file_type"
    r = client.post("/api/guides", files=[("document", ("a.jpg", b"not an image", "image/jpeg"))])
    assert r.status_code == 400


def test_roles_json_and_auto():
    assert docs.parse_roles('["label","auto"]', 3) == ["label", None, None]
    assert docs.parse_roles(None, 2) == [None, None]


def test_fixtures_validate():
    fx = pathlib.Path(__file__).resolve().parents[2] / "demo" / "fixtures"
    g = json.loads((fx / "guide_council_letter.json").read_text())
    assert g["doc_type"] == "letter" and g["source"]["is_sample"] and "SAMPLE" in g["source"]["note"]
    assert set(g["content"]) == {"what_this_is", "what_to_do", "by_when", "amounts"}
    assert all(s["text_en"] and s["kind"] in ("what", "when", "how", "warning", "get_help") for s in g["steps"])
    assert [s["index"] for s in g["steps"]] == list(range(len(g["steps"])))
    assert g["safety_lines"] == [doctypes.SAFETY_ADVICE]


def test_extraction_prompt_style_rules():
    from agent import pipeline
    p = pipeline.EXTRACT_SYSTEM
    for phrase in ("15 words", "Great question", "Let's dive in", "Absolutely", "Don't worry", "emoji", "digits"):
        assert phrase in p


# ---- generic (non-medicine) how-to ----
FLATPACK = {"doc_type": "how_to", "domain": "other", "kind": "other", "title": "How to build your bookshelf",
            "source_steps": ["Lay out the parts.", "Screw the sides to the top."], "warnings": ["Ask a second person to help you lift it."],
            "get_help": [], "unreadable": [], "documents": [{"index": 1, "role": "other"}]}


def test_generic_howto_uses_own_path(mocked, monkeypatch):
    from agent import pipeline
    seen = {}

    async def fake_generic(facts, language="en"):
        seen["facts"] = facts
        return [{"text_en": "Lay out the parts.", "kind": "how", "picture_prompt": "parts on a floor"}]

    async def boom(*a, **k):
        raise AssertionError("medicine rewriter must not run")

    monkeypatch.setattr(pipeline, "write_generic_howto", fake_generic)
    monkeypatch.setattr(pipeline, "write_easy_read", boom)
    mocked["raw"] = FLATPACK
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "ready" and g["domain"] == "other"
    assert seen["facts"]["title"] == "How to build your bookshelf" and seen["facts"]["source_steps"]
    assert g["safety_lines"] == [doctypes.SAFETY_HOWTO]
    assert g["steps"][-1]["text_en"] == doctypes.SAFETY_HOWTO and g["steps"][-1]["kind"] == "get_help"
    assert not any("999" in s["text_en"] or "pharmacist" in s["text_en"] for s in g["steps"])


def test_generic_rewrite_prompt_and_kinds(monkeypatch):
    import asyncio
    from agent import llm, rewriter
    got = {}

    async def fake_json(system, content, max_tokens=2000):
        got["system"] = system
        return [{"text_en": "Lay out the parts.", "kind": "bogus", "picture_prompt": ""}, {"text_en": "", "kind": "how"}]

    monkeypatch.setattr(llm, "complete_json", fake_json)
    out = asyncio.run(rewriter.write_generic_howto({"title": "x"}))
    assert "not about medicine" in got["system"] and "what|how|warning|get_help" in got["system"]
    assert out == [{"text_en": "Lay out the parts.", "kind": "how", "picture_prompt": "a person doing one simple task"}]


def test_medicine_safety_unchanged():
    assert doctypes.safety_lines("how_to", "medicine") == [doctypes.SAFETY_MEDICINE]
    assert doctypes.safety_lines("how_to", "other") == [doctypes.SAFETY_HOWTO]


def test_flatpack_fixture():
    fx = json.loads((pathlib.Path(__file__).resolve().parents[2] / "demo" / "fixtures" / "guide_flatpack.json").read_text())
    assert fx["doc_type"] == "how_to" and fx["domain"] == "other"
    assert all(s["image_url"] and s["status"] == "ready" and s["picture_prompt"] for s in fx["steps"])
    assert {s["kind"] for s in fx["steps"]} <= {"what", "how", "warning", "get_help"}
    assert fx["steps"][-1]["text_en"] == doctypes.SAFETY_HOWTO
    assert "medicine" not in json.dumps(fx["steps"]).lower()


def test_count_pages_pypdf_and_fallback(monkeypatch):
    import sys, types
    assert docs.count_pages(pdf(3), "application/pdf") == 3  # regex fallback when pypdf cannot parse the stub
    fake = types.ModuleType("pypdf")
    fake.PdfReader = lambda f: types.SimpleNamespace(pages=[0] * 7)
    monkeypatch.setitem(sys.modules, "pypdf", fake)
    assert docs.count_pages(pdf(3), "application/pdf") == 7


def test_letter_uses_tuned_rewriter_with_doc_type_and_content(mocked, monkeypatch):
    seen = {}

    async def tuned(facts, language="en", doc_type="how_to", content=None):
        seen.update(doc_type=doc_type, content=content)
        return [{"text_en": "This letter is about your council tax.", "kind": "what", "picture_prompt": "a letter"}]

    monkeypatch.setattr(pipeline, "write_easy_read", tuned)
    mocked["raw"] = LETTER
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "ready" and seen["doc_type"] == "letter" and seen["content"] == g["content"]
    assert g["steps"][0]["text_en"] == "This letter is about your council tax."
    assert g["steps"][-1]["kind"] == "get_help"


def test_form_falls_back_when_rewriter_fails(mocked, monkeypatch):
    async def boom(*a, **k):
        raise ImportError("finetune missing")

    monkeypatch.setattr(pipeline, "write_easy_read", boom)
    mocked["raw"] = FORM
    g = post(mocked, [("document", ("a.jpg", JPEG, "image/jpeg"))])
    assert g["status"] == "ready" and len(g["steps"]) >= len(FORM["fields"])


def test_rewriter_wrapper_passes_args_only_for_typed_docs(monkeypatch):
    import asyncio, sys, types
    from agent import rewriter
    calls = []
    mod = types.ModuleType("finetune")

    async def ft(*a):
        calls.append(a)
        return []

    mod.write_easy_read = ft
    monkeypatch.setitem(sys.modules, "finetune", mod)
    asyncio.run(rewriter.write_easy_read({"x": 1}, "en"))
    asyncio.run(rewriter.write_easy_read({"x": 1}, "en", "bill", {"amounts": []}))
    assert calls[0] == ({"x": 1}, "en") and calls[1] == ({"x": 1}, "en", "bill", {"amounts": []})
