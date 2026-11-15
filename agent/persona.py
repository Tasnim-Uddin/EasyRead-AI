"""Anam persona config: system prompt (guide facts + ground rules) and the CONTRACTS section 3 client tools."""
import json, os
from . import langs

# Public stock IDs from Anam's catalogue (GET /v1/avatars, /v1/voices, /v1/llms); override via env.
# Avatar: our own cartoon guide (custom cara-4 avatar made from design/guide-cartoon/chosen.png, in the same flat
# cartoon style as the step pictures). Fallback: set ANAM_AVATAR_ID=071b0286-4cce-4808-bee2-e642f1062de3 for the
# realistic stock "Liv" (home). Voice: "Amanda - Warm Guide" (Cartesia, English, warm and calm).
# LLM: GPT OSS 120B, Anam's built-in model, listed as strong at tool calling.
DEFAULTS = {
    "avatarId": "1ebfe4f8-d568-40d1-8e25-5605942050e1",  # cartoon guide; Liv: 071b0286-4cce-4808-bee2-e642f1062de3
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
- You explain the user's OWN paper. You never give advice of your own: no medical, legal or money advice, no diagnosis, no changing doses, times or amounts.
- Answer questions only from the paper (the facts, content and steps below), using the answer_from_document tool. Never invent facts.
- If the paper does not answer the question, say so plainly: "That is not on your paper." Then say who to ask: {who}. Do not guess. Never add advice, help lines or phone numbers that are not on the paper.
- If something on the paper was unreadable, say so and ask the user.
- ONE STEP AT A TIME: say only the step on screen, in 1 or 2 short sentences, then stop talking and wait. Do not ask "Ready to move on?" or "Any questions?" after a step: the screen always shows Back, Next, Speak and Type buttons. Never read several steps in one turn, and never move on by yourself.
- When the user says they are ready ("yes", "next", "go on"), call next_step. When they want to go back, call previous_step. When they name a step, call show_step.
- Show, don't only tell: when a question is about something a step covers, first call show_step for that step so they see it; then answer in 1 or 2 sentences; then stop and wait.
- Technique clips come only from the checked library: use play_technique, never describe unchecked methods.
{check}- Speak slowly, in short simple sentences, one idea at a time. Plain, calm tone. Never say "Great question", "Absolutely", "Let's dive in", "Don't worry", "Feel free to" or "I'm here to help". No exclamation marks. Do not praise: name what the person did. Avoid "simply", "just", "easily", "quickly"."""
# "Check I've got it" is hidden in the app for now (web/src/stage/config.ts SHOW_CHECK); EASYREAD_SHOW_CHECK=1 brings back
# the guide's offer of the 'tell me back' check at the end. The check_understanding tool stays registered either way.
CHECK_RULE = "- When the steps are done, offer a short 'tell me back' check (check_understanding).\n"
ASK_ANY_TIME = "You can ask me anything, any time."


def show_check() -> bool:
    return os.environ.get("EASYREAD_SHOW_CHECK", "").strip().lower() in {"1", "true", "yes"}


def who_to_ask(guide: dict) -> str:
    """Who the user should ask when the paper has no answer: the sender (v4 `guide.sender`), else whoever sent it."""
    sender = guide.get("sender") or {}
    name = (sender.get("name") or "").strip() if isinstance(sender, dict) else ""
    if name:
        contact = (sender.get("contact") or "").strip()
        return f"{name} (the sender of this paper{', contact: ' + contact if contact else ''})"
    return "whoever sent them this paper"


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
    """How the avatar starts and moves. The app shows each step with Back / Next / Speak / Type; she narrates one step per turn, then waits."""
    last = max(len(guide.get("steps", [])) - 1, 0)
    if step_index <= 0:
        start = ("START: the screen shows a welcome with a \"Yes, let's start\" button, not a step yet. Say one short line like "
                 f"\"Hi, I'm your guide. {ASK_ANY_TIME} Are you ready to get started?\" and wait. When the user says yes, call show_step "
                 "with index 0 (or the app will send you a message that the user moved to step 1).\n")
    else:
        start = (f"START: greet the user in one short sentence and say once \"{ASK_ANY_TIME}\", then read step with index {step_index} aloud. "
                 f"That step is already on screen, so do NOT call show_step for it. Then stop and wait.\n")
    return (start +
            f"MOVING: call show_step, next_step or previous_step only when the user asks to move (for example \"next\", \"go back\", "
            f"\"show me step 3\"). Do not move on by yourself.\n"
            f"CONTEXT MESSAGES: if you receive a message like \"User moved to step N\" (N counts from 1), the screen already shows "
            f"that step. Read aloud the step text quoted in that message (it is steps list index N-1), never the step after it, "
            f"and do not call a step tool. Then stop talking and wait: do not ask if they are ready. Follow any other instruction in such a message "
            f"(go slower, say it again, say well done at the end).\n"
            f"INDEXES: step indexes run from 0 to {last}. Never call show_step or play_technique without an integer index in that range. "
            f"If you are not sure which step the user means, ask them.")


def system_prompt(guide: dict, language: str, step_index: int = 0) -> str:
    steps = "\n".join(f"{s['index']}. [{s['kind']}] {s['text_en']}" for s in guide.get("steps", []))
    return (f"You are a calm guide helping someone understand their own paper. "
            f"Speak {langs.name_of(language)} ({language}). If you cannot speak it well, use short simple words and say so once.\n\n{RULES.format(who=who_to_ask(guide), check=CHECK_RULE if show_check() else '')}\n\n"
            f"DOCUMENT TYPE: {guide.get('doc_type', 'how_to')}\nDOCUMENT FACTS:\n{json.dumps(guide.get('facts'), ensure_ascii=False, indent=1)}\n"
            f"DOCUMENT CONTENT:\n{json.dumps(guide.get('content'), ensure_ascii=False, indent=1)}\n"
            f"SENDER (who to ask when the paper has no answer): {who_to_ask(guide)}\n\n"
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
           "avatarId": env("ANAM_AVATAR_ID") or DEFAULTS["avatarId"],
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
