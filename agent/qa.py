"""Grounded Q&A from the user's own paper, with a deterministic 111 nudge for urgent wording."""
import json, re
from . import langs, llm
from .pipeline import load_library

URGENT = ["urgent", "getting worse", "urgente", "empeora"]
MSG = {
    "en": {"111": "This may need quick advice. Call 111 now.",
           "pharmacist": "I do not know. It is not in your paper. Ask your pharmacist or GP."},
    "es": {"111": "Esto puede necesitar consejo rápido. Llame al 111 ahora.",
           "pharmacist": "No encuentro eso en su documento. Pregunte a su farmacéutico o a su médico."},
}


def msg(kind: str, lang: str) -> str:
    # Languages without a table here get the English line (it always has the number to call); the model answer is in their language.
    return MSG.get(lang, MSG["en"])[kind]


def urgency_level(q: str) -> str:
    ql = q.lower().replace("\u2019", "'").replace("\u2018", "'")
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
If the question sounds urgent set escalate "111".
Answer in language '{lang}' in 1-2 short simple sentences. Return JSON only: {{"answer": str, "grounded": bool, "escalate": "none|pharmacist|111"}}"""


async def lmsg(kind: str, lang: str) -> str:
    """Safety line in the user's language. Languages without a table: the model translates it. The English line is
    added only if the translation lost the number to call (111), so a good translation stays all in one language.
    No key or a failed call: English alone."""
    if lang in MSG:
        return MSG[lang][kind]
    en = MSG["en"][kind]
    if lang == "en" or not llm.available():
        return en
    try:
        out = await llm.complete(f"Translate into {langs.name_of(lang)}. Keep numbers as digits. Reply with the translation only.", en, 200)
        out = out.strip()
        number = re.search(r"\d+", en).group()
        return out if out and number in out else (f"{out} {en}" if out else en)
    except Exception:
        return en


async def ask(guide: dict, question: str, language: str) -> dict:
    level = urgency_level(question)
    ans = None
    if llm.available():
        try:
            ctx = json.dumps({"facts": guide.get("facts"), "content": guide.get("content"), "doc_type": guide.get("doc_type"), "steps": [s["text_en"] for s in guide.get("steps", [])],
                              "library": [{"device_type": c["device_type"], "caption": c["caption_en"]} for c in load_library()]},
                             ensure_ascii=False)
            r = await llm.complete_json(QA_SYSTEM.format(lang=langs.name_of(language)), f"DOCUMENT:\n{ctx}\n\nQUESTION: {question}", 500)
            esc = r.get("escalate", "none")
            if esc not in ("none", "pharmacist", "111"):
                esc = "pharmacist"
            if level == "111" and esc == "none":
                esc = "111"
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
            ans = {"answer": await lmsg("111" if esc == "111" else "pharmacist", language), "grounded": False, "escalate": esc}
    return ans
