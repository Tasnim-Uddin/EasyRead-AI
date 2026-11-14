# EasyRead AI

Point your phone at a confusing document (a prescription, medicine leaflet or doctor's letter) and get an **Easy Read guide**: short steps, a picture for every step, in your own language. A friendly avatar reads it to you, answers questions from the document, and shows checked technique clips for using your medicine.

Built for **Imperial AI Hack 2026, Track 03: Voice, Vision & Generative Media**. For people with learning disabilities, low literacy or limited English, older patients, and their carers.

> It explains the user's own document. It never gives medical advice, diagnoses, or changes doses. Serious symptoms always get "call 999" (or 111). All sample prescriptions are fictional.

## How it works

1. **Understand:** a vision model extracts medicine, dose, frequency, device type, warnings and "when to get help" into JSON.
2. **Rewrite:** the Easy Read rewriter (Adaption fine-tuned model, base-LLM fallback) writes 6-8 steps: one idea per sentence, 15 words or fewer.
3. **Pictures:** fal generates one wordless, consistent illustration per step.
4. **Technique clips:** a small library of image-to-video clips, each checked by a human against NHS guidance. Never generated live.
5. **Explain:** an Anam avatar reads each step and drives the viewer with tool calls (`show_step`, `next_step`, `play_technique`, `answer_from_document`, `check_understanding`, `set_language`).
6. **Take home:** a printable Easy Read sheet.

See `CONTRACTS.md` for the Guide JSON, API and tool definitions.

## APIs, models and datasets used

| Service | Used for |
|---|---|
| Anthropic API (Claude) | Document vision/extraction, device identification, translation, grounded Q&A, base Easy Read rewriter, training-data drafting |
| Adaption | Fine-tuned Easy Read rewriter (SFT via AutoScientist), inference via the `adaption` SDK |
| fal | Step illustrations, image-to-video technique clips, photo annotation edits (exact models listed in `media/`) |
| Anam | Avatar persona, client tool calling, session tokens |
| ElevenLabs | Multilingual voices (optional) |
| MongoDB Atlas | Saved guides and technique-clip index (in-memory fallback) |
| Figma / Figma Make | UI design (exports in `design/`) |
| NHS website | Reference for technique clip checking |

**Dataset:** the Easy Read training set is generated in this repo (`finetune/build_dataset.py`) from fictional medicine fact sets (`finetune/seeds.py`), drafted by Claude and filtered by the rubric below. No real patient data.

## Easy Read rewriter and evaluation

`finetune/rubric.py` scores output on 12 mechanical checks: step count, 15 words or fewer per sentence, active voice, no jargon, digits not words, dose faithful to the document, no invented numbers, warning and get-help steps present, wordless drawable picture prompts. The same rubric filters the training data and measures win rate of the tuned model against the base model on held-out medicines (`python -m finetune.eval`).

Results: _to be filled in after the fine-tune run (dataset size, win rate, Adaption leaderboard rank)._

## Run it

```bash
cp .env.example .env            # the server runs on fixtures with no keys
pip install -r requirements.txt && uvicorn agent.main:app --reload --port 8000
cd web && npm install && npm run dev
pytest agent finetune
```

## Team

`@Tasnim-Uddin` (lead, server, Anam) · `@Roddyw123` (web, Figma) · `@AhmedBlackEye` (media, fal) · `@rtkyboba` (fine-tune, demo, README)
