# Demo video plan (judging round 1)

Round 1 plays our demo video (2 minutes at most), then 6 minutes of questions. There is no live demo and no slides in round 1, so the video does all the showing. The top 2 per panel go to a live final, which uses `demo/SCRIPT.md`.

**Deadline:** the video is uploaded and linked on Devpost, and the last commit is pushed, before **Sun 12:00**.

**Target length:** 1:55 at most. Narration is about 235 words (at most 260; about 150 words a minute, so under 1:40 of speech, plus short pauses). This plan is for the v3 guide-led UI (PR #96).

**Scoring we aim at (VVGM):** experience 25, technical integration 25, creativity 20, usefulness 15, video and answers 15. **Bounties:** fal and Anam (our 2 track bounties), plus the open prizes Figma (best designed) and Adaption (win rate). Bounties are judged on how central the partner's tool is, so fal and Anam each get their own clear shot.

All papers in the video are fictional (`demo/inputs/`). No real patient data.

## Honesty rules for the video

- Technique clips are **not clinically checked yet**. They show only in demo mode (`SHOW_UNCHECKED_CLIPS=1`), with the "not yet checked" badge visible. Keep the badge in shot and say it.
- Labels on the user's own device photo are **off** (`DEVICE_PHOTO_LABELS` unset). Do not show or claim them.
- The **Adaption fine-tune is evidence**, not the live writer. The app writes the steps with Claude. Say "we also fine-tuned", never "the app runs our fine-tuned model".
- The Adaption result is the EasyRead win rate **0.7712** (77.12%) against base Qwen3.5-4B. Say it as evidence, not as the live writer.

## Shot list (v3 guide-led UI, PR #96)

**Open the app with `?demo=1`** (`http://localhost:5173/?demo=1`, or the phone link). Record **without** `?debug=1`: the debug panel stays hidden, so the Anam tool calls are shown by what the guide does (the step moves), not by a log. Use the sample inhaler (`#/sample/cached-inhaler` or the three `demo/inputs/` files) for reliability; one real upload is optional.

The v3 flow: Home, upload paper(s), "Making your guide" (Cancel), Summary ("Your steps") with **Start with my guide** (one tap starts the live Anam guide, who narrates step 1), then the steps with the guide dock (video tile, status chip "Guide is talking", caption, pause, sound, ask, hide). The guide follows Back and Next.

| # | Time | On screen | Narration (exact words) | Evidences |
|---|---|---|---|---|
| 1 | 0:00 to 0:11 | Close-up of the printed fictional inhaler label in a hand, cut to Home. | "Lots of people can't read the paper that comes with their medicine. Easy Read helps: one short sentence, one picture. But it's made by hand, so almost nobody gets one." | Hook. Usefulness. |
| 2 | 0:11 to 0:20 | Home > upload `inhaler_label.png`, `inhaler_leaflet.png`, `inhaler_device.png` > **Making your guide** screen (1 to 2 s, Cancel visible). Backup: `#/sample/cached-inhaler`. | "EasyRead AI turns any paper into a guide. Upload a label, its leaflet and a photo of the inhaler." | Real flow, any paper. Vision over 3 files. |
| 3 | 0:20 to 0:30 | Summary, **Your steps**: the label vs leaflet conflict box ("Ask your pharmacist"), hold 2 s. | "The label and leaflet disagree on the dose. The guide says so, and sends you to your pharmacist." | Safety. Usefulness. |
| 4 | 0:30 to 0:48 | Tap **Start with my guide**. The guide dock opens on step 1: video tile, chip **Guide is talking**, caption. Let 3 s of the guide's voice play. Show the step picture. | "One tap starts a live Anam guide, who talks you through step one. Every picture is drawn live by fal, in one style, with no words inside, so it works in any language." | **Anam** live guide. **fal** pictures. Experience. |
| 5 | 0:48 to 1:08 | Say "next": the guide moves to step 2 (the tool call, no log shown). Tap **Ask a question** on the step: the sheet says "You are still on step 2". Type "Can I give my inhaler to my brother?" > "ask your pharmacist or GP". | "Say next, and the guide calls a tool and moves the step. Ask a question and it answers only from your document. If it isn't there, it says ask your pharmacist." | **Anam** tool calls (`next_step`, `answer_from_document`). Safety refusal. |
| 6 | 1:08 to 1:20 | Press step > **Show me how**: the Kling clip plays, guide goes quiet, "not yet checked" badge in shot. Backup: `#/sample/inhaler/clip/3`. | "Show me how plays a clip made with fal's Kling model. A pharmacist hasn't checked it yet, so it carries this badge." | **fal** Kling clip. Honesty. |
| 7 | 1:20 to 1:32 | **Check I've got it**: 3 tap questions, answer one wrong, the guide reads the same verdict aloud. Show **Skip** once. | "Check I've got it asks three tap questions, and the guide reads the verdict back. That is the check understanding tool." | **Anam** `check_understanding`. Experience. |
| 8 | 1:32 to 1:42 | Language switch to Arabic: summary and a step flip right to left (or Spanish). Then My guides or the council letter summary (`#/sample/council`). | "Switch to Arabic and the whole guide flips right to left. It works on any paper, like this council letter." | Any language, RTL. Creativity. |
| 9 | 1:42 to 1:55 | `design/evidence-grid.jpg` 4 s, the Figma design journey page, then a title card: "Adaption fine-tune: EasyRead win rate 0.7712 vs base Qwen3.5-4B" and the repo link. | "We designed it in Figma first, and the design journey page shows how. We also fine-tuned an Easy Read writer with Adaption: it wins 77.12 percent against its base model, Qwen3.5-4B." | **Figma**. **Adaption** 0.7712 win rate. |

End card (no narration, 1 to 2 seconds, inside the 1:55): "EasyRead AI. Any paper, made easy. Fictional sample papers. Not medical advice."

Spoken by you on camera mic in shots 4 to 5: "Next." Typed in shot 5: the question.

If you run long, cut in this order: the Skip tap and the second wrong answer in shot 7, the council letter half of shot 8, the typing in shot 5 (show the sheet and the answer only).

## Recording tips

**Spend.** One live inhaler run costs about $0.45 (Claude extraction and rewrite plus fal pictures). Do not record live runs over and over:
1. Do one live run of the three inhaler files and one of the council letter. Record the screen while they run (that is the real-flow footage for shots 2 to 4 and 8). A sample run (`#/sample/cached-inhaler`) is fine for everything; one real upload is optional.
2. Re-record retakes on the finished guides (they are saved and listed under My guides), or on `#/sample/cached-inhaler` and `#/sample/council` for B-roll. Do not restart uvicorn between takes.
3. Ask, Listen and translation cost a few cents each. The avatar uses Anam minutes, so keep the talk takes short.

**Server for recording.** Full `.env` on the demo laptop, plus `SHOW_UNCHECKED_CLIPS=1` so the clips show with their badge. Leave `DEVICE_PHOTO_LABELS` unset. Check `curl localhost:8000/api/health` shows the keys as true.

**Browser.** Chrome, fresh profile, no extensions, no bookmarks bar. DevTools device toolbar at 390 x 844 (iPhone 14 size), or a 390 px wide window, then close DevTools panes so only the phone view shows. Zoom 100%. Allow the microphone for localhost. Do not use `?debug=1` when recording: the debug panel must stay hidden. Start from `http://localhost:5173/?demo=1` or the phone link.

**Screen recorder.** OBS Studio (Linux, Mac, Windows): canvas and output 1920 x 1080, 30 fps, MP4 (or MKV then remux), a Window Capture or a cropped Display Capture of the phone view, scaled up to fill most of the frame height. Add two audio sources: **Desktop Audio** (this is how the Anam avatar and the ElevenLabs Listen voice get into the recording) and your **Mic**. On a Mac, QuickTime does not record system audio, so use OBS or the macOS 14+ screen capture with a virtual audio device.

**Mic.** Use a headset or earbuds with a mic, so the avatar's voice does not echo back into its own microphone. Record in a quiet room.

**Narration.** Easiest: record the screen with desktop audio and your spoken commands, then record the narration as a separate voice-over track afterwards, reading the table. Duck the app audio under the narration, and bring it up for the 2 to 3 seconds of guide audio.

**Cut points.** Cut out: the wait on the reading screen (keep 1 to 2 seconds of progress), picture loading beyond the first two pictures (or speed it up), the guide connecting, any typing longer than 2 seconds (speed it up). Put a hard cut between shots; no fancy transitions.

**Captions.** Burn in captions. The product is about accessibility, so judges will notice. Make an `.srt` from the narration column (one line per sentence, timed to the voice-over), then either use the editor's auto-captions (CapCut, DaVinci Resolve, iMovie) and fix the words, or `ffmpeg -i edit.mp4 -vf subtitles=video.srt -c:a copy video_captioned.mp4`. Large, high-contrast text, bottom of the frame, not over the guide dock controls.

**Export.** 1080p MP4 (H.264, AAC). Check it is 1:55 or less. Watch it once with the sound off (captions readable?) and once with the sound on.

**Upload.** YouTube, visibility **Unlisted**, title "EasyRead AI demo (Imperial AI Hack 2026)". Paste the link into Devpost and into `DEVPOST.md`. Open the link in a private window to check it plays without signing in.

## 6-minute Q&A prep

Short, honest answers. One person answers each, the others stay quiet.

1. **Is it safe to give medicine instructions with AI?**
   It explains the user's own paper. It never diagnoses or changes a dose. If the answer is not in the paper, it says "ask your pharmacist or GP". Emergency words (chest pain, cannot breathe, overdose, allergic reaction, in several languages) trigger "call 999" by keyword before any model runs; urgent words give 111. Every guide ends with a fixed safety line. In the sheet the guide says "You are still on step N" so the answer stays tied to the step. Limit: the keyword list is not clinical triage, and answers have not been clinically reviewed yet.

2. **Who checks the technique clips?**
   Nobody yet, and we say so. The 3 clips (shake, press and breathe in, hold breath) were made with fal kling. They only show in demo mode with a "not yet checked" badge. The library has fields for who checked each clip and against which NHS page; the default build shows only signed-off clips, which today is none. Next step is a pharmacist sign-off.

3. **How do the pictures stay consistent, and why no words in them?**
   Every step picture uses one shared style prompt with fal flux, and the prompt forbids text. Image models garble words, and a wordless picture works in every language; the captions come from the app in the chosen language. So a picture can never show a wrong dose.

4. **Why does the avatar use Anam's own LLM, not yours?**
   Anam does not document tool calls with a custom LLM, and the tool calls are the point: the avatar drives the app (`show_step`, `next_step`, `set_language`, `answer_from_document`, `check_understanding` and more); in v3 you see it move the step, and the log is only in the `?debug=1` panel. So the avatar keeps Anam's built-in model, and our server passes it the guide's steps and facts as context, so it answers from the paper.

5. **What does the Adaption model do, and how good is it?**
   It is an Easy Read writer: facts in, short Easy Read steps out. Base Qwen3.5-4B, trained with AutoScientist on 1,161 rows (555 seed rows drafted in this repo plus Adaption-generated rows, rubric-filtered to 1,161). Win rate against the base model: 0.7712 (77.12%). Honest status: it is evidence; the live app writes steps with Claude today, and switches to the tuned model when its id is set.

6. **How much does a guide cost?**
   About $0.45 for our three-file inhaler run: one Claude vision call over all files, the rewrite, and one fal picture per step (about $0.025 each). Voice audio is cached, so repeats are free.

7. **What about privacy?**
   No accounts and no patient data in the repo; every sample is fictional. Keys stay on the server; the browser only gets a short-lived Anam session token. Guides are saved on the server (MongoDB if set, otherwise JSON files in `data/guides`); each phone lists only the papers it made, and can delete them. A real deployment would need a data-processing agreement for the model providers.

8. **Which languages?**
   Any. The "Other language" picker has about 80 languages plus free text; the guide, safety lines and avatar switch. Right-to-left (Arabic, Urdu, Pashto) flips the layout, with numbers kept in order. We tested Somali and Pashto. The interface itself is hand-translated in English, Spanish, Arabic, Urdu and Polish.

9. **Does it only work on medicine?**
   No. One engine for any paper: it decides if it is a how-to, a letter, a bill or a form. Letters and bills get what it is, what to do, by when, how much, and "get free advice before you pay". We showed a council letter; there are also flat-pack instructions.

10. **What fails, or what is not done?**
    Pictures take time (they stream in one by one). Labels on the user's own device photo are built but off, because the model put labels beside the parts, not on them. Clips are not clinically checked. The Bengali interface dictionary is not finished. Very blurry photos: unreadable parts are listed as unreadable and the guide asks for a better photo.

Spare ones:
- **Why not just ask a chatbot?** A fixed Easy Read format (one idea per sentence, 15 words or fewer, a picture each), checked by a rubric, read aloud, with a take-home print sheet and safety lines built in.
- **What if the label and leaflet disagree?** It says so first and sends you to the pharmacist, on every screen: summary, steps, check and print sheet.
- **Who is it for, and how would it reach them?** People with learning disabilities, low literacy or limited English, older people, and carers. Pharmacies, GP surgeries, councils and carers' groups could hand it out.
