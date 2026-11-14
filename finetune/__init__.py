"""Easy Read rewriter (CONTRACTS section 6). Adaption fine-tuned model if ADAPTION_MODEL_ID is set, else the base LLM."""
import os
from agent import llm
from .prompt import SYSTEM, user_message


async def _base(facts: dict, doc_type: str = "how_to", content: dict | None = None) -> list[dict]:
    return await llm.complete_json(SYSTEM, user_message(facts, doc_type, content))


async def _adaption(facts: dict, doc_type: str = "how_to", content: dict | None = None) -> list[dict]:
    """Adaption SDK (pip install adaption); reads ADAPTION_API_KEY. ADAPTION_MODEL_ID is the tuned model id
    (or `stack:<slug>`). Sync SDK, so run it in a thread."""
    import asyncio
    from adaption import Adaption

    def call():
        r = Adaption().responses.create(model=os.environ["ADAPTION_MODEL_ID"], instructions=SYSTEM,
                                        input=user_message(facts, doc_type, content), tools=[])
        return r.output_text
    return llm.parse_json(await asyncio.to_thread(call))


async def _tuned(facts: dict, doc_type: str = "how_to", content: dict | None = None) -> list[dict]:
    return await _adaption(facts, doc_type, content)


async def write_easy_read(facts: dict, language: str = "en", doc_type: str = "how_to", content: dict | None = None) -> list[dict]:
    """Returns steps (6-8 for how_to; shorter or longer for letter/bill/form): [{"text_en", "kind", "picture_prompt"}]. Always falls back to the base LLM."""
    if os.environ.get("ADAPTION_MODEL_ID") and os.environ.get("ADAPTION_API_KEY"):
        try:
            return await _adaption(facts, doc_type, content)
        except Exception:
            pass
    return await _base(facts, doc_type, content)
