# EasyRead AI contracts

Owner: `@Tasnim-Uddin`. Change only through a PR, and post on the board when it lands. Field names here are the source of truth: don't invent new ones in code.

## Stack
| Part | Choice | Folder |
|---|---|---|
| Frontend | Vite + React + TypeScript, `@anam-ai/js-sdk` | `web/` |
| API server | Python 3.12, FastAPI. Run `uvicorn agent.main:app --reload --port 8000` from the repo root | `agent/` (imports `media/`, `finetune/`) |
| fal | `fal-client` (Python) | `media/` |
| Technique-clip library | JSON index + media files (or fal URLs) | `library/` |
| Easy Read rewriter | Adaption fine-tuned model; base LLM fallback behind the same function | `finetune/` |
| Storage | MongoDB Atlas (`pymongo`); in-memory dict fallback if `MONGODB_URI` is unset | `agent/` |

- The frontend dev server proxies `/api/*` to `http://localhost:8000`.
- Python deps go in `requirements.txt` at the repo root.
- Env var names are in `.env.example`.
- Languages use BCP-47 codes (`en`, `es`, `bn`, `ar`, …). `ar`, `ur` and `he` are right-to-left.

## 1. Guide JSON (the central object)

```jsonc
{
  "id": "g_…",
  "status": "extracting|writing|illustrating|ready|failed",
  "language": "en",
  "source": { "kind": "prescription|leaflet|letter|other", "image_urls": ["…"], "is_sample": true },
  "facts": {                                   // extracted from the document; null when not present
    "medicine": "Salbutamol 100 micrograms inhaler",
    "dose": "2 puffs", "frequency": "when needed, up to 4 times a day",
    "route": "inhaled",
    "device_type": "inhaler_mdi",              // see library device types; "unknown" if unsure
    "device_confidence": 0.86,                 // from the device photo or the text
    "warnings": ["…"], "get_help": ["…"],      // copied faithfully from the document
    "unreadable": ["…"]                        // parts we couldn't read: the avatar must say so
  },
  "steps": [ Step ],
  "created_at": "ISO-8601"
}
```
```jsonc
// Step
{
  "index": 0,
  "text": "Take 2 puffs when you feel wheezy.",  // in guide.language, ≤15 words, one idea
  "text_en": "Take 2 puffs when you feel wheezy.", // English source (for checks + translation)
  "kind": "what|when|how|warning|get_help",
  "picture_prompt": "…",                         // for media/, never shown to users
  "image_url": null,                              // live fal picture (no text in image)
  "technique_clip_id": null,                      // a library clip id when kind == "how"
  "status": "pending|generating|ready|failed"
}
```

## 2. Server HTTP API (`agent/`)
- `POST /api/guides` (multipart: `document` file(s), optional `device_photo`, `language`) → `{ guide_id }`. Processing continues in the background.
- `GET /api/guides/{id}` → Guide.
- `GET /api/guides/{id}/events` → **Server-Sent Events**:
  ```jsonc
  { "type": "guide_status", "guide_id": "g_…", "status": "illustrating" }
  { "type": "step_updated", "guide_id": "g_…", "step": Step }
  { "type": "tool_log", "tool": "next_step", "args": {…}, "ms": 12 }   // dev panel
  ```
- `POST /api/guides/{id}/language` `{ language }` → re-translates the step texts (pictures are reused) → Guide.
- `POST /api/guides/{id}/ask` `{ question, language }` → `{ answer, grounded: bool, escalate: "none"|"pharmacist"|"111"|"999" }`. Answers come only from `facts` + the library.
- `POST /api/anam/session` `{ guide_id, language }` → `{ sessionToken }`. Creates an Anam session token server-side; the persona's system prompt includes the guide's facts and steps plus the ground rules.
- `GET /api/library` → the library index (§5).
- `GET /api/guides/{id}/sheet` → a printable HTML Easy Read sheet (stretch).

## 3. Anam client tools (`type: "client"`, `awaitResult: true`, `toolTimeoutSeconds: 30`)
`web/` registers a handler for each tool. UI-only tools are handled in the browser; the others POST to the server. Every handler returns a short `say` string (one or two sentences) that the avatar talks about.

| Tool | Arguments | Handled by | Effect |
|---|---|---|---|
| `show_step` | `index` | browser | Shows that step |
| `next_step` / `previous_step` | — | browser | Moves through the steps |
| `play_technique` | `step_index` | browser | Plays that step's library clip |
| `answer_from_document` | `question` | server `/ask` | A grounded answer + escalation level |
| `check_understanding` | `answer?` | server | Asks a "tell me back" question, or checks the user's reply |
| `set_language` | `language` | server `/language` + browser | Switches the captions and the avatar's language |

## 4. `media/` Python interface (imported by `agent/`)
```python
STYLE = "simple flat friendly illustration, thick outlines, soft colours, plain white background, one clear action, no text, no letters, no numbers"

async def make_step_picture(picture_prompt: str, seed: int | None = None) -> str: ...   # -> image_url
async def annotate_photo(photo_url: str, labels: list[str]) -> str: ...                 # -> image_url with arrows/highlights
async def make_technique_clip(start_image_url: str, motion_prompt: str) -> str: ...     # -> video_url (offline, library building only)
```
Each function raises `MediaError(msg)` on failure and reads fal model IDs from a `MODELS = {...}` dict in one place.

## 5. Technique library (`library/index.json`)
```jsonc
{ "clips": [
  { "id": "inhaler_mdi_shake", "device_type": "inhaler_mdi", "order": 1,
    "caption_en": "Shake the inhaler 4 times.", "video_url": "…", "poster_url": "…",
    "checked_by": "<github login>", "checked_against": "https://www.nhs.uk/…", "checked_at": "ISO-8601" }
] }
```
Device types: `inhaler_mdi`, `inhaler_mdi_spacer`, `inhaler_dry_powder`, `cream_ointment`, `tablets`, plus the stretch types `eye_drops` and `nasal_spray`. **A clip without `checked_by` is never shown to users.**

## 6. `finetune/` Python interface
```python
def write_easy_read(facts: dict, language: str = "en") -> list[dict]:
    """Returns 6–8 steps: [{"text_en", "kind", "picture_prompt"}].
    Uses the Adaption model if ADAPTION_MODEL_ID is set, otherwise the base LLM with the same prompt."""
```
Easy Read rubric (used by the model **and** by the eval):
- one idea per sentence, ≤15 words, active voice, present tense
- no medical jargon (or it's explained), numbers as digits
- the dose and timing are exactly faithful to `facts`
- warnings and get-help steps always included
- every step has a concrete, drawable `picture_prompt`

## 7. Fixtures
`demo/fixtures/guide_inhaler.json` (a full Guide with `status: "ready"`) plus its images in `demo/fixtures/img/`. Owned by `@rtkyboba`; until it exists, the lead's first PR adds a minimal version.
