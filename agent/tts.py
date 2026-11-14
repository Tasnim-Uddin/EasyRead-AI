"""ElevenLabs text-to-speech with an on-disk cache so the demo never pays twice."""
import hashlib, os, pathlib
import httpx
from . import langs

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(os.environ.get("TTS_CACHE_DIR", ROOT / ".cache" / "tts"))
DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"  # "Sarah", works with the multilingual models
DEFAULT_MODEL = "eleven_multilingual_v2"
MAX_CHARS = 600


class TTSError(Exception):
    pass


class UnsupportedLanguage(TTSError):
    """The voice model does not speak this language: never read foreign text with an English voice."""


def supported(language: str) -> bool:
    return langs.tts_supported(language)


def api_key() -> str | None:
    return os.environ.get("ELEVENLABS_API_KEY") or None


def voice_id() -> str:
    return os.environ.get("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE


def model_id() -> str:
    return os.environ.get("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL


def cache_path(text: str, language: str, voice: str, model: str) -> pathlib.Path:
    h = hashlib.sha256("\x00".join((text, language, voice, model)).encode()).hexdigest()
    return CACHE / f"{h}.mp3"


async def synthesize(text: str, language: str) -> bytes:
    if not supported(language):
        raise UnsupportedLanguage(language)
    voice, model = voice_id(), model_id()
    p = cache_path(text, language, voice, model)
    if p.exists():
        return p.read_bytes()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                         params={"output_format": "mp3_44100_128"},
                         headers={"xi-api-key": api_key() or "", "Accept": "audio/mpeg"},
                         json={"text": text, "model_id": model})
    if r.status_code >= 400:
        raise TTSError(f"ElevenLabs returned {r.status_code}")
    CACHE.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_bytes(r.content)
    tmp.replace(p)
    return r.content
