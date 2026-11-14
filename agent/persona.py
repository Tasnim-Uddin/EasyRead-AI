"""Anam persona config: system prompt (guide facts + ground rules) and the CONTRACTS section 3 client tools."""
import json, os

# Defaults are the public examples from the Anam docs; override via env.
DEFAULTS = {
    "avatarId": "071b0286-4cce-4808-bee2-e642f1062de3",
    "avatarModel": "cara-4",
    "voiceId": "de23e340-1416-4dd8-977d-065a7ca11697",
    "llmId": "a7cf662c-2ace-4de1-a21e-ef0fbf144bb7",
}

LANGS = {"en": "English", "es": "Spanish", "bn": "Bengali", "ar": "Arabic", "ur": "Urdu", "fr": "French",
         "hi": "Hindi", "pl": "Polish", "pt": "Portuguese", "zh": "Chinese"}

RULES = """GROUND RULES (never break these):
- You explain the user's OWN document. You never give medical advice, diagnose, or change doses or timings.
- Answer questions only from the facts and steps below, using the answer_from_document tool. If it is not in the document, say: please ask your pharmacist or GP.
- Serious symptoms (chest pain, cannot breathe, overdose, allergic reaction): say "call 999" straight away, every time, in every language. Urgent but not an emergency: "call 111".
- Never invent facts. If something was unreadable, say so and ask the user.
- Speak slowly, in short simple sentences, one idea at a time. Use the tools to move through the steps; do not wait silently.
- Technique clips come only from the checked library: use play_technique, never describe unchecked methods.
- When the steps are done, use check_understanding for a short 'tell me back' check.
- Plain, calm tone. Never say "Great question", "Absolutely", "Let's dive in" or "Don't worry". No exclamation marks, except in a real warning.
- For letters, bills and forms: before the user signs or pays, say they should get free advice (for example Citizens Advice)."""


def _tool(name, desc, props=None, required=None):
    return {"type": "client", "name": name, "description": desc,
            "parameters": {"type": "object", "properties": props or {}, "required": required or []},
            "awaitResult": True, "toolTimeoutSeconds": 30}


TOOLS = [
    _tool("show_step", "Show a specific step on screen, then read it aloud.", {"index": {"type": "integer", "description": "0-based step index"}}, ["index"]),
    _tool("next_step", "Move to the next step when the user is ready."),
    _tool("previous_step", "Go back to the previous step."),
    _tool("play_technique", "Play the checked technique clip for a 'how' step.", {"step_index": {"type": "integer"}}, ["step_index"]),
    _tool("answer_from_document", "Answer any user question from the document. Always use this for questions.", {"question": {"type": "string"}}, ["question"]),
    _tool("check_understanding", "Ask a 'tell me back' question, or check the user's reply.", {"answer": {"type": "string", "description": "The user's reply, if checking"}}),
    _tool("set_language", "Switch the captions and your speaking language.", {"language": {"type": "string", "description": "BCP-47 code, e.g. es"}}, ["language"]),
]


def system_prompt(guide: dict, language: str) -> str:
    steps = "\n".join(f"{s['index']}. [{s['kind']}] {s['text_en']}" for s in guide.get("steps", []))
    return (f"You are a friendly, calm guide helping someone understand their medicine document. "
            f"Speak {LANGS.get(language, language)} ({language}).\n\n{RULES}\n\n"
            f"DOCUMENT TYPE: {guide.get('doc_type', 'how_to')}\nDOCUMENT FACTS:\n{json.dumps(guide.get('facts'), ensure_ascii=False, indent=1)}\n"
            f"DOCUMENT CONTENT:\n{json.dumps(guide.get('content'), ensure_ascii=False, indent=1)}\n"
            f"SAFETY LINES (say these when relevant): {guide.get('safety_lines') or []}\n\n"
            f"EASY READ STEPS:\n{steps}\n\nStart by greeting the user, then show step 0 and read it.")


def persona_config(guide: dict, language: str) -> dict:
    env = os.environ.get
    cfg = {"name": "Easy Read guide",
           "avatarId": env("ANAM_AVATAR_ID", DEFAULTS["avatarId"]),
           "avatarModel": env("ANAM_AVATAR_MODEL", DEFAULTS["avatarModel"]),
           "voiceId": env("ANAM_VOICE_ID", DEFAULTS["voiceId"]),
           "llmId": env("ANAM_LLM_ID", DEFAULTS["llmId"]),
           "systemPrompt": system_prompt(guide, language),
           "tools": TOOLS}
    if language in LANGS and language != "en":
        cfg["languageCode"] = language
    return cfg
