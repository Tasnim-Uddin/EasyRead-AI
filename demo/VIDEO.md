# Demo video plan (judging round 1)

Round 1 plays our demo video (2 minutes at most), then 6 minutes of questions. There is no live demo and no slides in round 1, so the video does all the showing. The top 2 per panel go to a live final, which uses `demo/SCRIPT.md`.

**Deadline:** the video is uploaded and linked on Devpost, and the last commit is pushed, before **Sun 12:00**.

**Target length:** 1:55 at most. Narration is about 240 words (at most 260; about 150 words a minute, so under 1:40 of speech, plus short pauses). This plan is for the v4 "Guide stage" app.

**Scoring we aim at (VVGM):** experience 25, technical integration 25, creativity 20, usefulness 15, video and answers 15. **Bounties:** fal and Anam (our 2 track bounties), plus the open prizes Figma (best designed) and Adaption (win rate). Bounties are judged on how central the partner's tool is, so fal and Anam each get their own clear shot.

## The big idea: the video must look real and BE real

Tasnim photographs a **real paper, on camera, with her phone**. Not the inhaler sample. The app is generic: any paper works. Use one of:

- A real letter or bill of her own, with name, address, account and reference numbers covered (paper over them before filming, not blur after).
- A printed real public template, for example the HMRC "Notice to pay" (TC610) or a parking notice. Pick one with a clear amount and a deadline, so the highlight box and the reminder both have something real to find.

No 999 or 111 lines anywhere in the video or narration. The inhaler sample (`#/sample/cached-inhaler`) is a **backup only**, used if wifi fails (see Backup plan).

## Honesty rules for the video

- Do not claim the content is clinician-checked. Say nothing about clinical review.
- The **Adaption fine-tune is evidence**, not the live writer. The app writes the steps with Claude. Say "we also fine-tuned", never "the app runs our fine-tuned model".
- The Adaption result is the EasyRead win rate **0.7712** (77.12%) against base Qwen3.5-4B. Say it as evidence.
- Papers shown are real public templates, or Tasnim's own paper with the personal details covered. Nothing invented, nothing faked.
- The guide only answers from the paper. Show the off-paper refusal, do not oversell it as general advice.
- Say "close-ups" for the animated SVG scenes (we drew them), and "fal" only for pictures fal actually makes (steps with no close-up).

## Shot list (v4 Guide stage)

**Open the app on the phone** from the phone link (Tasnim's agent gives it). Record **without** `?debug=1`: the Anam tool calls are shown by what the guide does (the step moves), not by a log. Use the app's real camera on the real paper. Language: English to start; Arabic in shot 9.

The v4 flow: Home, in-app camera with live edge outline, crop screen, one loading bar, live Anam guide ("Hi, I'm your guide. Are you ready to get started?"), step stage with the guide in a top-right circle, captions, after each step "Ready to move on, or any questions?", Read mode, Finish (quiz, reminder, save or share), any language, My guides.

| # | Time | On screen | Tap / do | Narration (exact words) | Evidences |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:10 | Second camera: Tasnim holds the real paper (covered details), then cut to the phone Home screen "Got a paper you don't understand?". | Hold paper to camera for 3 s, cut to Home. | "Everyone gets a paper they can't follow. A tax notice. A parking fine. Easy Read fixes that, but it's made by hand, so almost nobody gets it." | Hook. Usefulness. |
| 2 | 0:10 to 0:22 | Second camera over the shoulder plus screen record: **Take a photo of your paper**, the in-app camera with the live orange edge outline snapping to the page, then the crop screen with draggable corners and magnifier (auto-detected). | Tap **Take a photo of your paper**, shutter, nudge one corner, confirm. | "EasyRead AI works on any paper. I photograph this real notice. OpenCV finds the page edges and flattens it. Claude reads the photo and writes the steps." | Real flow. Claude vision. OpenCV. Technical integration. |
| 3 | 0:22 to 0:32 | The loading bar with the changing status line (1 to 2 s), then the live Anam guide fills the screen: "Hi, I'm your guide. Are you ready to get started?" Let her voice play 3 s. | Wait, then tap **Yes, let's start**. | "Seconds later, a live Anam guide fills the screen and asks if I'm ready." | **Anam** live avatar. Experience. |
| 4 | 0:32 to 0:50 | She shrinks to the top-right circle. The step plays on **Tasnim's own photo**: orange highlight box and arrow on the real amount, big number card (e.g. £98.27), caption under it. | Let step 1 play. Point the second camera at the real paper so the match is visible. | "She shrinks to a corner and shows the step on my own paper. OCR finds the exact words Claude quoted, so the box lands on the amount I owe. Captions say what she says." | OCR (RapidOCR). **Anam** step tools. Experience. |
| 5 | 0:50 to 1:02 | A step with no number to point at: either an animated close-up (for example sign here, pay by card, calendar date) or a fal picture (cartoon style, same guide character). Hold 4 s on a **fal** step so the style and character are visible. | Tap **Next step** until one such step shows. Note which step in the rehearsal. | "No number to point at? We play an animated close-up, or fal draws the picture, in one cartoon style, with the same guide character." | **fal** step pictures. Creativity. |
| 6 | 1:02 to 1:18 | "Ready to move on, or any questions?" buttons: **Next step / Ask by voice or typing / Go back**. Ask an off-paper question (for example "Can I just ignore this?"). Answer: "That's not on your paper. You can ask HM Revenue & Customs…" with the helpline from the letter. Then **Go back**: the previous step slides in. | Tap **Ask**, speak or type, read the answer, tap **Go back**. | "Ask anything. If it isn't on the paper, she says so and gives the sender's helpline from the letter. Her tools move the steps and answer only from your paper." | **Anam** tool calls, grounded answers. Honesty. |
| 7 | 1:18 to 1:26 | **Read mode**: no avatar, no sound, the steps as large text with the picture. | Tap **Read mode**. | "Read mode turns the guide and the sound off, for anyone who needs it quiet. ElevenLabs reads it aloud when sound is on." | Accessibility. ElevenLabs voice. |
| 8 | 1:26 to 1:36 | **Finish**: **Check I've got it** (picture answers, tap one), **Remind me** (calendar file or Google Calendar at the letter's deadline), **Save or share** (phone share sheet, one-page PDF, **Share in: your language / English**). Cut quickly between the three. | Tap each of the three once. | "At the end: a picture quiz, a reminder set to the letter's own deadline, and a one-page PDF to share." | Usefulness. Experience. |
| 9 | 1:36 to 1:44 | Switch to Arabic: captions change, the guide speaks Arabic, the layout mirrors right to left. A flash of **My guides** with its filter chips. | Language menu > Arabic, play one step, open **My guides**. | "Switch to Arabic and the captions and the guide follow, and the page mirrors." | Any language. Creativity. |
| 10 | 1:44 to 1:55 | Figma full v4 clickable prototype (file `tNc9gbdjtkrXMAgsvRT30w`, about 68 frames) and the **Design journey** page (v1 to v4), 4 s. Then a title card: "Adaption fine-tune: EasyRead win rate 0.7712 vs base Qwen3.5-4B" with the repo link. | Pre-open the Figma tabs; screen-record, no live navigation. | "We designed it first in Figma, a full clickable prototype. We also fine-tuned an Easy Read writer with Adaption: a 77.12 percent win rate against base Qwen3.5-4B." | **Figma**. **Adaption** 0.7712. |

End card (no narration, 1 to 2 seconds, inside the 1:55): "EasyRead AI. Any paper, made easy. Paper shown is a real public template. Not legal or financial advice."

### What must be visible on screen, per bounty

- **Anam:** the full-screen live guide asking "Are you ready to get started?" (shot 3, voice audible), the top-right circle during the steps (4), the guide acting on "Next step" and on a question (6). The word "Anam" on a caption in shot 3.
- **fal:** one step picture in the cartoon style with the guide character, held 4 s (shot 5), and the word "fal" in a caption. Do not call the SVG close-ups "fal".
- **Figma:** the clickable prototype frames and the Design journey page v1 to v4 (shot 10), the file name visible.
- **Adaption:** the title card with "0.7712" and "vs base Qwen3.5-4B", labelled "evidence" (shot 10). Do not imply the app uses it.

Spoken by you on the camera mic: nothing; the narration is a separate voice-over. The only live voice in the video is the Anam guide.

If you run long, cut in this order: the quiz and share taps in shot 8 (keep Remind me), My guides in shot 9, the Go back tap in shot 6, the second paper-to-camera cut in shot 2.

## Backup plan

- **Wifi drops, or a step is slow:** switch the phone to **Read mode** (no avatar, no sound, works from a saved guide) and narrate over it. Finished guides are saved and listed under **My guides**, so re-record retakes from there, not from a fresh upload.
- **Wifi dead for the live paper shot:** use the inhaler sample, `#/sample/cached-inhaler` (cached real run, no network for the guide content). Say nothing special; do not present it as the main flow. Use it only for shots 4 to 8.
- **Keep one finished real guide of the chosen paper in My guides before the take**, so a failed camera run can still be shown from a saved guide.
- **Anam will not connect:** record that shot again; if it still fails, cut the avatar and keep the captions (shots 4 to 6 still work), and say so in the Q&A.

## Pre-recording checklist

- [ ] The **phone link** is requested from Tasnim's agent and opens the latest v4 build; check `curl localhost:8000/api/health` shows the keys as true (Claude, Anam, ElevenLabs, fal).
- [ ] **Paper chosen and covered:** personal details covered on the paper (or a printed public template). A clear amount and a deadline on it. Rehearsed once so you know which step is the amount, which has a close-up, which has a fal picture.
- [ ] Phone **charged** (above 80%) and plugged in between takes.
- [ ] **Do Not Disturb** on, notifications off, no banners, airplane mode off, wifi on and tested.
- [ ] **Screen recording** on the phone (system audio on) plus a **second camera** (another phone on a stand) for the paper shot and the photo being taken.
- [ ] Phone mic allowed for the app; headset or earbuds so the guide's voice does not echo.
- [ ] **My guides cleaned:** delete test guides; keep only the real paper's guide (and one backup).
- [ ] **Language set** to English before shot 1; Arabic ready for shot 9.
- [ ] Figma tabs pre-opened: the prototype and the Design journey page; Adaption card image ready.
- [ ] Brightness up, text size normal, no dark overlays; the paper lit without glare and a plain background.

## Recording tips

**Spend.** One live real-paper run costs a few tens of cents (Claude vision and writing, fal pictures for steps with no close-up, Anam minutes). Do not record live runs over and over:
1. Do one live run on the real paper and record it end to end (shots 2 to 4). That guide is saved under My guides.
2. Re-record retakes (shots 5 to 9) on that saved guide. Do not restart the server between takes.
3. Ask, voice read-aloud and translation cost a few cents each. The avatar uses Anam minutes, so keep the talk takes short.

**Browser or phone.** Best is the real phone with the phone link, so the in-app camera and the share sheet are real. If you use a desktop browser, Chrome, fresh profile, 390 x 844, zoom 100%, microphone allowed. No `?debug=1`.

**Screen recorder.** Phone: the built-in screen recorder with sound. Desktop: OBS Studio, 1920 x 1080, 30 fps, Desktop Audio plus Mic. Put the phone view in the middle of the frame, scaled up.

**Mic.** Headset or earbuds with a mic, so the avatar's voice does not echo into its own microphone. A quiet room.

**Narration.** Easiest: record the screen with the guide's audio first, then record the narration as a separate voice-over track, reading the table. Duck the app audio under the narration and bring it up for the 3 seconds of guide voice in shot 3.

**Cut points.** Cut out: the wait on the loading bar (keep 1 to 2 seconds), the guide connecting, any typing longer than 2 seconds (speed it up). Hard cuts between shots, no fancy transitions.

**Captions.** Burn in captions. The product is about accessibility, so judges will notice. Make an `.srt` from the narration column (one line per sentence, timed to the voice-over), then use the editor's auto-captions (CapCut, DaVinci Resolve, iMovie) and fix the words, or `ffmpeg -i edit.mp4 -vf subtitles=video.srt -c:a copy video_captioned.mp4`. Large, high-contrast text, at the bottom of the frame, not over the guide circle.

**Export.** 1080p MP4 (H.264, AAC). Check it is 1:55 or less. Watch it once with the sound off (captions readable?) and once with the sound on.

**Upload.** YouTube, visibility **Unlisted**, title "EasyRead AI demo (Imperial AI Hack 2026)". Paste the link into Devpost and into `DEVPOST.md`. Open the link in a private window to check it plays without signing in.

## 6-minute Q&A prep

Short, honest answers. One person answers each, the others stay quiet.

1. **Is it safe to explain a letter or a bill with AI?**
   It explains the user's own paper. It does not give legal, financial or medical advice. The guide answers only from the paper; if the answer is not there it says "That's not on your paper" and points to the sender's helpline from the letter. Every guide carries a fixed "check with the sender" line. Limit: answers have not been reviewed by an adviser or clinician yet, and we do not claim they have.

2. **How do you know the highlight is on the right words?**
   Claude gives an exact quote from the photo, and OCR (RapidOCR) finds that quote on the page, so the box is placed by matching real text, not by guessing where the model thinks it is. If OCR cannot find it, the step falls back to a close-up or a picture and does not draw a wrong box.

3. **What is fal doing, and why not just fal for everything?**
   fal draws the step pictures when there is no close-up and no spot on the paper to point at, in one cartoon style with the same guide character. For common actions (shake, sign here, pay by card, a calendar date) we have 27 animated SVG close-ups that we drew, which are instant, free and always consistent. The pictures carry no words, so they work in any language.

4. **Why does the avatar use Anam's own LLM, not yours?**
   Anam does not document tool calls with a custom LLM, and the tool calls are the point: the guide drives the app (moves steps, goes back, answers from the paper, changes language). So the avatar keeps Anam's built-in model, and our server gives it the steps and facts of the paper as context, so it answers from the paper.

5. **What does the Adaption model do, and how good is it?**
   It is an Easy Read writer: facts in, short Easy Read steps out. Base Qwen3.5-4B, trained with AutoScientist on 1,161 rows (555 seed rows drafted in this repo plus Adaption-generated rows, rubric-filtered to 1,161). Win rate against the base model: 0.7712 (77.12%). Honest status: it is evidence; the live app writes steps with Claude today.

6. **How much does a guide cost?**
   A few tens of cents for a real paper: one Claude vision call, the Easy Read rewrite, OCR (local and free), and fal pictures only for steps with no close-up. Voice audio is cached, so repeats are free. Anam time is per minute of talking.

7. **What about privacy?**
   No accounts. The papers in the video are real public templates or the presenter's own paper with the details covered. Keys stay on the server; the browser only gets a short-lived Anam session token. Guides are saved on the server and each phone lists only its own, and can delete them. A real deployment would need a data-processing agreement for the model providers.

8. **Which languages?**
   Any. Captions and the guide speak the chosen language, and right-to-left languages (Arabic, Urdu, Pashto) mirror the layout. The share sheet has "Share in: your language / English", so a carer can forward either. The interface is hand-translated in English, Spanish, Arabic, Urdu and Polish; other languages are translated live.

9. **Does it only work on one kind of paper?**
   No. The app is generic: tax notices, parking notices, bills, council letters, forms, even a medicine label or flat-pack instructions. It finds what it is, what to do, how much and by when, and sets a reminder from the letter's own deadline.

10. **What fails, or what is not done?**
    A blurry photo: unreadable parts are listed as unreadable and the guide asks for a better photo. The edge detector can miss a page on a busy background, and that is why you can drag the corners. OCR can miss a very faint quote, and then the step falls back to a picture. No clinical or advice-sector review yet. Voice needs the network; Read mode works without sound.

Spare ones:
- **Why not just ask a chatbot?** A fixed Easy Read format (one idea per sentence, a picture each), the answer pinned to your own paper with the exact words highlighted on it, read aloud, with a reminder and a take-home page built in.
- **How was it designed?** Figma first: a full clickable v4 prototype, about 68 frames, and a Design journey page v1 to v4.
- **Who is it for, and how would it reach them?** People with learning disabilities, low literacy or limited English, older people, and carers. Councils, advice charities, GP surgeries and carers' groups could hand it out.
