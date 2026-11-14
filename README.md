# EasyRead AI

Take a photo of a confusing paper and get an Easy Read guide: short steps, a picture for each step, in your own language. The guide can read each step aloud and answer questions about the paper.

Built for Imperial AI Hack 2026, Track 03: Voice, Vision & Generative Media.

> The guide explains the paper you give it. It does not give medical advice, diagnose, or change a dose. All sample papers in this repo are fictional.

## The problem

Easy Read (one short sentence and one picture for each idea) is an established format for people with learning disabilities. It is written by hand, so it exists for very few documents. A medicine label, a council letter or a bill almost never comes in Easy Read.

People who have to deal with these papers include:

- people with learning disabilities
- people with low literacy
- people who do not read English well
- older people
- the carers who read papers on someone else's behalf

A misread medicine label or a missed payment date has real costs.

## What we built

A phone-sized web app. You add one or more photos or PDFs of a paper, and the server turns them into a guide.

- The engine is generic. It handles a how-to (a medicine device, a flat-pack bookshelf), a letter, a bill or a form. The extraction step decides which one it is (`doc_type`) and picks a matching output and safety line.
- You can add several files for one guide. Each has a role: label, leaflet, device photo, letter, form or other. You can set the role, or the server detects it.
- We built and tested it mainly on medicine. The demo uses an inhaler label, its leaflet and a photo of the inhaler. If the label and leaflet disagree on dose or frequency, the guide says so and tells you to ask a pharmacist. It does not pick one silently.
- Each guide has a step viewer with one step per screen, a picture, large text, and a spoken line for each step.
- The interface has dictionaries for English, Spanish, Arabic, Urdu and Polish. Arabic and Urdu switch the layout to right-to-left. Bengali is in the language list but its dictionary is not finished yet (issue 38). Guide text can be translated into more languages by the server.
- A "call 999" link shows on every guide screen.
- "Ask" answers questions from the paper only. "Tell me back" asks a short check question at the end.
- Settings change text size and speaking speed. There is a printable sheet and a developer panel that logs tool calls.

Three sample guides are built in and work offline: an inhaler (`demo/fixtures/guide_inhaler.json`), a council letter (`guide_council_letter.json`) and a flat-pack bookshelf (`guide_flatpack.json`).

## Screenshots

_To be added before submission._ The app screens are: home, photo check, file tray, reading, summary, step, technique clip, ask, talk to the guide, tell me back, error and settings. The approved phone-first design is in Figma: https://www.figma.com/design/tNc9gbdjtkrXMAgsvRT30w. The earlier Figma Make frames in `design/` were replaced by it.

## How it works

```
Phone (web/, React)                       Server (agent/, FastAPI)
  photos / PDFs + roles   --POST /api/guides-->   extract: one vision call over all files
                                                   -> doc_type, domain, facts, content
                                                   -> write steps (rewriter, or fixed rules for letters/forms)
                                                   -> fal step pictures
  step viewer  <--SSE /api/guides/{id}/events--   guide status and each finished picture
```

1. Extract. All files go to Claude in one call. It returns the document type, the domain, and the facts (medicine, dose, frequency, device type, warnings, when to get help, anything unreadable). For letters, bills and forms it also returns a structured summary: what this is, what to do, by when, amounts. A device photo sets `device_type`, which decides the technique steps.
2. Write the steps. For medicine, `finetune/` writes 6 to 8 Easy Read steps, one idea per sentence, 15 words or fewer. It calls the Adaption fine-tuned model if `ADAPTION_MODEL_ID` and `ADAPTION_API_KEY` are set. Otherwise it runs the same prompt on Claude. Non-medicine how-tos use a generic prompt. Letters, bills and forms try the rewriter and fall back to steps built from the extracted summary.
3. Safety lines. The server adds a fixed final line for the document type (see Safety).
4. Pictures. If `FAL_KEY` is set, fal draws one picture per step in one style with no text in the image. Without a key the steps show without pictures.
5. Translate and speak. Changing the language re-translates the step text with Claude and reuses the pictures. Read-aloud uses ElevenLabs through `/api/tts` and falls back to the browser voice.
6. Ask. `/api/guides/{id}/ask` answers only from the extracted facts and steps. A keyword check for emergencies (chest pain, cannot breathe, overdose, allergic reaction, in several languages) runs before any model call and returns "call 999".
7. Take home. `/api/guides/{id}/sheet` returns a printable HTML page.

`CONTRACTS.md` has the exact Guide JSON, API and tool definitions.

### What works today, and what does not

| Part | Status |
|---|---|
| Upload, extraction, steps, pictures, translation, Ask with the 999 check | Working. Needs `ANTHROPIC_API_KEY`; pictures need `FAL_KEY` |
| Sample guides, all screens, settings, print sheet, dev panel | Working with no keys |
| ElevenLabs voice | Working with `ELEVENLABS_API_KEY`; browser voice otherwise |
| Adaption fine-tuned rewriter | Code is wired in and runs once a tuned model id is set. Results below are not filled in yet.|
| Anam avatar | Planned for the live demo. The server builds the persona and tools and requests a session token, and the web app has the tool handlers. Without `ANAM_API_KEY` the server returns a mock token and the app shows an illustrated stand-in. A live Anam session is not shown in this repo |
| Technique clips | Planned. The library index lists draft clips, but none has a video or a human check yet, so the server shows none |
| Photo annotation (fal image edit) | The function exists in `media/`. The server does not call it yet |
| MongoDB | Optional. Guides stay in memory when `MONGODB_URI` is not set |

Technique clips are only shown from the library, and only when a named person has checked them against an nhs.uk page. They are never generated live.

## Run it

You need Python 3.12 and Node.

```bash
cp .env.example .env     # optional. With no keys, the sample guides still work
pip install -r requirements.txt
uvicorn agent.main:app --reload --port 8000
```

In a second terminal:

```bash
cd web && npm install && npm run dev
```

Open the URL Vite prints. The dev server sends `/api/*` to `http://localhost:8000`. On the home screen, choose a sample to see a finished guide. You can also open one by URL, for example `/#/sample/council`.

With no keys, uploading your own paper does not make a real guide, because extraction needs a model. The samples, screens, language switch, settings and print sheet work.

Keys go in your own local `.env`, which is gitignored:

| Variable | Unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | Extraction from photos, rewriting, translation, grounded answers. `ANTHROPIC_MODEL` overrides the model |
| `FAL_KEY` | Step pictures |
| `ELEVENLABS_API_KEY` | Natural voice. `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID` are optional |
| `ANAM_API_KEY` | Live avatar session token. `ANAM_AVATAR_ID`, `ANAM_VOICE_ID`, `ANAM_LLM_ID` are optional. `ANAM_VOICE_ID_ES/AR/UR/PL/BN` set a voice per language (list candidates with `python tools/anam_voices.py`) |
| `ADAPTION_API_KEY` and `ADAPTION_MODEL_ID` | Fine-tuned rewriter (also needs `pip install adaption`) |
| `MONGODB_URI` | Saved guides across restarts |

Tests:

```bash
EASYREAD_NO_DOTENV=1 pytest agent     # server tests, no keys needed
pytest finetune                       # rubric and dataset tests
cd web && npm run build               # type-check and production build
```

`GET /api/health` shows which keys the server can see.

## APIs, models and datasets

| Service | Model or ID | Used for | Where |
|---|---|---|---|
| Anthropic API (Claude) | `claude-sonnet-5-5` (default; `ANTHROPIC_MODEL` changes it) | Reading photos and PDFs, document type, device type, base Easy Read rewriter, translation, grounded Q&A, training-data drafting | `agent/llm.py` |
| fal | `fal-ai/flux/dev` | Step pictures | `media/fal.py` |
| fal | `fal-ai/flux-kontext/dev` | Photo annotation edit (not called by the server yet) | `media/fal.py` |
| fal | `fal-ai/kling-video/v2.1/standard/image-to-video` | Technique clips, offline library building only (none generated yet) | `media/fal.py` |
| Adaption | Tuned model id from `ADAPTION_MODEL_ID`, via the `adaption` SDK | Fine-tuned Easy Read rewriter | `finetune/__init__.py` |
| Anam | Avatar model `cara-4`, avatar id `071b0286-4cce-4808-bee2-e642f1062de3`, voice and LLM ids from the Anam docs examples; `@anam-ai/js-sdk` | Avatar and client tool calling | `agent/persona.py`, `web/src/useAnam.ts` |
| ElevenLabs | `eleven_multilingual_v2` | Read-aloud in several languages | `agent/tts.py` |
| MongoDB Atlas | `pymongo` | Optional guide storage | `agent/store.py` |
| Figma | File `tNc9gbdjtkrXMAgsvRT30w` (earlier drafts: Figma Make, `design/`) | App design | `design/` |
| Libraries | FastAPI, uvicorn, httpx, pypdf, React 18, Vite, TypeScript | App | `requirements.txt`, `web/package.json` |

Datasets: none from outside. The Easy Read training and evaluation sets are built in this repo (`finetune/build_dataset.py`, `finetune/seeds.py`) from fictional medicine and document fact sets, drafted with Claude and filtered by the rubric. No real patient data. Held-out seeds are never used for training. Sample papers and pictures in `demo/` and `media/samples/` are fictional or generated.

## Easy Read rewriter and evaluation

`finetune/rubric.py` scores a set of steps on mechanical checks: step count, 15 words or fewer per sentence, no jargon, digits for numbers, dose and timing the same as the paper, no invented numbers, warning and get-help steps present, and a drawable picture prompt for each step. A second rubric covers letters, bills and forms, where every date and amount must survive. The same rubric filters the training data and compares the tuned model with the base model on held-out seeds (`python -m finetune.eval`).

Results: _to be filled in after the fine-tune run (dataset size, win rate, Adaption leaderboard rank)._

## Safety

- It explains the user's own paper. It does not give medical advice, diagnose, or change doses.
- Answers come only from the extracted facts and steps. If the answer is not there, the guide says "I do not know" and points to a pharmacist or GP, or to free advice for non-medicine papers.
- The emergency check is keyword matching that runs before any model call. An emergency match returns "call 999". A match on "urgent" or "getting worse" returns "call 111".
- Every guide ends with a fixed safety line for its type:
  - Medicine: "In an emergency, call 999. For advice, call 111 or ask your pharmacist or GP."
  - Other how-to: "If something breaks or feels unsafe, stop and ask for help."
  - Letter, bill, form: "Get free advice before you sign or pay. For example, Citizens Advice."
- Anything the model could not read is listed as unreadable and the guide says so. The prompts tell the model not to add facts.
- Pictures have no text in them, so they cannot show a wrong dose.
- The keyword list is short and is not clinical triage. Answers have not been clinically reviewed. Do not use this as your only source for taking a medicine.
- Keys stay on the server. The browser only gets an Anam session token.

## Prizes we are entering

- Track 03 main prize: a paper becomes a guide with pictures, a voice and answers.
- fal: step pictures in one style from `fal-ai/flux/dev`. Image edit and image-to-video are in `media/` for annotation and the technique library, but are not in the live flow yet (see the status table).
- Anam: an avatar with client tools (`show_step`, `next_step`, `previous_step`, `play_technique`, `answer_from_document`, `check_understanding`, `set_language`). The status table says what runs without a key.
- Figma: designed in Figma first (https://www.figma.com/design/tNc9gbdjtkrXMAgsvRT30w), then built as the web app. Accessibility choices: one step per screen, large type, read-aloud, right-to-left layouts.
- Adaption: the Easy Read rewriter, ranked by win rate against the base model (result to be added above).

## Team

- [@Tasnim-Uddin](https://github.com/Tasnim-Uddin): lead, server, extraction, Q&A, Anam persona
- [@Roddyw123](https://github.com/Roddyw123): web app, Figma design
- [@AhmedBlackEye](https://github.com/AhmedBlackEye): fal media and technique library
- [@rtkyboba](https://github.com/rtkyboba): fine-tune, evaluation, demo, README
