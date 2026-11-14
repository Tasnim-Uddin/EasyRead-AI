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
  "doc_type": "how_to",                        // how_to | letter | bill | form | other. Missing = how_to (older guides, fixtures)
  "domain": "medicine",                        // medicine | money | legal | school | council | other
  "source": { "kind": "prescription|leaflet|letter|other", "image_urls": ["…"], "is_sample": true,
              "documents": [ { "index": 1, "role": "label", "role_source": "client|detected", "image_url": "…" } ] },  // one per uploaded file, same order as image_urls
  "facts": {                                   // extracted from the document; null when not present
    "medicine": "Salbutamol 100 micrograms inhaler",
    "dose": "2 puffs", "frequency": "when needed, up to 4 times a day",
    "route": "inhaled",
    "device_type": "inhaler_mdi",              // see library device types; "unknown" if unsure
    "device_confidence": 0.86,                 // from the device photo or the text
    "warnings": ["…"], "get_help": ["…"],      // copied faithfully from the document
    "unreadable": ["…"],                       // parts we couldn't read: the avatar must say so
    "conflicts": []                            // medicine: label vs leaflet disagreements, see below. [] when none
  },
  "content": null,                             // null for how_to; the letter/bill/form shape below otherwise
  "safety_lines": ["…"],                       // fixed lines for this doc type (shown as the last step too)
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
  "say": "Take 2 puffs when you feel wheezy. Take your time.", // optional: the line the guide speaks in its bubble, in guide.language. Server default = text plus a short English tail by kind (translated guides: text only). Missing = show `text`
  "picture_prompt": "…",                         // for media/, never shown to users
  "image_url": null,                              // live fal picture (no text in image)
  "technique_clip_id": null,                      // a library clip id when kind == "how"
  "status": "pending|generating|ready|failed"
}
```

### Document types (additive)
The extraction step classifies the whole upload set into `doc_type`. **`steps` is always filled, for every type, in the Step shape above**, so a UI that only knows steps keeps working. `content` carries the structured version for UIs that want it.

| `doc_type` | `content` | Steps |
|---|---|---|
| `how_to` (medicine = `domain: "medicine"`) | `null`; use `facts` | Easy Read rewriter output (unchanged), pictures, technique clips |
| `letter`, `bill`, `other` | `{ "what_this_is": str, "what_to_do": [str], "by_when": [{ "date": str, "what": str }], "amounts": [{ "what": str, "amount": str }] }` | what, then one `how` per action, one `when` per deadline, one `what` per amount, then the safety step |
| `form` | `{ "fields": [{ "label": str, "what_to_write": str }] }` | one `how` step per field, then the safety step |

For `letter`/`bill`/`form`/`other`, `facts` is present with the medicine fields `null` and empty lists.

**Safety lines** (`guide.safety_lines`, also added as a final `get_help` step if not already there):
- medicine: "In an emergency, call 999. For advice, call 111 or ask your pharmacist or GP." (the deterministic 999 guard in `/ask` still runs before any model call)
- how_to, not medicine (furniture, a phone, a boiler; `domain` "other"): "If something breaks or feels unsafe, stop and ask for help." Facts carry `title` and `source_steps`; steps use kinds `what|how|warning|get_help`.
- everything else: "Get free advice before you sign or pay. For example, Citizens Advice."

**Label vs leaflet (medicine).** When both are uploaded, dose and frequency come from the label. If the leaflet says something different, `facts.conflicts` is `[{ "field": "dose|frequency", "label": str, "leaflet": str }]`, `facts.warnings` starts with "Your label and leaflet say different things. Ask your pharmacist.", and one `warning` step with that exact text is included. Neither value is dropped silently.

**Sample:** `demo/fixtures/guide_council_letter.json` (fictional, labelled sample; no images, `image_url: null`, `status: "skipped"`).

## 2. Server HTTP API (`agent/`)
- `POST /api/guides` (multipart: `document` (repeat the field for several files), optional `roles`, optional `device_photo`, `language`) → `{ guide_id }`. Processing continues in the background.
  - Files may be JPEG, PNG, WebP, GIF or PDF (type is sniffed from the bytes). A single `document` works exactly as before.
  - `roles`: optional, aligned with the `document` order. A JSON array (`["label","leaflet"]`) or a comma list (`label,leaflet`). Each is `label | leaflet | device_photo | letter | form | other`; an empty or `auto` entry means "detect it". `device_photo` keeps its own field and always has role `device_photo`. The roles used (client-given or detected) come back in `source.documents`.
  - All files go to the vision model in **one** extraction call.
  - Limits: at most **8 files** (device photo included), **20 pages** in total (a PDF counts its pages), 15 MB per file. Errors are JSON `{ error, detail }`: `413 too_many_files`, `413 too_many_pages`, `413 file_too_large`, `400 unsupported_file_type`, `400 bad_role`, `400 bad_roles` (more roles than files, or not a list), `400 document_required` (when the server has a model key and no file was sent).
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
- `POST /api/tools/{name}` `{ guide_id, ...args }` → `{ say, ... }` for the server-handled tools `answer_from_document`, `check_understanding`, `set_language` (`set_language` also returns the updated `guide`). `POST /api/guides/{id}/check_understanding` `{ answer? }` → `{ say, correct }` is the same logic.
- `POST /api/anam/session` without `ANAM_API_KEY` returns `{ sessionToken: "dev-mock-token", mock: true, personaConfig }` so the UI can integrate.
- `POST /api/tts` `{ text, language }` → `audio/mpeg` (ElevenLabs multilingual model; voice from `ELEVENLABS_VOICE_ID`). Audio is cached on disk by hash of text+language+voice, so repeats cost nothing. Errors are JSON `{ error, detail }`: `503 tts_unavailable` when `ELEVENLABS_API_KEY` is unset (web/ should fall back to the browser voice), `400` empty text, `413` text over 600 characters, `502 tts_failed` if ElevenLabs errors.
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
