"""App-added sentences (conflict, blank date, not on your paper, tell-back, stop messages) are in the guide
language, and the app never names a person or service of its own. No live calls."""
import asyncio, re
import pytest
from agent import appstrings, doctypes, pipeline, postprocess, qa, tellback

ADVICE = re.compile(r"pharmac|farmac|\bGP\b|\b111\b|\b999\b|citizens advice|صيدل|فارماس|ফার্মাসিস্ট|药剂师|फार्मासिस्ट", re.I)


def _all_app_text():
    for table in (appstrings.CONFLICT, appstrings.PAPERS_DIFFER, appstrings.NO_DATE, appstrings.NO_DATE_ANY,
                  appstrings.NO_AMOUNT, appstrings.NOT_A_DOCUMENT, appstrings.UNREADABLE, qa.NOT_ON_PAPER, qa.NOT_ON_PAPER_ANY):
        yield from table.values()
    for t in tellback.TABLE.values():
        yield from (v for k, v in t.items() if k != "accept")


def test_no_app_added_advice_or_people():
    assert [s for s in _all_app_text() if ADVICE.search(s)] == []
    assert not ADVICE.search(postprocess.CONFLICT_TEXT)


def test_every_ui_language_has_every_fixed_line():
    for table in (appstrings.CONFLICT, appstrings.PAPERS_DIFFER, appstrings.NO_DATE, appstrings.NO_DATE_ANY,
                  appstrings.NO_AMOUNT, appstrings.NOT_A_DOCUMENT, appstrings.UNREADABLE, qa.NOT_ON_PAPER, qa.NOT_ON_PAPER_ANY):
        assert set(table) == set(appstrings.UI_LANGS)
        for code in appstrings.UI_LANGS[1:]:
            assert table[code] != table["en"], (code, table["en"])
    for code, t in tellback.TABLE.items():
        assert set(t) == set(tellback.TABLE["en"]), code


@pytest.mark.parametrize("lang,date_word,conflict_word", [("es", "fecha", "prospecto"), ("ar", "التاريخ", "النشرة")])
def test_app_steps_are_translated_without_a_model(monkeypatch, lang, date_word, conflict_word):
    from agent import llm
    monkeypatch.setattr(llm, "available", lambda: False)
    steps = doctypes.finish_steps([{"text_en": "Use 2 puffs.", "kind": "how", "picture_prompt": "p"}], "how_to", "medicine",
                                  [{"field": "dose", "label": "2 puffs", "leaflet": "1 puff"}])
    steps = doctypes.ensure_blank_date_step(steps, ["The date is blank (DD/MM/YYYY)."], {"name": "Leeds City Council"})
    guide_steps = [{"text_en": s["text_en"], "text": s["text_en"], "kind": s["kind"]} for s in steps]
    asyncio.run(pipeline.translate_steps(guide_steps, lang))
    texts = [s["text"] for s in guide_steps]
    assert any(conflict_word in t for t in texts)
    date = next(t for t in texts if date_word in t)
    assert "Leeds City Council" in date  # the sender's name stays as printed
    assert not any(ADVICE.search(t) for t in texts)


def test_blank_date_without_sender_is_generic_in_every_language():
    steps = doctypes.ensure_blank_date_step([], ["date is blank"], None)
    assert steps[-1]["text_en"] == appstrings.NO_DATE_ANY["en"]
    assert appstrings.fixed(steps[-1]["text_en"], "es") == "Su papel no muestra la fecha. Consulte con quien se lo envió."
    assert appstrings.fixed(steps[-1]["text_en"], "Arabic") == appstrings.NO_DATE_ANY["ar"]
    assert appstrings.fixed(steps[-1]["text_en"], "Somali") is None  # the model translates other languages


@pytest.mark.parametrize("lang,expect", [
    ("es", "Eso no está en su papel. Pregunte a quien se lo envió."),
    ("ar", "هذا غير موجود في ورقتك. اسأل من أرسلها."),
])
def test_not_on_paper_in_language(lang, expect):
    assert qa.not_on_paper({"sender": None}, lang) == expect
    named = qa.not_on_paper({"sender": {"name": "Leeds City Council", "kind": "council"}}, lang)
    assert "Leeds City Council" in named and named != expect


def test_medicine_leaflet_names_no_pharmacist():
    g = {"doc_type": "how_to", "domain": "medicine", "sender": {"name": "Flamingo Pharma (UK) Ltd", "kind": "company"}}
    assert qa.ask_who(g, "es") == "quien se lo envió"
    label = {"doc_type": "how_to", "domain": "medicine", "sender": {"name": "Boots", "kind": "pharmacy"}}
    assert qa.ask_who(label, "en") == "the pharmacy"  # printed on the label itself


def test_stop_messages_in_language():
    assert pipeline.not_readable_text("unreadable", "es").startswith("No pudimos leer")
    assert pipeline.not_readable_text("not_a_document", "ar") == appstrings.NOT_A_DOCUMENT["ar"]
    assert pipeline.not_readable_text("unreadable", "Somali") == appstrings.UNREADABLE["en"]


def _conflict(client, lang, sender=None):
    from agent.main import store
    g = {"id": "g_tb", "status": "ready", "language": lang, "doc_type": "how_to", "domain": "medicine", "sender": sender,
         "facts": {"dose": "2 puffs", "frequency": "when needed", "device_type": "inhaler_mdi",
                   "conflicts": [{"field": "dose", "label": "2 puffs", "leaflet": "1 puff"}]},
         "steps": [], "source": {}}
    store.put(g)


@pytest.mark.parametrize("lang,answer,generic,named", [
    ("es", "Preguntaría primero", "quien se lo dio", "la farmacia"),
    ("ar", "سأسأل أولًا", "من أعطاك إياه", "الصيدلية"),
])
def test_tellback_conflict_uses_sender_or_generic(client, lang, answer, generic, named):
    _conflict(client, lang)
    ok = client.post("/api/guides/g_tb/check_understanding", json={"answer": answer}).json()
    assert ok["correct"] is True and generic in ok["say"]
    _conflict(client, lang, {"name": "Boots", "kind": "pharmacy"})
    bad = client.post("/api/guides/g_tb/check_understanding", json={"correct": False}).json()
    assert named in bad["say"] and generic not in bad["say"]


def test_tellback_other_language_uses_model_when_available(client, monkeypatch):
    from agent import llm

    async def fake(system, text, max_tokens=200):
        assert "Somali" in system
        return "SO: " + text
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", fake)
    _conflict(client, "en")
    r = client.post("/api/guides/g_tb/check_understanding", json={"language": "Somali", "correct": True}).json()
    assert r["say"].startswith("SO: Well done")
