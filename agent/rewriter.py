"""Easy Read rewriter. Prefers finetune.write_easy_read; falls back to the base LLM (CONTRACTS section 6 prompt)."""
from . import llm
from .doctypes import STYLE_RULES

RUBRIC = """You write Easy Read steps for people with learning disabilities or low literacy.
Rules: one idea per sentence, max 15 words, active voice, present tense, no medical jargon (or explain it),
numbers as digits. Dose and timing must be EXACTLY faithful to the facts: never invent or change them.
Always include warning and get_help steps if the facts contain any. Every step has a concrete, drawable
picture_prompt (no text, letters or numbers inside the picture). If facts.conflicts is not empty, the label and
leaflet disagree: include exactly ONE warning step "Your label and leaflet say different things. Check with whoever gave it to you." (never a second
one in other words), put it before any step that gives a dose, and use the label's dose and timing. Do not state the dose in the first step.
One idea per step: split anything that has two actions into two steps. Each warning step holds ONE fact (one limit, or one
"tell your doctor" line), never a list of mixed facts.
If facts.technique_outline is present, cover EVERY line of it as how steps in the same order, one action per step, in Easy Read words
(for example breathe out, hold your breath, wait before a second puff). Add no dose or timing that is not in the facts or the outline.
If the medicine is an inhaler and there is no technique_outline, the how steps must still be complete: breathe out gently,
put the mouthpiece in your mouth and close your lips round it, press once and breathe in slowly and deeply, then hold your breath.
Never skip the breathing-in step.
Never repeat a fact: when label and leaflet disagree, the ONE conflict step is enough; do not add warning steps that restate
what the label says, what the leaflet says, or "ask how many puffs". Put all dose limits (times or puffs in 24 hours) in ONE
warning step, and leave out a vague limit ("not more often than advised") when a number is given.
Do not repeat a step. Order: what, then how steps, then warnings, then get_help.
Say only what the paper says. Never add advice or tell the reader who to ask (no "ask your pharmacist", "see your GP",
"call 111" or "ask for help") unless the paper itself says it. If part of the paper cannot be read, say it once in one
plain sentence ("The notes on the back are too faint to read.") and nothing more. Do not write "the paper does not say"
for things a paper would not normally say (which spoon to use); only for a key value left blank (a dose, a date, an amount).
Say the dose exactly as printed (125mg stays 125mg): never convert units or work out a new amount.
If facts.duration, facts.quantity or facts.dates are given, state each one plainly in a step, as printed:
"Take it for 5 days.", "You get 100ml.", "Next issue due: Friday 1 July 2022." A date marked past is said as a plain
fact, never as something to do. At most 2 dates in a step (one medicine's dates together). Keep one idea in one step: lines about the same thing (read the notes on the back, and
they are too faint to read) go together in ONE step. Never mention or guess what black boxes hide.
""" + STYLE_RULES + """
Aim for 6-9 steps (a checked technique outline may need more). Return 6-12 steps as a JSON array of
{"text_en": str, "kind": "what|when|how|warning|get_help", "picture_prompt": str}. JSON only."""


async def write_easy_read(facts: dict, language: str = "en", doc_type: str = "how_to", content: dict | None = None) -> list[dict]:
    """how_to/medicine keeps the old call. letter/bill/form pass doc_type + content to finetune and raise
    if finetune is missing (the medicine rubric below does not fit them), so the caller can fall back."""
    typed = doc_type in ("letter", "bill", "form")
    try:
        from finetune import write_easy_read as ft  # type: ignore
        import inspect
        r = ft(facts, language, doc_type, content) if typed else ft(facts, language)
        if inspect.isawaitable(r):
            r = await r
        return r
    except ImportError:
        if typed:
            raise
    import json
    steps = await llm.complete_json(RUBRIC, "Facts:\n" + json.dumps(facts, ensure_ascii=False))
    return steps


HOWTO_RUBRIC = """You write Easy Read steps for a how-to guide (for example flat-pack furniture, setting up a phone, resetting a boiler)
for people with learning disabilities or low literacy. This is not about medicine: do not mention medicine, doses or pharmacists.
Rules: one action per step, one idea per sentence, max 15 words, action first, active voice, present tense.
Keep the document's order. Never repeat a step. Never invent, drop or change a part, number, setting or warning. If a step is unclear, say so once in plain words.
Never tell the reader who to ask or add advice unless the paper says it.
Use kind "what" for the first step (what you are making or doing), "how" for each action, "warning" for each risk in facts.warnings,
and "get_help" for facts.get_help (only what the paper says). Every step has a concrete, drawable picture_prompt (no text, letters or numbers inside the picture).
""" + STYLE_RULES + """
Return 5-9 steps as a JSON array of
{"text_en": str, "kind": "what|how|warning|get_help", "picture_prompt": str}. JSON only."""

KINDS = ("what", "how", "warning", "get_help")


async def write_generic_howto(facts: dict, language: str = "en") -> list[dict]:
    """Non-medicine how-to guides. Never uses the medicine rubric or the medicine finetune."""
    import json
    steps = await llm.complete_json(HOWTO_RUBRIC, "Facts:\n" + json.dumps(facts, ensure_ascii=False))
    return [{"text_en": s["text_en"], "kind": s.get("kind") if s.get("kind") in KINDS else "how",
             "picture_prompt": s.get("picture_prompt") or "a person doing one simple task"} for s in steps if s.get("text_en")]
