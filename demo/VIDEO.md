# Demo video plan (judging round 1)

Round 1 plays our demo video (2 minutes at most), then 6 minutes of questions. There is no live demo and no slides in round 1, so the video does all the showing. The top 2 per panel go to a live final, which uses `demo/SCRIPT.md`.

**Deadline:** the video is uploaded and linked on Devpost, and the last commit is pushed, before **Sun 12:00**.

**Target length:** 1:55 at most. Narration is 256 words (about 150 words a minute, so about 1:43 of speech, plus short pauses).

**Scoring we aim at (VVGM):** experience 25, technical integration 25, creativity 20, usefulness 15, video and answers 15. **Bounties:** fal and Anam (our 2 track bounties), plus the open prizes Figma (best designed) and Adaption (win rate). Bounties are judged on how central the partner's tool is, so fal and Anam each get their own clear shot.

All papers in the video are fictional (`demo/inputs/`). No real patient data.

## Honesty rules for the video

- Technique clips are **not clinically checked yet**. They show only in demo mode (`SHOW_UNCHECKED_CLIPS=1`), with the "not yet checked" badge visible. Keep the badge in shot and say it.
- Labels on the user's own device photo are **off** (`DEVICE_PHOTO_LABELS` unset). Do not show or claim them.
- The **Adaption fine-tune is evidence**, not the live writer. The app writes the steps with Claude. Say "we also fine-tuned", never "the app runs our fine-tuned model".
- Replace `ADAPTION_RESULT` with the real win rate before recording the last shot. If there is no number by Sun 11:00, cut the Adaption sentence and keep the Figma one.

## Shot list

Base URL is what Vite prints (usually `http://localhost:5173/`). "Upload" means the real flow on `#/`. Backup routes in brackets are for B-roll or if a live call fails.

| # | Time | On screen (exact route or action) | Narration (exact words) | Evidences |
|---|---|---|---|---|
| 1 | 0:00 to 0:11 | Close-up of the printed fictional inhaler label in a hand (phone camera), cut to the app home `#/`. | "Lots of people can't read the paper that comes with their medicine. Easy Read helps: one short sentence, one picture. But it's made by hand, so almost nobody gets one." | Hook. Usefulness (the problem). |
| 2 | 0:11 to 0:25 | Home `#/` > Upload. Add `demo/inputs/inhaler_label.png`, `inhaler_leaflet.png`, `inhaler_device.png`. Roles: Label, Leaflet, Device photo. Tap **Make my guide**. Reading screen with progress. (Backup: `#/sample/cached-inhaler`.) | "EasyRead AI turns any paper into an Easy Read guide. Here's a real upload: a label, its leaflet and a photo of the inhaler. The photo tells it which kind of inhaler." | Real flow, any paper. Technical integration (vision over 3 files, device type). |
| 3 | 0:25 to 0:35 | Summary screen: the label vs leaflet conflict box ("Ask your pharmacist"). Hold 2 seconds on it. | "The label and the leaflet disagree on the dose. The guide doesn't pick one. It says so, and sends you to your pharmacist." | Safety: label/leaflet conflict. Usefulness. |
| 4 | 0:35 to 0:47 | Step 1, then step 2: step pictures arriving one by one (speed up 2x to 4x in the edit if slow). Tap **Listen** on one step; let 2 seconds of the ElevenLabs voice play. | "Every picture is drawn live by fal, in one style, with no words inside, so it works in any language. Tap Listen and ElevenLabs reads it aloud." | **fal** pictures drawn live. ElevenLabs Listen. Experience. |
| 5 | 0:47 to 0:57 | The press step > **Show me how**: the kling clip loops, with the "not yet checked" badge in shot. (Backup: `#/sample/inhaler/clip/3`.) | "Technique clips, shake, press and breathe in, were made with fal's Kling video model. A pharmacist hasn't checked them yet, so they carry this badge." | **fal** kling technique clip. Honesty. Creativity. |
| 6 | 0:57 to 1:20 | **Talk to your guide.** Anam avatar connected. Open **Tool calls (n)** and keep it open. You say "Next step." The avatar speaks (let 2 to 3 seconds of its audio play), the step moves, `next_step` appears in the log. Then you say "Can you say it in Arabic?": `set_language` appears, the layout flips right to left, the avatar answers in Arabic. | "Or just talk. This Anam avatar drives the app with tool calls. I say next, it calls next step, and every call shows in this log. Ask for Arabic, or any language, and the whole guide switches, right to left." | **Anam** avatar + visible tool calls (`next_step`, `set_language`). Any language incl. RTL. Experience, technical integration. |
| 7 | 1:20 to 1:33 | **Ask.** Type "Can I give my inhaler to my brother?" (not in the paper) > "ask your pharmacist or GP". Then type "I can't breathe" > call 999 answer; point the cursor at the 999 link at the top. | "It only answers from your paper. Anything else: ask your pharmacist. Say 'I can't breathe', and it says call 999, every time, before any model runs." | Safety: out-of-scope refusal, 999/111. |
| 8 | 1:33 to 1:44 | Home `#/` > Upload `demo/inputs/council_letter.png` (role Letter) > summary: what it is, what to do, by when, amount, "get free advice". (Pre-generated, see spend note. Backup: `#/sample/council`.) | "And it works on any paper. A council letter: what it is, what to do, by when, and get free advice before you pay." | Real documents (council letter / bill). Usefulness, creativity. |
| 9 | 1:44 to 1:55 | Split screen: `design/evidence-grid.jpg` (Figma left, built right) for 4 seconds, then a title card: "Adaption fine-tune: ADAPTION_RESULT win rate vs base model (Qwen3.5-4B, 1,161 rows)" and the repo link. | "We designed it in Figma first, then built it to match. We also fine-tuned an Easy Read writer with Adaption: it beats its base model ADAPTION_RESULT of the time." | **Figma** design vs built. **Adaption** win rate. |

End card (no narration, 1 to 2 seconds, inside the 1:55): "EasyRead AI. Any paper, made easy. Fictional sample papers. Not medical advice."

Spoken by you on camera mic in shot 6 (not counted in the narration): "Next step." and "Can you say it in Arabic?" Typed in shot 7: the two questions.

If you run long, cut in this order: the Listen clip in shot 4 (keep the sentence), the Arabic half of shot 6 (keep "any language" in the narration over the language pill instead), shot 8's upload (use `#/sample/council`).

## Recording tips

**Spend.** One live inhaler run costs about $0.45 (Claude extraction and rewrite plus fal pictures). Do not record live runs over and over:
1. Do one live run of the three inhaler files and one of the council letter. Record the screen while they run (that is the real-flow footage for shots 2 to 4 and 8).
2. Re-record retakes on the finished guides (they stay in memory until the server restarts), or on `#/sample/cached-inhaler` and `#/sample/council` for B-roll. Do not restart uvicorn between takes.
3. Ask, Listen and translation cost a few cents each. The avatar uses Anam minutes, so keep the talk takes short.

**Server for recording.** Full `.env` on the demo laptop, plus `SHOW_UNCHECKED_CLIPS=1` so the clips show with their badge. Leave `DEVICE_PHOTO_LABELS` unset. Check `curl localhost:8000/api/health` shows the keys as true.

**Browser.** Chrome, fresh profile, no extensions, no bookmarks bar. DevTools device toolbar at 390 x 844 (iPhone 14 size), or a 390 px wide window, then close DevTools panes so only the phone view shows. Zoom 100%. Allow the microphone for localhost. Open **Tool calls (n)** before the avatar shot and leave it open.

**Screen recorder.** OBS Studio (Linux, Mac, Windows): canvas and output 1920 x 1080, 30 fps, MP4 (or MKV then remux), a Window Capture or a cropped Display Capture of the phone view, scaled up to fill most of the frame height. Add two audio sources: **Desktop Audio** (this is how the Anam avatar and the ElevenLabs Listen voice get into the recording) and your **Mic**. On a Mac, QuickTime does not record system audio, so use OBS or the macOS 14+ screen capture with a virtual audio device.

**Mic.** Use a headset or earbuds with a mic, so the avatar's voice does not echo back into its own microphone. Record in a quiet room.

**Narration.** Easiest: record the screen with desktop audio and your spoken commands, then record the narration as a separate voice-over track afterwards, reading the table. Duck the app audio under the narration, and bring it up for the 2 to 3 seconds of avatar and Listen audio.

**Cut points.** Cut out: the wait on the reading screen (keep 1 to 2 seconds of progress), picture loading beyond the first two pictures (or speed it up), the avatar connecting, any typing longer than 2 seconds (speed it up). Put a hard cut between shots; no fancy transitions.

**Captions.** Burn in captions. The product is about accessibility, so judges will notice. Make an `.srt` from the narration column (one line per sentence, timed to the voice-over), then either use the editor's auto-captions (CapCut, DaVinci Resolve, iMovie) and fix the words, or `ffmpeg -i edit.mp4 -vf subtitles=video.srt -c:a copy video_captioned.mp4`. Large, high-contrast text, bottom of the frame, not over the 999 link.

**Export.** 1080p MP4 (H.264, AAC). Check it is 1:55 or less. Watch it once with the sound off (captions readable?) and once with the sound on.

**Upload.** YouTube, visibility **Unlisted**, title "EasyRead AI demo (Imperial AI Hack 2026)". Paste the link into Devpost and into `DEVPOST.md`. Open the link in a private window to check it plays without signing in.

## 6-minute Q&A prep

Short, honest answers. One person answers each, the others stay quiet.

1. **Is it safe to give medicine instructions with AI?**
   It explains the user's own paper. It never diagnoses or changes a dose. If the answer is not in the paper, it says "ask your pharmacist or GP". Emergency words (chest pain, cannot breathe, overdose, allergic reaction, in several languages) trigger "call 999" by keyword before any model runs; urgent words give 111. Every guide ends with a fixed safety line. Limit: the keyword list is not clinical triage, and answers have not been clinically reviewed yet.

2. **Who checks the technique clips?**
   Nobody yet, and we say so. The 3 clips (shake, press and breathe in, hold breath) were made with fal kling. They only show in demo mode with a "not yet checked" badge. The library has fields for who checked each clip and against which NHS page; the default build shows only signed-off clips, which today is none. Next step is a pharmacist sign-off.

3. **How do the pictures stay consistent, and why no words in them?**
   Every step picture uses one shared style prompt with fal flux, and the prompt forbids text. Image models garble words, and a wordless picture works in every language; the captions come from the app in the chosen language. So a picture can never show a wrong dose.

4. **Why does the avatar use Anam's own LLM, not yours?**
   Anam does not document tool calls with a custom LLM, and the tool calls are the point: the avatar drives the app (`show_step`, `next_step`, `set_language`, `answer_from_document` and more). So the avatar keeps Anam's built-in model, and our server passes it the guide's steps and facts as context, so it answers from the paper.

5. **What does the Adaption model do, and how good is it?**
   It is an Easy Read writer: facts in, short Easy Read steps out. Base Qwen3.5-4B, trained with AutoScientist on 1,161 rows (555 hand-written seeds plus 1,500 generated rows, filtered by our Easy Read rubric). Win rate against the base model: ADAPTION_RESULT. Honest status: it is evidence; the live app writes steps with Claude today, and switches to the tuned model when its id is set.

6. **How much does a guide cost?**
   About $0.45 for our three-file inhaler run: one Claude vision call over all files, the rewrite, and one fal picture per step (about $0.025 each). Listen audio is cached, so repeats are free.

7. **What about privacy?**
   No accounts and no patient data in the repo; every sample is fictional. Keys stay on the server; the browser only gets a short-lived Anam session token. Guides live in memory unless MongoDB is set. A real deployment would need a data-processing agreement for the model providers.

8. **Which languages?**
   Any. The "Other language" picker has about 80 languages plus free text; the guide, safety lines and avatar switch. Right-to-left (Arabic, Urdu, Pashto) flips the layout, with numbers kept in order. We tested Somali and Pashto. The interface itself is hand-translated in English, Spanish, Arabic, Urdu and Polish.

9. **Does it only work on medicine?**
   No. One engine for any paper: it decides if it is a how-to, a letter, a bill or a form. Letters and bills get what it is, what to do, by when, how much, and "get free advice before you pay". We showed a council letter; there are also flat-pack instructions.

10. **What fails, or what is not done?**
    Pictures take time (they stream in one by one). Labels on the user's own device photo are built but off, because the model put labels beside the parts, not on them. Clips are not clinically checked. The Bengali interface dictionary is not finished. Very blurry photos: unreadable parts are listed as unreadable and the guide asks for a better photo.

Spare ones:
- **Why not just ask a chatbot?** A fixed Easy Read format (one idea per sentence, 15 words or fewer, a picture each), checked by a rubric, read aloud, with a take-home print sheet and safety lines built in.
- **What if the label and leaflet disagree?** It says so first and sends you to the pharmacist, on every screen: summary, steps, quiz and print sheet.
- **Who is it for, and how would it reach them?** People with learning disabilities, low literacy or limited English, older people, and carers. Pharmacies, GP surgeries, councils and carers' groups could hand it out.
