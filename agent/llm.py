"""Thin Anthropic wrapper. Everything degrades to None/raises LLMUnavailable when no key is set."""
import base64, json, os, re

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")


class LLMUnavailable(Exception):
    pass


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client():
    if not available():
        raise LLMUnavailable("ANTHROPIC_API_KEY not set")
    import anthropic
    return anthropic.AsyncAnthropic()


def file_block(data: bytes, media_type: str) -> dict:
    b64 = base64.standard_b64encode(data).decode()
    kind = "document" if media_type == "application/pdf" else "image"
    return {"type": kind, "source": {"type": "base64", "media_type": media_type, "data": b64}}


async def complete(system: str, content, max_tokens: int = 4000) -> str:
    """content: str or list of content blocks. Returns text."""
    client = _client()
    msg = await client.messages.create(
        model=MODEL, max_tokens=max_tokens, system=system,
        messages=[{"role": "user", "content": content}],
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def parse_json(text: str):
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start < 0:
        raise ValueError("no JSON in model output")
    return json.JSONDecoder().raw_decode(text[start:])[0]


async def complete_json(system: str, content, max_tokens: int = 4000):
    return parse_json(await complete(system, content, max_tokens))
