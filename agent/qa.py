"""Grounded Q&A from the user's own paper. When the answer is not on the paper, say so and name who to ask
(from guide.sender). The app adds no advice lines of its own (no 111, no pharmacist line): `escalate` is kept for
older clients and is always "none"."""
import json, re
from . import langs, llm
from .pipeline import load_library

NOT_ON_PAPER = {
    "en": "That's not on your paper. Ask {who}.",
    "es": "Eso no está en su papel. Pregunte a {who}.",
    "ar": "هذا غير موجود في ورقتك. اسأل {who}.",
    "ur": "یہ آپ کے کاغذ پر نہیں ہے۔ {who} سے پوچھیں۔",
    "pl": "Tego nie ma na Twoim papierze. Zapytaj: {who}.",
    "bn": "এটা আপনার কাগজে নেই। {who}-কে জিজ্ঞেস করুন।",
}
# Who to ask, by sender kind, when the paper names a kind of place rather than one we should repeat by name.
WHO = {
    "en": {"pharmacy": "the pharmacy", "gp": "your GP surgery", "hospital": "the hospital", "school": "the school",
           "unknown": "whoever sent it"},
    "es": {"pharmacy": "la farmacia", "gp": "su centro de salud", "hospital": "el hospital", "school": "la escuela",
           "unknown": "quien se lo envió"},
    "ar": {"pharmacy": "الصيدلية", "gp": "عيادة طبيبك", "hospital": "المستشفى", "school": "المدرسة",
           "unknown": "من أرسلها"},
    "ur": {"pharmacy": "فارمیسی", "gp": "اپنے جی پی کلینک", "hospital": "ہسپتال", "school": "اسکول",
           "unknown": "جس نے یہ بھیجا"},
    "pl": {"pharmacy": "aptekę", "gp": "swoją przychodnię", "hospital": "szpital", "school": "szkołę",
           "unknown": "nadawcę"},
    "bn": {"pharmacy": "ফার্মেসি", "gp": "আপনার জিপি সার্জারি", "hospital": "হাসপাতাল", "school": "স্কুল",
           "unknown": "যে পাঠিয়েছে তাকে"},
}


def ask_who(guide: dict, lang: str) -> str:
    """'Northfield Borough Council', 'the pharmacy', 'the school'... in the user's language; else 'whoever sent it'.
    Councils, companies and government offices are named as printed (a name is the same in every language)."""
    s = guide.get("sender") or {}
    table = WHO.get(lang, WHO["en"])
    kind, name = s.get("kind"), (s.get("name") or "").strip()
    if guide.get("domain") == "medicine" and guide.get("doc_type") == "how_to" and kind in (None, "company", "other"):
        return table["pharmacy"]  # a medicine label or leaflet names its maker; the person to ask is the pharmacist
    if kind in table:
        return table[kind]
    if name:
        # "HM Revenue & Customs, Accounts Office Cumbernauld" -> its first part
        return short_name(name)
    if not s and guide.get("domain") in table:
        return table[guide["domain"]]  # an unsigned school form: ask the school
    return table["unknown"]


def short_name(name: str, limit: int = 48) -> str:
    """A sender name short enough to say and to fit the 'Who to ask' chip: 'HM Revenue & Customs, Accounts Office
    Cumbernauld' -> 'HM Revenue & Customs'. Never empty for a non-empty name."""
    name = re.sub(r"\s+", " ", name).strip()
    if len(name) <= limit:
        return name
    head = re.split(r"\s*(?:,|\(|;| - | – | — )\s*", name, maxsplit=1)[0].strip()
    if 2 < len(head) <= limit:
        return head
    cut = name[:limit].rsplit(" ", 1)[0].strip(" ,;-–—")
    return cut or name[:limit]


def not_on_paper(guide: dict, lang: str) -> str:
    return NOT_ON_PAPER.get(lang, NOT_ON_PAPER["en"]).format(who=ask_who(guide, lang))


async def lnot_on_paper(guide: dict, lang: str) -> str:
    """The 'not on your paper' line in any language: the table for the 6 app languages, the model for others."""
    if lang in NOT_ON_PAPER or not llm.available():
        return not_on_paper(guide, lang)
    en = not_on_paper(guide, "en")
    try:
        out = (await llm.complete(f"Translate into {langs.name_of(lang)}. Keep names as they are. Reply with the translation only.", en, 200)).strip()
        return out or en
    except Exception:
        return en


def _words(t: str) -> set[str]:
    return {w for w in re.findall(r"\w+", t.lower()) if len(w) > 3}


def _local_answer(guide: dict, q: str, lang: str):
    """No-LLM fallback: answer verbatim from a fact/step sharing words with the question."""
    f = guide.get("facts") or {}
    cands = [str(f[k]) for k in ("dose", "frequency", "route", "medicine") if f.get(k)] + f.get("warnings", []) + f.get("get_help", [])
    cands += [s["text_en"] for s in guide.get("steps", [])]
    qw = _words(q)
    best = max(cands, key=lambda c: len(qw & _words(c)), default=None)
    if best and qw & _words(best) and lang == "en":
        return best
    return None


QA_SYSTEM = """You answer a question about the user's own paper using ONLY the DOCUMENT FACTS, CONTENT and STEPS provided.
Never give medical, legal or money advice, diagnose, or change doses. Never add advice of your own or phone numbers that are not on the paper.
If the answer is not in the document, set grounded=false.
Answer in language '{lang}' in 1-2 short simple sentences. Return JSON only: {{"answer": str, "grounded": bool}}"""


async def ask(guide: dict, question: str, language: str) -> dict:
    ans = None
    if llm.available():
        try:
            ctx = json.dumps({"facts": guide.get("facts"), "content": guide.get("content"), "doc_type": guide.get("doc_type"),
                              "sender": guide.get("sender"), "dates": guide.get("dates"),
                              "steps": [s["text_en"] for s in guide.get("steps", [])],
                              "library": [{"device_type": c["device_type"], "caption": c["caption_en"]} for c in load_library()]},
                             ensure_ascii=False)
            r = await llm.complete_json(QA_SYSTEM.format(lang=langs.name_of(language)), f"DOCUMENT:\n{ctx}\n\nQUESTION: {question}", 500)
            ans = {"answer": r["answer"], "grounded": bool(r.get("grounded")), "escalate": "none"}
        except Exception:
            ans = None
    if ans is None:
        local = _local_answer(guide, question, language)
        ans = {"answer": local, "grounded": True, "escalate": "none"} if local else {"grounded": False, "escalate": "none"}
    if not ans["grounded"]:
        ans["answer"] = await lnot_on_paper(guide, language)
        ans["ask_who"] = ask_who(guide, language)
    return ans
