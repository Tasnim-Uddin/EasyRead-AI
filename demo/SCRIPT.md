# Live final demo script

**Round 1 is a video, not a live demo: see `demo/VIDEO.md`.** This script is for the live final (top 2 per panel). Set up with `demo/CHECKLIST.md` first. All papers and names are fictional (no real patient data).

Phone-sized app in a desktop browser. Dev panel = the "Tool calls (n)" button at the bottom of the app. Keep it open from the avatar part on.

Legend for the key column: **LIVE** needs `ANTHROPIC_API_KEY` (+ `FAL_KEY` for pictures, `ANAM_API_KEY` for the real avatar, `ELEVENLABS_API_KEY` for natural voice). **OFFLINE** works with no keys and no wifi.

| Time | Do (exact clicks / route) | Say | Needs |
|---|---|---|---|
| 0:00 | Home screen. Hold up the printed inhaler label. | "Easy Read, one short sentence and one picture per idea, is made by hand, so almost no document comes in it. A medicine label, a council letter: never. EasyRead AI makes it in seconds, in your language." | OFFLINE |
| 0:15 | Home > add 3 files: label, leaflet, device photo (the three fictional inhaler images the e2e run used: label, leaflet, device photo; they are not in the repo, so copy them to the laptop and a phone, see CHECKLIST). Roles label / leaflet / device photo. Tap make my guide. Reading screen shows. | "One engine, any paper. Here it is a medicine: the label, the leaflet and a photo of the real inhaler. The photo tells us which kind of inhaler, which decides the technique." | LIVE (Anthropic) |
| 0:40 | Summary screen, then step 2 (the warning step). Step pictures arrive one by one. | "The label and the leaflet disagree on the dose. The guide does not pick one. It says so and sends you to the pharmacist. Pictures are drawn by fal in one style, with no words in them, so they work in any language." | LIVE (fal for pictures; fallback: cached run, see Plan B) |
| 1:05 | Talk to the guide. Avatar reads the step and says "next". Open dev panel > Tool calls. | "The Anam avatar drives the guide with tool calls: show step, next step, set language. Every call is in this log." Point at `show_step`, `next_step` lines. | LIVE (Anam). OFFLINE: illustrated stand-in, on-screen buttons call the same tools and log them |
| 1:30 | Language pill in the top bar > Spanish, then Arabic. Layout flips right to left. Back to English. | "Same guide, same pictures, new language and voice. Arabic switches the whole layout right to left." | Interface text OFFLINE. Guide text translation LIVE (Anthropic). Voice LIVE (ElevenLabs / Anam), else browser voice |
| 1:45 | Ask: tap Ask, type "Can I take 6 puffs?". Then type "I can't breathe". Point at the 999 link at the top. | "It answers only from the paper. Not in the paper means ask your pharmacist. And chest pain or can't breathe: it says call 999, every time, checked by keywords before any model runs." | Emergency check OFFLINE. Answers LIVE (Anthropic) |
| 2:05 | Last step > Check I've got it. Answer the question aloud. | "At the end it checks you understood, so you are not left guessing." | OFFLINE (sample), LIVE for the avatar voice |
| 2:20 | Open `#/sample/council` (or upload a fictional council letter image if you have one ready). Show summary: what it is, what to do, by when. | "Same engine, any paper. A council letter. What it is, what to do, by when, what it costs, and: get free advice before you pay." | OFFLINE (sample). LIVE if uploading |
| 2:40 | Open `#/sample/flatpack`, then press Print on the last screen. | "Furniture instructions, same thing. And everyone can take a printed sheet home." | OFFLINE |
| 2:55 | Show base vs tuned (`python -m finetune.eval` output, or slide). | "Our Adaption-tuned rewriter, win rate against the base model: **[WIN RATE %, fill in]**." | OFFLINE (slide) |

If you are running late, drop the 2:40 flat-pack and keep the council letter.

## Plan B: wifi or keys fail

Say it plainly: "This is a saved real run." Everything below is OFFLINE. Start the server (`uvicorn agent.main:app --port 8000`) and the web app, then open these hash routes (base URL is what Vite prints, usually `http://localhost:5173/`).

| Moment | Route |
|---|---|
| Inhaler guide, all stand-in pictures | `#/sample/inhaler` |
| Cached real run (real model output for label + leaflet + device photo, with the label-vs-leaflet conflict warning; stand-in pictures) | `#/sample/cached-inhaler` |
| Specific step (here step 3) | `#/sample/inhaler/step/2` |
| Ask screen | `#/sample/inhaler/ask` |
| Talk screen (avatar stand-in) | `#/sample/inhaler/talk` |
| Check I've got it | `#/sample/inhaler/tellback` |
| Council letter | `#/sample/council` |
| Flat-pack | `#/sample/flatpack` |
| Upload tray / photo check / reading / error / settings | `#/tray`, `#/check`, `#/reading`, `#/error`, `#/settings` |

Offline behaviour: with no Anthropic key, Ask on a sample still works with the built-in grounded fallback and the 999 check. With no Anam key the server returns a mock token and the avatar is the illustrated stand-in; the buttons call the same client tools and the dev panel logs them. With no ElevenLabs key the browser voice reads. Guide text translation needs the key; the interface already has English, Spanish, Arabic, Urdu and Polish.

## Prize-evidence checklist (have each one ready on a tab or slide)

- [ ] **fal:** list of models: `fal-ai/flux/dev` (step pictures, live), `fal-ai/flux-kontext/dev` (annotation edit, in `media/`, not in the live flow), `fal-ai/kling-video/v2.1/standard/image-to-video` (technique clips, offline library, none shipped yet). Grid of step pictures from a real run, and `media/samples/compare/`. Be honest about which are live.
- [ ] **Anam:** the dev panel "Tool calls" log showing `show_step`, `next_step`, `set_language`, `answer_from_document`, `check_understanding` with ms timings, captured during the live avatar run (screenshot it as backup).
- [ ] **Figma:** https://www.figma.com/design/tNc9gbdjtkrXMAgsvRT30w open on a tab, frames next to the built screens, "designing for low literacy" point: one step per screen, big type, read-aloud, right-to-left.
- [ ] **Adaption:** win rate vs base model **[PLACEHOLDER %]**, leaderboard rank **[PLACEHOLDER]**, dataset size **[PLACEHOLDER]**, rubric in `finetune/rubric.py`, base vs tuned side by side.
- [ ] **Track 03 main:** the demo above, and the README APIs/models/datasets table (submission rule).

## 30-second Q&A cheat sheet

- **Is it safe?** It explains the user's own paper. It never diagnoses or changes a dose. Not in the paper: "ask your pharmacist or GP". Emergency words (chest pain, cannot breathe, overdose, allergic reaction, in several languages) trigger "call 999" by keyword, before any model call. Every guide ends with a fixed safety line. Honest limit: the keyword list is not clinical triage and answers are not clinically reviewed.
- **What if the label and leaflet disagree?** The guide says so and tells you to ask a pharmacist. It never picks one silently.
- **Hallucination?** Answers use only extracted facts and steps; unreadable parts are listed as unreadable; pictures have no text, so they cannot show a wrong dose.
- **Cost?** About $0.05 of text model per guide plus about $0.025 per picture (fal), so roughly $0.25 for an 8-step guide with pictures.
- **Patient data?** None. All samples are fictional. Keys stay on the server; the browser only gets an Anam session token. Guides live in memory unless MongoDB is set.
- **Technique videos?** Not shown yet. The library only ever shows clips a named person checked against an nhs.uk page; none is signed off, so we show none. Never generated live.
- **Why not just ask a chatbot?** The output is a fixed Easy Read format (one idea per sentence, 15 words or fewer, a picture each), checked by a rubric, with a spoken walkthrough and a take-home sheet.
- **Languages?** Interface in English, Spanish, Arabic, Urdu, Polish (Arabic and Urdu right to left); guide text translated on demand.
