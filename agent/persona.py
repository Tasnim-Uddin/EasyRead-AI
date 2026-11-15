"""Anam persona config: system prompt (guide facts + ground rules) and the CONTRACTS section 3 client tools."""
import json, os
from . import langs

# Public stock IDs from Anam's catalogue (GET /v1/avatars, /v1/voices, /v1/llms); override via env.
# Avatar: "Liv" (home), a friendly woman, cara-4. Voice: "Amanda - Warm Guide" (Cartesia, English, warm and calm).
# LLM: GPT OSS 120B, Anam's built-in model, listed as strong at tool calling.
DEFAULTS = {
    "avatarId": "071b0286-4cce-4808-bee2-e642f1062de3",
    "avatarModel": "cara-4",
    "voiceId": "90313ddc-4fc0-11f1-84b0-52bacf74fa75",
    "llmId": "a7cf662c-2ace-4de1-a21e-ef0fbf144bb7",
}

# Anam speech-recognition codes we use. Bengali is beta (Anam's own transcription only).
STT_LANGS = {"en", "es", "ar", "ur", "pl", "bn", "fr", "hi", "pt", "zh"}

LANGS = {c: langs.NAMES[c] for c in ("en", "es", "bn", "ar", "ur", "fr", "hi", "pl", "pt", "zh")}


def stt_supported(language: str) -> bool:
    """False for languages Anam cannot transcribe: the avatar then listens in English and the user can type instead."""
    return language in STT_LANGS

RULES = """GROUND RULES (never break these):
- You explain the user's OWN document. You never give medical advice, diagnose, or change doses or timings.
- Answer questions only from the facts and steps below, using the answer_from_document tool. If it is not in the document, say: "I do not know. Ask your pharmacist or GP." For a non-medicine guide, say: "I do not know. Ask for help."
- Serious symptoms (chest pain, cannot breathe, overdose, allergic reaction): say "call 999" straight away, every time, in every language. Urgent but not an emergency: "call 111".
- Never invent facts. If something was unreadable, say so and ask the user.
- Speak slowly, in short simple sentences, one idea at a time. Use the tools to move through the steps; do not wait silently.
- Technique clips come only from the checked library: use play_technique, never describe unchecked methods.
- Show, don't only tell: when the user asks how to do something (for example "how do I use the pump?") or about something a step covers, first call show_step for the step that answers it, so they see its picture; if that step has a technique clip, call play_technique too; then say the answer in 1 or 2 sentences. For a question that covers several steps, show the first one and offer to go through the rest.
- When the steps are done, use check_understanding for a short 'tell me back' check.
- Plain, calm tone. Never say "Great question", "Absolutely", "Let's dive in", "Don't worry", "Feel free to" or "I'm here to help". No exclamation marks, except in a real warning. Do not praise: name what the person did ("That is right. You use the blue one when you feel tight."). Avoid "simply", "just", "easily", "quickly". Keep each turn to 1 or 2 sentences, then stop.
- For letters, bills and forms: before the user signs or pays, say they should get free advice (for example Citizens Advice)."""


def _tool(name, desc, props=None, required=None):
    return {"type": "client", "name": name, "description": desc,
            "parameters": {"type": "object", "properties": props or {}, "required": required or []},
            "awaitResult": True, "toolTimeoutSeconds": 30}


TOOLS = [
    _tool("show_step", "Show a specific step on screen, then read it aloud. Steps are numbered from 1 for the user but the index starts at 0: when the user says step 3, send index 2.", {"index": {"type": "integer", "description": "0-based step index (user's step number minus 1)"}}, ["index"]),
    _tool("next_step", "Move to the next step when the user is ready."),
    _tool("previous_step", "Go back to the previous step."),
    _tool("play_technique", "Play the checked technique clip for a 'how' step.", {"step_index": {"type": "integer", "description": "0-based step index (user's step number minus 1)"}}, ["step_index"]),
    _tool("answer_from_document", "Answer any user question from the document. Always use this for questions.", {"question": {"type": "string"}}, ["question"]),
    _tool("check_understanding", "Ask a 'tell me back' question, or check the user's reply.", {"answer": {"type": "string", "description": "The user's reply, if checking"}}),
    _tool("set_language", "Switch the captions and your speaking language.", {"language": {"type": "string", "description": "BCP-47 code, e.g. es"}}, ["language"]),
]


def _flow(guide: dict, step_index: int) -> str:
    """How the avatar starts and moves. The screen already shows the current step, so it never re-calls show_step for it."""
    last = max(len(guide.get("steps", [])) - 1, 0)
    return (f"START: greet the user in one short sentence, then read step with index {step_index} aloud. "
            f"That step is already on screen, so do NOT call show_step for it.\n"
            f"MOVING: call show_step, next_step or previous_step only when the user asks to move (for example \"next\", \"go back\", "
            f"\"show me step 3\"). Do not move on by yourself.\n"
            f"CONTEXT MESSAGES: if you receive a message like \"User moved to step N\" (N counts from 1), the screen already shows "
            f"that step. Read aloud the step text quoted in that message (it is steps list index N-1), never the step after it, and do not call a step tool.\n"
            f"INDEXES: step indexes run from 0 to {last}. Never call show_step or play_technique without an integer index in that range. "
            f"If you are not sure which step the user means, ask them.")


def system_prompt(guide: dict, language: str, step_index: int = 0) -> str:
    steps = "\n".join(f"{s['index']}. [{s['kind']}] {s['text_en']}" for s in guide.get("steps", []))
    return (f"You are a calm guide helping someone understand their own paper. "
            f"Speak {langs.name_of(language)} ({language}). If you cannot speak it well, use short simple words and say so once.\n\n{RULES}\n\n"
            f"DOCUMENT TYPE: {guide.get('doc_type', 'how_to')}\nDOCUMENT FACTS:\n{json.dumps(guide.get('facts'), ensure_ascii=False, indent=1)}\n"
            f"DOCUMENT CONTENT:\n{json.dumps(guide.get('content'), ensure_ascii=False, indent=1)}\n"
            f"SAFETY LINES (say these when relevant): {guide.get('safety_lines') or []}\n\n"
            f"EASY READ STEPS:\n{steps}\n\n{_flow(guide, step_index)}")


def voice_id(language: str) -> str:
    """Anam voices are single-language: ANAM_VOICE_ID_<LANG> (e.g. ANAM_VOICE_ID_ES) wins for that language,
    then ANAM_VOICE_ID, then the English default."""
    env = os.environ.get
    per_lang = env(f"ANAM_VOICE_ID_{language.upper()}") if language and language.isalpha() and len(language) <= 8 else None
    return per_lang or env("ANAM_VOICE_ID", DEFAULTS["voiceId"])


def persona_config(guide: dict, language: str, step_index: int = 0) -> dict:
    env = os.environ.get
    cfg = {"name": "Easy Read guide",
           "avatarId": env("ANAM_AVATAR_ID", DEFAULTS["avatarId"]),
           "avatarModel": env("ANAM_AVATAR_MODEL", DEFAULTS["avatarModel"]),
           "voiceId": voice_id(language),
           "llmId": env("ANAM_LLM_ID", DEFAULTS["llmId"]),
           "systemPrompt": system_prompt(guide, language, step_index),
           "tools": TOOLS}
    if stt_supported(language) and language != "en":
        # Tells Anam's speech recognition which language the user speaks (ISO 639 only; others are rejected).
        cfg["languageCode"] = language
    cfg["maxSessionLengthSeconds"] = int(env("ANAM_MAX_SESSION_SECONDS", "600"))
    return cfg
