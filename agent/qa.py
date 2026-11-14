"""Grounded Q&A with the 999/111 guardrail. The emergency check is deterministic and runs before any model call."""
import json, re
from . import llm
from .pipeline import load_library

EMERGENCY = [  # multilingual substrings, lowercase
    "chest pain", "can't breathe", "cant breathe", "cannot breathe", "struggling to breathe", "hard to breathe",
    "overdose", "took too many", "allergic", "swelling", "face is swelling", "collapsed", "unconscious",
    "suicid", "dolor de pecho", "no puedo respirar", "sobredosis", "alergia", "alérgica", "alérgico",
    "বুকে ব্যথা", "শ্বাস", "ألم في الصدر", "لا أستطيع التنفس", "جرعة زائدة", "حساسية",
    "douleur à la poitrine", "overdosis", "सीने में दर्द", "सांस",
]
URGENT = ["urgent", "getting worse", "urgente", "empeora"]
MSG = {
    "en": {"999": "This sounds serious. Call 999 now.",
           "111": "This may need quick advice. Please call 111 now.",
           "pharmacist": "I can't find that in your document. Please ask your pharmacist or GP."},
    "es": {"999": "Esto puede ser grave. Llame al 999 ahora.",
           "111": "Esto puede necesitar consejo rápido. Llame al 111 ahora.",
           "pharmacist": "No encuentro eso en su documento. Pregunte a su farmacéutico o a su médico."},
}


def msg(kind: str, lang: str) -> str:
    return MSG.get(lang, MSG["en"])[kind]


def emergency_level(q: str) -> str:
    ql = q.lower()
    if any(k in ql for k in EMERGENCY):
        return "999"
    if any(k in ql for k in URGENT):
        return "111"
    return "none"


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


QA_SYSTEM = """You answer a patient's question using ONLY the DOCUMENT FACTS and STEPS provided.
Never give medical advice, diagnose, or change doses. If the answer is not in the document, set grounded=false and tell them to ask their pharmacist or GP.
If the question describes a serious symptom (chest pain, cannot breathe, overdose, allergic reaction) set escalate "999"; urgent but not an emergency "111".
Answer in language '{lang}' in 1-2 short simple sentences. Return JSON only: {{"answer": str, "grounded": bool, "escalate": "none|pharmacist|111|999"}}"""


async def ask(guide: dict, question: str, language: str) -> dict:
    level = emergency_level(question)
    if level == "999":
        return {"answer": msg("999", language), "grounded": True, "escalate": "999"}
    ans = None
    if llm.available():
        try:
            ctx = json.dumps({"facts": guide.get("facts"), "content": guide.get("content"), "doc_type": guide.get("doc_type"), "steps": [s["text_en"] for s in guide.get("steps", [])],
                              "library": [{"device_type": c["device_type"], "caption": c["caption_en"]} for c in load_library()]},
                             ensure_ascii=False)
            r = await llm.complete_json(QA_SYSTEM.format(lang=language), f"DOCUMENT:\n{ctx}\n\nQUESTION: {question}", 500)
            esc = r.get("escalate", "none")
            if esc not in ("none", "pharmacist", "111", "999"):
                esc = "pharmacist"
            if level == "111" and esc == "none":
                esc = "111"
            if esc == "999" and "999" not in r["answer"]:
                r["answer"] += " " + msg("999", language)
            ans = {"answer": r["answer"], "grounded": bool(r.get("grounded")), "escalate": esc}
            if not ans["grounded"] and esc == "none":
                ans["escalate"] = "pharmacist"
        except Exception:
            ans = None
    if ans is None:
        local = _local_answer(guide, question, language)
        if local:
            ans = {"answer": local, "grounded": True, "escalate": level if level != "none" else "none"}
        else:
            esc = "111" if level == "111" else "pharmacist"
            ans = {"answer": msg("111" if esc == "111" else "pharmacist", language), "grounded": False, "escalate": esc}
    return ans
