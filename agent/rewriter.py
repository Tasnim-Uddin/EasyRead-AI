"""Easy Read rewriter. Prefers finetune.write_easy_read; falls back to the base LLM (CONTRACTS section 6 prompt)."""
from . import llm

RUBRIC = """You write Easy Read steps for people with learning disabilities or low literacy.
Rules: one idea per sentence, max 15 words, active voice, present tense, no medical jargon (or explain it),
numbers as digits. Dose and timing must be EXACTLY faithful to the facts: never invent or change them.
Always include warning and get_help steps if the facts contain any. Every step has a concrete, drawable
picture_prompt (no text, letters or numbers inside the picture). Return 6-8 steps as a JSON array of
{"text_en": str, "kind": "what|when|how|warning|get_help", "picture_prompt": str}. JSON only."""


async def write_easy_read(facts: dict, language: str = "en") -> list[dict]:
    try:
        from finetune import write_easy_read as ft  # type: ignore
        import inspect
        r = ft(facts, language)
        if inspect.isawaitable(r):
            r = await r
        return r
    except ImportError:
        pass
    import json
    steps = await llm.complete_json(RUBRIC, "Facts:\n" + json.dumps(facts, ensure_ascii=False))
    return steps
