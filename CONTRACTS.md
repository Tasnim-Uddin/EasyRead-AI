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
| Storage | MongoDB Atlas (`pymongo`) when `MONGODB_URI` is set; otherwise one JSON file per guide in `GUIDES_DIR` (default `<repo>/data/guides`, gitignored), loaded at startup. Only the guide JSON is saved (text, facts, URLs), never the uploaded files | `agent/` |

- The frontend dev server proxies `/api/*` to `http://localhost:8000`.
- Python deps go in `requirements.txt` at the repo root.
- Env var names are in `.env.example`. `PICTURE_CONCURRENCY` (default 9, at least 1) sets how many step pictures are made at once.
- Languages use BCP-47 codes (`en`, `es`, `bn`, `ar`, …). `ar`, `ur` and `he` are right-to-left.

## 1. Guide JSON (the central object)

```jsonc
{
  "id": "g_…",
  "status": "extracting|writing|illustrating|ready|failed",
  "error_code": "not_a_document",              // only when failed: not_a_document | unreadable (no words could be read); "error" holds the English message
  "language": "en",
  "doc_type": "how_to",                        // how_to | letter | bill | form | other. Missing = how_to (older guides, fixtures)
  "domain": "medicine",                        // medicine | money | legal | school | council | other
  "source": { "kind": "prescription|leaflet|letter|other", "image_urls": ["…"], "is_sample": true,
              "documents": [ { "index": 1, "role": "label", "role_source": "client|detected", "image_url": "…" } ] },  // one per uploaded file, same order as image_urls
  // Optional, only when a device photo was uploaded, FAL_KEY is set and the device type is known (fal edit, best effort, never blocks the guide):
  //   "device_photo_url": "/api/uploads/…", "device_photo_labelled_url": "https://…" (the photo with numbered circles on its parts, no words),
  //   "device_photo_labels": ["cap", "mouthpiece", "canister"]  // English part keys, circle 1..n in order; the web shows the legend in the user's language
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
- medicine: "For advice, call 111 or ask your pharmacist or GP." (the app adds no 999 line or link; a 999 line printed on the paper itself is kept)
- how_to, not medicine (furniture, a phone, a boiler; `domain` "other"): "If something breaks or feels unsafe, stop and ask for help." Facts carry `title` and `source_steps`; steps use kinds `what|how|warning|get_help`.
- everything else: "Get free advice before you sign or pay. For example, Citizens Advice."

**Label vs leaflet (medicine).** When both are uploaded, dose and frequency come from the label. If the leaflet says something different, `facts.conflicts` is `[{ "field": "dose|frequency", "label": str, "leaflet": str }]`, `facts.warnings` starts with "Your label and leaflet say different things. Ask your pharmacist.", and one `warning` step with that exact text is included. Neither value is dropped silently.

### v4 additions (all optional; old clients ignore them; mirrored in web/src/types.ts)
- `step.visual`: `{ "kind": "closeup", "id": str }` — an animated close-up from the built-in library (`web/src/closeups/`; the id list is `web/src/closeups/ids.json`, read by both `agent/visuals.py` and the web). Missing/null = no close-up; then use highlights on the user's photo, else the picture.
- `step.highlights`: `[{ "page": int, "text": str, "quad": [[x,y]×4] }]` — exact printed words for this step, located on the user's photo by OCR (normalised 0-1, clockwise from top-left). Never guessed by the model: if OCR can't find the quote, no highlight.
- `step.callout`: `{ "value": str, "sub": str? }` — big number/date card, e.g. `{"value":"£212.50","sub":"by 17 Nov"}`.
- `guide.sender`: `{ "name": str, "kind": "pharmacy|gp|hospital|council|school|company|government|other", "contact": str? }` — who sent it; used for "ask X" when a question is not answered by the paper.
- `guide.dates`: `[{ "what", "what_en", "date": "YYYY-MM-DD", "time": "HH:MM"?, "quote", "amount"? }]` — dated actions for Remind me / Add to calendar (calendar file built in the browser).
- `guide.unreadable_regions`: `[{ "page", "quad", "note" }]` — parts of a photo that could not be read.
- `guide.title_override`: user's own name for the guide (`PATCH /api/guides/{id}` `{ "title": str }`).
- Ask result `ask_who`: when `grounded` is false, who to ask instead (from `sender`).
- `POST /api/scan` (multipart `image`, optional `quad` JSON = the user's own corners, normalised) → `{ "quad", "found", "quality": { "ok", "issues": [...], "block", "region"?, "metrics"? }, "size"? }`; no AI, no cost. `issues` ⊂ `small | blurry | dark | low_contrast | glare | cut_off`; `block` only for `small` or very blurry + flat (the UI then has no "Use it anyway"). Optional `region` `[x, y, w, h]` (normalised) marks where the problem is (glare), `metrics` `{ sharpness, brightness, contrast }` are for the dev panel, `size` `[w, h]` is the photo in px after EXIF rotation. Corners are measured on the photo as the phone shows it (EXIF orientation applied).
- The app adds **no** advice/safety lines of its own (no 999, no 111). Lines printed on the paper itself are kept as steps.

**Sample:** `demo/fixtures/guide_council_letter.json` (fictional, labelled sample; no images, `image_url: null`, `status: "skipped"`).

## 2. Server HTTP API (`agent/`)
- `POST /api/guides` (multipart: `document` (repeat the field for several files), optional `roles`, optional `device_photo`, `language`) → `{ guide_id }`. Processing continues in the background.
  - Files may be JPEG, PNG, WebP, GIF or PDF (type is sniffed from the bytes). A single `document` works exactly as before.
  - `roles`: optional, aligned with the `document` order. A JSON array (`["label","leaflet"]`) or a comma list (`label,leaflet`). Each is `label | leaflet | device_photo | letter | form | other`; an empty or `auto` entry means "detect it". `device_photo` keeps its own field and always has role `device_photo`. The roles used (client-given or detected) come back in `source.documents`.
  - `quads` (v4): optional JSON array aligned with `document`; each entry is the paper's 4 corners `[[x,y]×4]` (normalised 0-1, clockwise from top-left, on the photo as shown) or `null`. A photo with a quad is **flattened** (perspective-warped to an upright page) before the vision call; the flat page is the one in `source.image_urls` / `source.documents[].image_url` (so OCR highlights line up), and the original photo is kept on the server too. A quad equal to the whole photo means "no crop". `400 bad_quads` if it is not a JSON array or has more entries than files.
  - All files go to the vision model in **one** extraction call.
  - Limits: at most **8 files** (device photo included), **20 pages** in total (a PDF counts its pages), 15 MB per file. Errors are JSON `{ error, detail }`: `413 too_many_files`, `413 too_many_pages`, `413 file_too_large`, `400 unsupported_file_type`, `400 bad_role`, `400 bad_roles` (more roles than files, or not a list), `400 document_required` (when the server has a model key and no file was sent).
- `GET /api/guides/{id}` → Guide.
- `GET /api/guides?ids=g_a,g_b` → `{ guides: [ { id, title, language, doc_type, created_at, status, thumbnail } ] }`, newest first ("My guides"). `title` = `facts.medicine`, else `content.what_this_is`, else `facts.title`, else the first step's text; `thumbnail` = the first step `image_url` (or null). **Privacy: the list is per device, never global.** The web keeps the ids of the guides it created in `localStorage` (`er.myGuides`) and sends them here; the server returns only those ids (unknown ids and samples are skipped, at most 200). No `ids` → `{ guides: [] }`.
- `DELETE /api/guides/{id}` → `{ deleted: id }`; removes the guide, its saved JSON and its uploaded files. `404` for unknown ids and samples.
- Guides that were still being made when the server stopped come back as `ready` (if their steps were written; unfinished pictures are `failed`) or `failed`.
- `GET /api/guides/{id}/events` → **Server-Sent Events**:
  ```jsonc
  { "type": "guide_status", "guide_id": "g_…", "status": "illustrating" }
  { "type": "step_updated", "guide_id": "g_…", "step": Step }
  { "type": "tool_log", "tool": "next_step", "args": {…}, "ms": 12 }   // dev panel
  ```
- `POST /api/guides/{id}/language` `{ language }` → re-translates the step texts (pictures are reused) → Guide.
- `POST /api/guides/{id}/ask` `{ question, language }` → `{ answer, grounded: bool, escalate: "none"|"pharmacist"|"111" }`. Answers come only from `facts` + the library.
- `POST /api/anam/session` `{ guide_id, language, step_index? }` → `{ sessionToken }` (502 `{detail}` if Anam refuses; web/ then keeps the stand-in). Creates an Anam session token server-side; the persona's system prompt includes the guide's facts and steps plus the ground rules.
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
