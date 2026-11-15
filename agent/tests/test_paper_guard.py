"""Only what the paper says: app-added advice, filler 'the paper does not say' lines, computed doses, dropped paper
facts (course length, amount supplied, printed dates), past dates, one idea per step, short titles.
Every model call is mocked: nothing here touches the network."""
import datetime as dt
import json, time
import pytest
from agent import appstrings, doctypes, paperguard as pg, pipeline, store

TODAY = dt.date(2026, 11, 15)

AMOX_FACTS = {"medicine": "Amoxicillin oral suspension 125mg/5ml, sugar-free", "dose": "125mg",
              "frequency": "three times daily", "route": "by mouth", "duration": "5 days", "quantity": "100ml",
              "device_type": "unknown", "warnings": [], "get_help": [], "source_steps": [], "unreadable": [],
              "conflicts": []}
# The rewriter output from the live test that broke the rules (verbatim).
AMOX_STEPS = [
    {"text_en": "Look at your bottle. The medicine is amoxicillin liquid.", "kind": "what", "picture_prompt": "p"},
    {"text_en": "Check the strength on the bottle. It is 125mg in every 5ml.", "kind": "what", "picture_prompt": "p"},
    {"text_en": "Take a dose of 125mg each time.", "kind": "how", "picture_prompt": "p"},
    {"text_en": "Take your medicine 3 times each day.", "kind": "when", "picture_prompt": "p"},
    {"text_en": "The paper does not say which tool to use to measure the liquid.", "kind": "how", "picture_prompt": "p"},
    {"text_en": "Ask your pharmacist to show you how to measure 125mg.", "kind": "get_help", "picture_prompt": "p"},
]

INH_FACTS = {"medicine": "Flutiform 125micrograms/dose / 5micrograms/dose inhaler (Napp Pharmaceuticals Ltd); "
                         "Ventolin 100micrograms/dose Evohaler (GlaxoSmithKline UK Ltd)",
             "dose": "Flutiform: two puffs. Ventolin: inhale 2 doses.", "frequency": "Flutiform: twice daily. Ventolin: as needed.",
             "route": "Inhale", "duration": None, "quantity": "Flutiform: 120 dose. Ventolin: 200 dose.",
             "device_type": "inhaler_mdi", "warnings": ["PATIENTS - please read the notes overleaf"], "get_help": [],
             "source_steps": [], "unreadable": ["Black boxes hide the name and address.", "The notes on the back are too faint to read."],
             "conflicts": []}
INH_TAIL = [
    {"text_en": "The paper says to read the notes on the back. Read them before you use your inhalers.", "kind": "warning", "picture_prompt": "p"},
    {"text_en": "The notes on the back are too faint to read. The paper does not say what they are. Ask your pharmacist.",
     "kind": "get_help", "picture_prompt": "p"},
]
INH_DATES = [
    {"what": "Flutiform last issued", "what_en": "Flutiform last issued", "date": "2022-06-21", "quote": "Tuesday 21 Jun 2022"},
    {"what": "Flutiform next issue due", "what_en": "Flutiform next issue due", "date": "2022-07-01", "quote": "Fri 01 Jul 2022"},
    {"what": "Ventolin next issue due", "what_en": "Ventolin next issue due", "date": "2022-08-16", "quote": "Tue 16 Aug 2022"},
]


def texts(steps, key="text_en"):
    return [s[key] for s in steps]


# ---------- app-added advice ----------

def test_amoxicillin_drops_app_advice_and_filler():
    out = pg.guard_steps(AMOX_STEPS, AMOX_FACTS, None, "how_to", "medicine")
    joined = " ".join(texts(out)).lower()
    assert "pharmacist" not in joined and "does not say" not in joined
    assert "Take a dose of 125mg each time." in texts(out)          # the dose stays as printed
    assert "It is 125mg in every 5ml." in " ".join(texts(out))       # the printed strength stays


def test_unreadable_said_once_without_who_to_ask():
    out = pg.guard_steps(INH_TAIL, INH_FACTS, None, "how_to", "medicine")
    assert texts(out)[1] == "The notes on the back are too faint to read."


@pytest.mark.parametrize("sentence", [
    "Ask your pharmacist.", "Speak to your GP if you are not sure.", "Check with your doctor first.",
    "Call 111 if you feel unwell.", "Ask someone to help you.", "See a nurse for help.",
])
def test_app_advice_variants_dropped(sentence):
    steps = [{"text_en": "Take 1 tablet a day. " + sentence, "kind": "how", "picture_prompt": "p"}]
    out = pg.guard_steps(steps, {"dose": "1 tablet", "warnings": []}, None, "how_to", "medicine")
    assert texts(out) == ["Take 1 tablet a day."]


def test_advice_the_paper_gives_is_kept():
    facts = {"dose": "1 tablet", "warnings": ["Tell your doctor if you are pregnant."], "get_help": ["Call 111 if you feel very unwell."]}
    steps = [{"text_en": "Tell your doctor if you are pregnant.", "kind": "warning", "picture_prompt": "p"},
             {"text_en": "Call 111 if you feel very unwell.", "kind": "get_help", "picture_prompt": "p"}]
    assert pg.guard_steps(steps, facts, None, "how_to", "medicine") == steps


def test_a_pharmacy_address_label_is_not_an_instruction():
    """'Pharmacy:' printed as an address heading does not allow 'Ask your pharmacist'."""
    facts = {**INH_FACTS, "medicine": INH_FACTS["medicine"] + " Pharmacy: Nottingham"}
    out = pg.guard_steps([{"text_en": "Ask your pharmacist.", "kind": "get_help", "picture_prompt": "p"}], facts, None, "how_to", "medicine")
    assert out == []


def test_letter_content_naming_the_council_keeps_its_contact_line():
    content = {"what_to_do": ["Call the council if you cannot pay."], "by_when": [], "amounts": []}
    steps = [{"text_en": "Call the council if you cannot pay.", "kind": "how", "picture_prompt": "p"},
             {"text_en": "Pay by the date on your letter. This paper does not show the date.", "kind": "when", "picture_prompt": "p"}]
    assert pg.guard_steps(steps, {}, content, "letter", "council") == steps


def test_fixed_app_lines_are_never_touched():
    steps = [{"text_en": appstrings.CONFLICT["en"], "kind": "warning", "picture_prompt": "p"},
             {"text_en": appstrings.no_date_en("Boots Pharmacy"), "kind": "when", "picture_prompt": "p"}]
    assert pg.guard_steps(steps, {}, None, "how_to", "medicine") == steps


def test_key_field_not_said_is_kept():
    steps = [{"text_en": "The paper does not say how much to take.", "kind": "how", "picture_prompt": "p"}]
    assert pg.guard_steps(steps, {}, None, "how_to", "medicine") == steps


@pytest.mark.parametrize("lang,text", [
    ("es", "Tome 1 comprimido al día. Pregunte a su farmacéutico."),
    ("ar", "خذ قرصًا واحدًا كل يوم. اسأل الصيدلي."),
    ("ur", "روزانہ 1 گولی لیں۔ اپنے ڈاکٹر سے پوچھیں۔"),
    ("pl", "Weź 1 tabletkę dziennie. Zapytaj farmaceutę."),
    ("bn", "প্রতিদিন 1টি ট্যাবলেট নিন। আপনার ফার্মাসিস্টকে জিজ্ঞেস করুন।"),
])
def test_translated_advice_dropped_in_every_ui_language(lang, text):
    steps = [{"text_en": "Take 1 tablet a day.", "text": text, "kind": "how"}]
    pg.guard_translated(steps, {"dose": "1 tablet"}, None)
    assert len(pg.sentences(steps[0]["text"])) == 1 and steps[0]["text"] == pg.sentences(text)[0]


# ---------- doses ----------

def test_no_computed_dose():
    facts = {"medicine": "Amoxicillin 125mg/5ml", "dose": "125mg"}
    steps = [{"text_en": "Take 5ml each time.", "kind": "how", "picture_prompt": "p"},
             {"text_en": "Take Amoxicillin 125mg/5ml 3 times a day.", "kind": "when", "picture_prompt": "p"},
             {"text_en": "Take 125mg each time.", "kind": "how", "picture_prompt": "p"}]
    out = pg.guard_steps(steps, facts, None, "how_to", "medicine")
    assert texts(out) == ["Take Amoxicillin 125mg/5ml 3 times a day.", "Take 125mg each time."]


def test_number_words_match_the_printed_dose():
    out = pg.guard_steps([{"text_en": "Take 2 puffs of Flutiform twice a day.", "kind": "when", "picture_prompt": "p"}],
                         INH_FACTS, None, "how_to", "medicine")
    assert len(out) == 1


# ---------- paper facts the writer dropped ----------

def test_amoxicillin_course_length_and_supply_added():
    out = pg.ensure_paper_facts(pg.guard_steps(AMOX_STEPS, AMOX_FACTS, None, "how_to", "medicine"), AMOX_FACTS, [])
    t = texts(out)
    assert "Take it for 5 days." in t and "Amount supplied: 100ml." in t
    assert not any(x.startswith("Your dose") for x in t)  # 125mg already stated


def test_covered_facts_not_repeated():
    steps = [{"text_en": "Take it for 5 days.", "kind": "when"}, {"text_en": "You get 100 ml.", "kind": "what"}]
    assert pg.ensure_paper_facts(steps, {"duration": "5 days", "quantity": "100ml"}, []) == steps


def test_inhaler_dates_and_quantities_added_once():
    steps = [{"text_en": "Take 2 puffs of Flutiform twice a day.", "kind": "when"},
             {"text_en": "Flutiform was last issued on 21 June 2022.", "kind": "when"},
             {"text_en": "Read the notes on the back.", "kind": "warning"}]
    out = pg.ensure_paper_facts(steps, INH_FACTS, INH_DATES)
    t = texts(out)
    assert "Flutiform next issue due: Fri 01 Jul 2022." in t and "Ventolin next issue due: Tue 16 Aug 2022." in t
    assert sum("21" in x for x in t) == 1                       # already stated: not added again
    assert "Amount supplied: Flutiform: 120 dose. Ventolin: 200 dose." in t
    assert t[-1] == "Read the notes on the back."              # facts go before the warnings


@pytest.mark.parametrize("text", ["Next issue due 1 July 2022.", "Due on July 1.", "Due 01/07/2022.", "Due Friday 1st Jul."])
def test_date_covered_spellings(text):
    assert pg.date_covered("2022-07-01", [{"text_en": text}])


def test_date_not_covered_by_other_day():
    assert not pg.date_covered("2022-07-01", [{"text_en": "Due 11 July 2022."}])


def test_future_only_for_reminders_past_still_for_writer():
    dates = INH_DATES + [{"what": "Appointment", "date": "2026-12-01", "quote": "1 Dec 2026"}]
    assert [d["date"] for d in pg.future_only(dates, TODAY)] == ["2026-12-01"]
    w = pg.for_writer(dates, TODAY)
    assert [d["past"] for d in w] == [True, True, True, False]
    assert w[1]["as_printed"] == "Fri 01 Jul 2022"


# ---------- one idea, one step ----------

def test_notes_overleaf_is_one_step():
    raw = pg.guard_steps(INH_TAIL, INH_FACTS, None, "how_to", "medicine")
    out = doctypes.finish_steps(raw, "how_to", "medicine", [], "inhaler_mdi")
    notes = [s for s in out if "notes" in s["text_en"]]
    assert len(notes) == 1
    assert notes[0]["text_en"] == ("The paper says to read the notes on the back. Read them before you use your inhalers. "
                                   "The notes on the back are too faint to read.")


def test_distinct_warnings_stay_apart():
    steps = [{"text_en": "Do not drink alcohol with this medicine.", "kind": "warning"},
             {"text_en": "Do not drive if you feel sleepy.", "kind": "warning"}]
    assert len(pg.merge_related(steps)) == 2


# ---------- titles ----------

def test_short_titles():
    assert pg.short_medicine(INH_FACTS["medicine"]) == "Flutiform and Ventolin"
    assert pg.short_medicine(AMOX_FACTS["medicine"]) == "Amoxicillin oral suspension"
    assert pg.short_title("Your inhalers: Flutiform and Ventolin", INH_FACTS) == "Your inhalers: Flutiform and Ventolin"
    assert pg.short_title(None, INH_FACTS) == "Flutiform and Ventolin"
    assert len(pg.short_title("A very long title that goes on and on and on", {}).split()) == 6


def test_list_row_title_is_short():
    g = {"id": "g_x", "facts": INH_FACTS, "steps": []}
    assert store.summary(g)["title"] == "Flutiform and Ventolin"
    assert store.summary({**g, "title": "Tus inhaladores"})["title"] == "Tus inhaladores"
    assert store.summary({**g, "title": "T", "title_override": "Mine"})["title"] == "Mine"


def test_redaction_notes_never_reach_the_writer():
    w = pipeline.writer_facts(INH_FACTS, INH_DATES)
    assert w["unreadable"] == ["The notes on the back are too faint to read."]
    assert len(w["dates"]) == 3


# ---------- the whole pipeline, mocked ----------

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 50
INH_RAW = {"doc_type": "how_to", "domain": "medicine", "kind": "prescription", "is_document": True,
           "documents": [{"index": 1, "role": "other"}], "short_title": "Your inhalers: Flutiform and Ventolin",
           **{k: INH_FACTS[k] for k in ("medicine", "dose", "frequency", "route", "quantity", "device_type",
                                         "warnings", "get_help", "unreadable")},
           "device_confidence": 0.6, "dates": INH_DATES, "quotes": [], "unreadable_parts": []}


def test_pipeline_states_dates_but_offers_no_past_reminder(client, monkeypatch):
    from agent import llm
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    seen = {}

    async def fake_json(system, content, max_tokens=2000):
        return json.loads(json.dumps(INH_RAW))

    async def fake_write(facts, language="en"):
        seen["facts"] = facts
        return [{"text_en": "You have 2 inhalers. Take 2 puffs of Flutiform twice a day.", "kind": "when", "picture_prompt": "p"},
                {"text_en": "Ask your pharmacist to show you how to use them.", "kind": "get_help", "picture_prompt": "p"}] + INH_TAIL

    monkeypatch.setattr(llm, "complete_json", fake_json)
    monkeypatch.setattr(pipeline, "write_easy_read", fake_write)
    gid = client.post("/api/guides", files=[("document", ("p.jpg", JPEG, "image/jpeg"))], data={"language": "en"}).json()["guide_id"]
    for _ in range(50):
        g = client.get(f"/api/guides/{gid}").json()
        if g["status"] in ("ready", "failed"):
            break
        time.sleep(0.1)
    assert g["status"] == "ready"
    t = " ".join(s["text_en"] for s in g["steps"])
    assert "pharmacist" not in t.lower() and "does not say" not in t
    for quote in ("21 Jun", "01 Jul 2022", "16 Aug 2022"):
        assert quote in t or quote.replace("Jun", "June") in t
    assert g["dates"] == []                                   # every date is past: nothing to remind
    assert all(d["past"] for d in seen["facts"]["dates"])     # the writer was told they are past
    assert g["title"] == "Your inhalers: Flutiform and Ventolin"
    assert sum("notes" in s["text_en"] for s in g["steps"]) == 1
