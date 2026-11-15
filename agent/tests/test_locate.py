"""Highlights on the user's own photo (OCR), number cards, dates checked against the paper, who to ask, rename.
No live model calls: OCR runs locally (skipped when rapidocr is not installed)."""
import asyncio, datetime as dt, io
import pytest
from agent import doctypes, locate, pipeline, qa

TODAY = dt.date(2026, 11, 15)


def paper(lines: list[str], underline_after: int | None = None) -> bytes:
    """A white 'photo' with printed lines; optionally a blank form line after line N."""
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    img = np.full((80 + 60 * len(lines), 1100, 3), 255, np.uint8)
    for i, t in enumerate(lines):
        y = 60 + 60 * i
        cv2.putText(img, t, (40, y), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (20, 20, 20), 2, cv2.LINE_AA)
        if underline_after == i:
            (w, _), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 2)
            cv2.line(img, (40 + w + 12, y + 4), (40 + w + 400, y + 4), (20, 20, 20), 2)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


@pytest.fixture(scope="module")
def ocr_ok():
    if not locate.available():
        pytest.skip("rapidocr not installed")


def test_quote_on_paper_gets_a_quad_and_missing_quote_gets_none(ocr_ok):
    page = locate.ocr_image(paper(["Council Tax reminder", "Please pay 212.50 pounds", "by 17 November 2026"]))
    hit = locate.find([page], "17 November 2026", 0)
    assert hit and hit["page"] == 0 and len(hit["quad"]) == 4
    xs, ys = [p[0] for p in hit["quad"]], [p[1] for p in hit["quad"]]
    assert all(0 <= v <= 1 for v in xs + ys)
    assert hit["quad"][0][0] < hit["quad"][1][0] and hit["quad"][0][1] < hit["quad"][3][1]  # clockwise from top-left
    assert ys[0] > 0.5  # third line of three, in the lower half
    assert locate.find([page], "18 November 2026") is None  # digits must match exactly
    assert locate.find([page], "Direct Debit form") is None


def test_form_label_extends_to_end_of_blank_line(ocr_ok):
    page = locate.ocr_image(paper(["Your details", "Full name:"], underline_after=1))
    hit = locate.find([page], "Full name", 0, form=True)
    plain = locate.find([page], "Full name", 0)
    assert hit and plain and hit["quad"][1][0] > plain["quad"][1][0] + 0.2


def test_ocr_runs_in_threads_and_is_cached(ocr_ok):
    data = paper(["Pay by 17 November 2026"])
    pages = asyncio.run(locate.ocr_pages([data, b"%PDF-1.4", None]))
    assert pages[0] and pages[1] is None and pages[2] is None
    assert locate.ocr_image(data) is pages[0]


def test_attach_highlights_and_callouts(ocr_ok):
    page = locate.ocr_image(paper(["Amount due: 212.50", "Pay by 17 November 2026", "Call 3121 456 789"]))
    guide = {"doc_type": "bill", "language": "en", "steps": [
        {"text_en": "Pay 212.50 by 17 November.", "kind": "how"},
        {"text_en": "Call 3121 456 789 if you cannot pay.", "kind": "how"},
        {"text_en": "This is a bill.", "kind": "what"},
        {"text_en": "Pay 99.99 now.", "kind": "how"}]}
    quotes = [{"t": "212.50", "page": 0}, {"t": "17 November 2026", "page": 0}, {"t": "3121 456 789", "page": 0},
              {"t": "99.99", "page": 0}]
    stats = locate.attach(guide, quotes, [page])
    s0, s1, s2, s3 = guide["steps"]
    assert {h["text"] for h in s0["highlights"]} == {"212.50", "17 November 2026"}
    assert s0["callout"]["value"] == "17 November"
    assert s1["highlights"][0]["text"] == "3121 456 789" and s1["callout"] == {"value": "3121 456 789"}
    assert "highlights" not in s2 and "callout" not in s2
    assert "highlights" not in s3  # the model's quote is not printed on the paper: no box
    assert stats["located"] == 3


def test_quotes_for_step_and_money_callout():
    quotes = [{"t": "£212.50"}, {"t": "17 November 2026"}, {"t": "10 November 2026"}, {"t": "Parent name"}]
    got = locate.quotes_for_step("Pay £212.50 by 17 November.", quotes)
    assert [q["t"] for q in got] == ["£212.50", "17 November 2026"]
    assert locate.callout_for({"kind": "how", "text_en": "Pay £212.50 by 17 November."}, got, "en") == {"value": "£212.50", "sub": "by 17 November"}
    assert locate.callout_for({"kind": "how", "text_en": "Pay £212.50 by 17 November."}, got, "es") == {"value": "£212.50"}
    assert [q["t"] for q in locate.quotes_for_step("Parent name: write your name.", quotes, form=True)] == ["Parent name"]
    assert locate.quotes_for_step("Read the letter.", quotes) == []
    labels = [{"t": "Name(s) of account holder(s)"}, {"t": "Signature(s)"}, {"t": "Bank/building society account number"},
              {"t": "Name and full postal address"}]
    pick = lambda text: [q["t"] for q in locate.quotes_for_step(text, labels, form=True)]
    assert pick("Find the box called Signature(s). Sign your name. Every account holder signs.") == ["Signature(s)"]
    assert pick("Find the box called Signature. Sign your name. If there is more than 1 account holder, all account holders sign.") == ["Signature(s)"]
    assert pick("Find the box called Name and full postal address of your bank or building society.") == ["Name and full postal address"]
    assert locate.callout_for({"kind": "warning", "text_en": "x"}, got, "en") is None


def test_dates_year_inference_and_paper_check(ocr_ok):
    assert locate.fix_year("2025-11-17", "17 November", TODAY) == "2026-11-17"
    assert locate.fix_year("2026-01-05", "5 January", TODAY) == "2027-01-05"
    assert locate.fix_year("2026-11-10", "10 November 2026", TODAY) == "2026-11-10"  # printed year is kept
    assert locate.fix_year("nope", "x", TODAY) is None
    page = locate.ocr_image(paper(["Pay by 17 November 2026"]))
    dates = [{"what": "Pay", "what_en": "Pay", "date": "2026-11-17", "quote": "17 November 2026"},
             {"what": "Visit", "what_en": "Visit", "date": "2026-12-01", "quote": "1 December 2026"}]
    kept = locate.check_dates(dates, [page], [], today=TODAY)
    assert [d["what"] for d in kept] == ["Pay"]
    # a PDF with a text layer is checked against its text
    kept = locate.check_dates(dates, [None], ["Your appointment is on 1 December 2026 at 9am."], today=TODAY)
    assert [d["what"] for d in kept] == ["Visit"]


def test_unreadable_regions_from_model_quote(ocr_ok):
    page = locate.ocr_image(paper(["Dose: 2 tablets", "Take with food"]))
    out = locate.unreadable_regions([page], [{"page": 0, "quote": "Take with food", "note": "a smudge after this"}])
    assert out and out[0]["note"] == "a smudge after this" and len(out[0]["quad"]) == 4


def test_normalise_new_fields_and_papers_differ():
    raw = {"doc_type": "letter", "domain": "council", "what_this_is": "A letter.",
           "quotes": [{"t": "£212.50", "p": 1}, {"t": "", "p": 1}],
           "sender": {"name": "Northfield Borough Council", "kind": "council", "contact": "0300 000 0000"},
           "dates": [{"what": "Pay £212.50", "date": "2026-11-17", "time": "9am", "quote": "17 November 2026", "amount": "£212.50"},
                     {"what": "No quote", "date": "2026-11-17"}],
           "unreadable_parts": [{"p": 1, "near": "Signed", "note": "signature"}],
           "differ": [{"field": "amount", "a": "£212.50", "a_doc": 1, "b": "£250.00", "b_doc": 2},
                      {"field": "amount", "a": "£10", "a_doc": 1, "b": "£10", "b_doc": 2}],
           "documents": [{"index": 1, "role": "letter"}, {"index": 2, "role": "other"}]}
    out = doctypes.normalise(raw)
    assert out["quotes"] == [{"t": "£212.50", "page": 0}]
    assert out["sender"] == {"name": "Northfield Borough Council", "kind": "council", "contact": "0300 000 0000"}
    assert out["dates"] == [{"what": "Pay £212.50", "what_en": "Pay £212.50", "date": "2026-11-17", "time": None,
                             "quote": "17 November 2026", "amount": "£212.50"}]
    assert out["unreadable_parts"] == [{"page": 0, "quote": "Signed", "note": "signature"}]
    assert out["facts"]["conflicts"] == [{"field": "amount", "a": "£212.50", "b": "£250.00", "a_page": 0, "b_page": 1}]
    steps = doctypes.finish_steps([{"text_en": "Pay the bill.", "kind": "how", "picture_prompt": "p"}], "letter", "council",
                                  out["facts"]["conflicts"])
    assert steps[0]["text_en"] == doctypes.PAPERS_DIFFER_TEXT and steps[0]["kind"] == "warning"


def test_no_app_added_lines_in_steps():
    for dt_, dom in (("how_to", "medicine"), ("letter", "council"), ("form", "money"), ("how_to", "other")):
        steps = doctypes.finish_steps([{"text_en": "Read the paper.", "kind": "what", "picture_prompt": "p"}], dt_, dom, [])
        text = " ".join(s["text_en"] for s in steps)
        assert "111" not in text and "Citizens Advice" not in text and "pharmacist" not in text
        assert not any(s["kind"] == "get_help" for s in steps)
    # a help line printed on the paper itself is kept
    steps = doctypes.finish_steps([{"text_en": "Read the label.", "kind": "what", "picture_prompt": "p"},
                                   {"text_en": "If you feel very unwell, call 111.", "kind": "get_help", "picture_prompt": "p"}],
                                  "how_to", "medicine", [])
    assert any("111" in s["text_en"] for s in steps)


@pytest.mark.parametrize("sender,lang,who", [
    ({"name": "Northfield Borough Council", "kind": "council"}, "en", "Northfield Borough Council"),
    ({"name": "Boots Pharmacy", "kind": "pharmacy"}, "en", "the pharmacy"),
    ({"name": "St Mary's Primary", "kind": "school"}, "es", "la escuela"),
    (None, "en", "whoever sent it"),
    (None, "pl", "nadawcę"),
])
def test_ask_who(sender, lang, who):
    g = {"sender": sender}
    assert qa.ask_who(g, lang) == who
    assert who in qa.not_on_paper(g, lang)


def test_ungrounded_answer_names_who_to_ask_without_key():
    g = {"steps": [{"text_en": "Pay £212.50 by 17 November.", "kind": "how"}],
         "sender": {"name": "Northfield Borough Council", "kind": "council"}}
    r = asyncio.run(qa.ask(g, "Can I bring my dog to the office?", "en"))
    assert r == {"answer": "That's not on your paper. Ask Northfield Borough Council.", "grounded": False,
                 "escalate": "none", "ask_who": "Northfield Borough Council"}


def test_rename_and_delete(client):
    gid = client.post("/api/guides", data={}).json()["guide_id"]
    r = client.patch(f"/api/guides/{gid}", json={"title": "  My  council letter "})
    assert r.status_code == 200 and r.json()["title_override"] == "My council letter"
    assert client.get(f"/api/guides?ids={gid}").json()["guides"][0]["title"] == "My council letter"
    assert client.patch(f"/api/guides/{gid}", json={"title": ""}).json()["title_override"] is None
    assert client.patch("/api/guides/g_nope", json={"title": "x"}).status_code == 404
    assert client.patch("/api/guides/g_sample_inhaler", json={"title": "x"}).status_code == 404
    assert client.delete(f"/api/guides/{gid}").json() == {"deleted": gid}
    assert client.get(f"/api/guides/{gid}").status_code == 404
    assert client.patch(f"/api/guides/{gid}", json={"title": "x"}).status_code == 404


def test_pipeline_places_quotes_on_the_uploaded_photo(client, monkeypatch, ocr_ok):
    """One mocked extraction; OCR runs on the stored upload; highlights, checked dates and sender land on the guide."""
    import json, time
    from agent import llm
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    raw = {"doc_type": "letter", "domain": "council", "kind": "letter", "what_this_is": "This letter is about your council tax.",
           "what_to_do": ["Pay 112 pounds by 1 December."], "by_when": [], "amounts": [], "unreadable": [],
           "quotes": [{"t": "1 December 2026", "p": 1}, {"t": "Not printed 999", "p": 1}],
           "sender": {"name": "Fenwick Borough Council", "kind": "council", "contact": None},
           "dates": [{"what": "Pay the council tax", "date": "2026-12-01", "quote": "1 December 2026"},
                     {"what": "Made up", "date": "2027-01-05", "quote": "5 January 2027"}]}

    async def fake_json(system, content, max_tokens=2000):
        return json.loads(json.dumps(raw))

    async def no_writer(*a, **k):
        raise RuntimeError("use the content steps")
    monkeypatch.setattr(llm, "complete_json", fake_json)
    monkeypatch.setattr(pipeline, "write_easy_read", no_writer)
    img = paper(["Fenwick Borough Council", "Pay 112 pounds by 1 December 2026"])
    gid = client.post("/api/guides", files=[("document", ("p.png", img, "image/png"))], data={"language": "en"}).json()["guide_id"]
    for _ in range(100):
        g = client.get(f"/api/guides/{gid}").json()
        if g["status"] in ("ready", "failed"):
            break
        time.sleep(0.1)
    assert g["status"] == "ready" and g["safety_lines"] == []
    step = next(s for s in g["steps"] if "1 December" in s["text_en"])
    assert step["highlights"][0]["text"] == "1 December 2026" and step["highlights"][0]["page"] == 0
    assert [d["what_en"] for d in g["dates"]] == ["Pay the council tax"]
    assert g["sender"]["name"] == "Fenwick Borough Council"
