"""Easy Read rewriter (CONTRACTS section 6). Adaption fine-tuned model if ADAPTION_MODEL_ID is set, else the base LLM."""
import os
from agent import llm
from .prompt import SYSTEM, user_message


async def _base(facts: dict) -> list[dict]:
    return await llm.complete_json(SYSTEM, user_message(facts))


async def _adaption(facts: dict) -> list[dict]:
    # TODO(Ryan): call the Adaption fine-tuned model (ADAPTION_API_KEY / ADAPTION_MODEL_ID) once the
    # inference endpoint is confirmed from their docs. Until then this raises and we fall back to the base LLM.
    raise NotImplementedError("Adaption inference not wired up yet")


async def _tuned(facts: dict) -> list[dict]:
    return await _adaption(facts)


async def write_easy_read(facts: dict, language: str = "en") -> list[dict]:
    """Returns 6-8 steps: [{"text_en", "kind", "picture_prompt"}]. Always falls back to the base LLM."""
    if os.environ.get("ADAPTION_MODEL_ID") and os.environ.get("ADAPTION_API_KEY"):
        try:
            return await _adaption(facts)
        except Exception:
            pass
    return await _base(facts)
