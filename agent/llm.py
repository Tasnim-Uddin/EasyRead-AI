"""Thin Anthropic wrapper. Everything degrades to None/raises LLMUnavailable when no key is set."""
import base64, json, os, re

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")


class LLMUnavailable(Exception):
    pass


class LLMError(Exception):
    """A failure the web can show: `code` is the guide's error_code, `detail` the plain message."""
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code, self.detail = code, detail


TIMEOUT_S = float(os.environ.get("ANTHROPIC_TIMEOUT_S", "90"))
MAX_IMAGE_BYTES = 4 * 1024 * 1024   # Anthropic's limit is ~5 MB per image; stay under it
MAX_EDGE = 2000


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client():
    if not available():
        raise LLMUnavailable("ANTHROPIC_API_KEY not set")
    import anthropic
    return anthropic.AsyncAnthropic(timeout=TIMEOUT_S, max_retries=1)


def prepare_image(data: bytes, media_type: str) -> tuple[bytes, str]:
    """Big phone photos: long edge <= MAX_EDGE, re-encoded as JPEG q85, when the file is large or wide.
    Small images pass through untouched. Raises LLMError('image_unreadable'|'image_too_large') when it cannot be used."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        if len(data) > MAX_IMAGE_BYTES:
            raise LLMError("image_too_large", "This photo is too big. Take it again at a lower quality.")
        return data, media_type
    import io
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception:
        if len(data) <= MAX_IMAGE_BYTES:
            return data, media_type  # small and not decodable here: let the model try it
        raise LLMError("image_unreadable", "We could not open this photo. Take a new photo and try again.")
    if len(data) <= MAX_IMAGE_BYTES and max(im.size) <= MAX_EDGE:
        return data, media_type
    try:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, "white")
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((MAX_EDGE, MAX_EDGE))
        out = io.BytesIO()
        im.save(out, "JPEG", quality=85)
    except Exception:
        raise LLMError("image_unreadable", "We could not open this photo. Take a new photo and try again.")
    return out.getvalue(), "image/jpeg"


def file_block(data: bytes, media_type: str) -> dict:
    if media_type != "application/pdf":
        data, media_type = prepare_image(data, media_type)
    b64 = base64.standard_b64encode(data).decode()
    kind = "document" if media_type == "application/pdf" else "image"
    return {"type": kind, "source": {"type": "base64", "media_type": media_type, "data": b64}}


async def complete(system: str, content, max_tokens: int = 4000) -> str:
    """content: str or list of content blocks. Returns text."""
    client = _client()
    import anthropic
    try:
        msg = await client.messages.create(
            model=MODEL, max_tokens=max_tokens, system=system,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.APITimeoutError:
        raise LLMError("ai_timeout", "This is taking too long. Please try again.")
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
