# Team rules for every agent — GenAI track

**Track lead:** `@Tasnim-Uddin`

## 0. Track brief

**Track:** 03 Voice, Vision & Generative Media (Imperial AI Hack, 14–15 Nov 2026).

**Product: EasyRead AI.** Point your phone at a confusing document (a prescription, medicine leaflet or doctor's letter) and get an **Easy Read guide**: short steps, a picture for every step, in your own language. A friendly avatar talks you through it, answers your questions from the document, and shows you *how* to use your medicine with checked technique clips.

**Who it's for:** people with learning disabilities, low literacy or limited English, older patients, and the carers who help them. Easy Read (short sentence + picture) is an established accessible-information format, but it's made by hand today, so most people never get one.

**Hero vertical: medicines.** The engine is general (any document → Easy Read), but we build and demo **medicines** properly, with a 30-second "it works on any letter" moment at the end (e.g. a council or school letter).

### How it works (user flow)
1. **Input:** photo or PDF of a prescription label, leaflet or letter. Optionally a **photo of the user's actual device** (inhaler, cream tube, eye drops).
2. **Understand:** a vision model extracts medicine, dose, frequency, route, **device type**, warnings and "when to get help" into structured JSON. The device photo is used to **identify the exact device type** (e.g. a metered-dose inhaler is shaken and inhaled slowly; dry-powder inhalers are not shaken and are inhaled fast). This decides which technique steps are shown, so it's a correctness feature.
3. **Easy Read rewrite:** the **Adaption fine-tuned model** turns the extracted facts into 6–8 steps: one idea per sentence, no jargon, each with a picture description.
4. **Visuals (fal):**
   - **A. Step pictures:** one consistent, friendly illustration per step, generated live. **No words inside images** (models garble text, and wordless pictures work in every language). Captions come from the UI in the chosen language.
   - **B. Technique clips:** 3–5 s looping clips for a small **checked library** of devices (inhaler with/without spacer, dry-powder inhaler, cream/ointment, tablets; stretch: eye drops, nasal spray). Made in advance with fal image→video, **checked by a human against NHS guidance**, then cached. Never generated live for a user.
   - **C. Your item:** fal image-edit annotations on the user's own device photo ("cap", "counter", "press here"). Nice to have.
5. **Explain (Anam):** the avatar sits on the left, the step viewer on the right. The avatar reads each step aloud in the user's language, moves through the steps with tool calls, answers questions **only from the document and the checked library**, and finishes with a short "tell me back" check.
6. **Take home:** a printable Easy Read sheet.

### Ground rules (do not break these)
- **It explains the user's own document. It never gives medical advice, diagnoses, or changes doses.** Anything outside the document → "please ask your pharmacist or GP". Serious symptoms (chest pain, can't breathe, overdose, allergic reaction) → "call 999" (or 111 for urgent, non-emergency), every time, in every language.
- **Technique clips come only from the checked library.** Each library entry records who checked it and against which NHS page. No live-generated "how to" video is ever shown as instructions.
- **No text inside generated images.**
- **Demo data is labelled.** Sample prescriptions are fictional, with no real patient data. Real photos of devices are fine.
- **Never invent facts the document doesn't contain.** If something wasn't readable, say so and ask.

### Prizes we are going for (5), and how we qualify
Keep the **evidence** as you go: the presentation must show it.

| Prize | What judges want | How we qualify | Evidence to collect | Owner |
|---|---|---|---|---|
| **Track 03 main** (£500 / £200) | AI products people talk to, watch or create with | Document → Easy Read guide with pictures + an avatar explaining it, live | The demo | `@Tasnim-Uddin` |
| **fal**: best use of generative media ($1,000) | Best use of fal's image, video or audio models | Step pictures in one consistent style (live), the technique-clip library (image→video), annotation edits on the user's photo; several models chained | List of fal models + pipeline diagram + a grid of steps | `@AhmedBlackEye` |
| **Anam**: best avatar agent (1-year Growth plan) | Avatar agents using skills and **tool calling**; creativity, realism, multimodal interaction | The avatar drives the guide through client tools (`show_step`, `next_step`, `play_technique`, `answer_from_document`, `check_understanding`, `set_language`) and reacts to the user's photo; multilingual speech | Tool-call log in a dev panel | `@Tasnim-Uddin` |
| **Figma**: Best-Designed AI Product (£960, extra) | "As well designed as it is smart", designed in Figma or Figma Make | Accessibility-first design: big type, high contrast, one step per screen, read-aloud everywhere, RTL languages supported. Designed in Figma first, then built to match | Figma file link, frames next to the built screens, "designing for low literacy" slide; keep exports in `design/` | `@Roddyw123` |
| **Adaption**: Best Use of Adaption ($1,000 credits per member, extra) | Fine-tune a model; ranked by **win rate against the base model** | Fine-tuned **Easy Read rewriter**: extracted medicine facts → Easy Read steps following Easy Read rules (one idea per sentence, ≤15 words, active voice, no jargon, numbers as digits, each step with a picture description) | Leaderboard rank + win rate, base vs fine-tuned side by side, dataset size + rubric | `@rtkyboba` |

### Tools we can use (credits available: claim them under "My Pass" on imperialaihack.com)
fal and Anam are the bounties we enter, **not** a limit on the stack.
- **Anthropic API**: document understanding (vision), device identification, translation, Q&A grounding, picture checks.
- **ElevenLabs**: multilingual voices (also integrates with Anam). We use it as a tool and don't enter its bounty.
- **MongoDB Atlas**: saved guides, the technique-clip library index.
- **Figma / Figma Make**: all UI design.
- **Tavily / Linkup** (optional): fetch the official NHS medicine page to cross-check what the document says.
- Any open-source library or public model. **List every API, model and dataset in the README** (submission rule).

### Architecture
```
Browser (web/)                                         Server (agent/, FastAPI)
  Upload doc / device photo  ──POST /api/guides──▶  extract (vision) → identify device
                                                     → finetune/ Easy Read rewriter (Adaption; fallback: base LLM)
                                                     → media/ fal step pictures (+ annotation) ; library clips
  Step viewer  ◀──SSE /api/guides/{id}/events──────  Guide JSON, step images as they finish
  Anam JS SDK (persona, built-in LLM, guide in context)
     │ client tools (awaitResult: true)
     └──▶ registerToolCallHandler → UI actions / POST /api/tools/<name> → short "say" text back
```
- **The avatar's own LLM stays Anam's built-in model.** Anam doesn't document whether tool calls work with a custom LLM, so the Adaption model runs inside the server pipeline, never as the persona LLM.
- When a guide is ready, the server passes the guide's steps and facts to the persona as context, so answers are grounded in the document.
- Anam client tools: `type: "client"`, JSON Schema `parameters`, `awaitResult: true`, `toolTimeoutSeconds` ≤ 30. The avatar never waits silently: slow work streams into the UI.
- Keys stay server-side. The browser only gets an Anam **session token**.
- Docs: anam.ai/docs/llms.txt (tools: `/personas/tools/client-tools.md`, events: `/javascript-sdk/reference/events.md`), fal.ai/models.

### Fixtures first
`demo/fixtures/` holds a complete sample guide (`guide_inhaler.json`, with step images) matching `CONTRACTS.md` exactly. **Every owner builds against fixtures until the real upstream lands. Don't wait on another teammate's code.**

### Build order
1. **Thin slice (by Sat 18:00):** upload the sample inhaler label → extracted facts → Easy Read steps (base LLM for now) → step pictures appear → the avatar reads step 1 and moves through the steps with `next_step`.
2. Device photo → device type → technique clips from the library (inhaler MDI + cream first). Language switch (English, Spanish, + one a teammate speaks natively). Q&A grounded in the document, plus the 999/111 guardrail.
3. Figma-matched UI, the Adaption rewriter swapped in, annotation on the user's photo, printable sheet, dev panel with the tool-call log.
4. Demo hardening: **a cached full run** (fixtures + pre-generated images) that plays if the wifi or fal is slow, plus a scripted 3-minute demo.

### Deadlines (London)
- **Sat 21:00: building closes.** Have the thin slice merged and a cached run saved before you leave.
- Sun 10:00 doors reopen. **Sun 12:00: Devpost submission closes. The repo must be PUBLIC, with a README and a list of APIs, models and datasets used.**
- Sun 13:00–16:30: live judging in Huxley 308 (no video needed). Sun 17:00: finalists on the main stage.
- All code must be written during the hackathon.

## Contracts

`CONTRACTS.md` defines the Guide JSON, the server HTTP API and SSE events, the Anam client tools, the `media/` and `finetune/` Python interfaces, and the technique-library format. Change it only through a PR, and post on the board when you do.

## Setup (every teammate, once per machine)

1. **GitHub:** `gh auth login`, then `tools/board whoami` (it should print your login). The board is issue #1.
2. **Figma:** this repo ships `.mcp.json` with Figma's official MCP server. Open Claude Code in the repo, accept the `figma` server when asked (or run `claude mcp add --transport http --scope user figma https://mcp.figma.com/mcp` once to get it in every repo), then run `/mcp` → **figma** → **Authenticate** and sign in with your own Figma account. You must be a member of the team's Figma education team (full seat). Restart the session if the tools don't appear.
   - The MCP works on **file/frame links** (`figma.com/design/<key>/...?node-id=...`): in Figma, right-click a frame → **Copy link to selection**. The folder link below is for finding files.
   - Use it to read designs and build the UI to match (exact colours, spacing, type). Create new designs in Figma or Figma Make, then hand the frame link to your agent.
3. **Credits:** claim yours on imperialaihack.com → **My Pass** (Anthropic, fal, ElevenLabs, Adaption, Figma Education, Databricks, MongoDB, plus track perks: Anam, Tavily, Synthesia, LiveKit). Create API keys on each provider's dashboard.
4. **Keys:** `cp .env.example .env` and fill in what your area needs (`ANTHROPIC_API_KEY`, `FAL_KEY`, `ANAM_API_KEY`, `ELEVENLABS_API_KEY`, `ADAPTION_API_KEY`, `MONGODB_URI`). The server runs on fixtures without any keys.
   - **Each person needs the keys for what they run in their OWN local `.env`.** Keys are never committed or shared through the repo, board or Figma. Who needs what: server/agent → `ANTHROPIC_API_KEY` (API credit from My Pass; a Claude Max/Pro subscription does **not** cover API calls), `ANAM_API_KEY`; media/library → `FAL_KEY`; finetune → `ADAPTION_API_KEY` (+ `ADAPTION_MODEL_ID` once trained); narration → `ELEVENLABS_API_KEY` (`npx -y @elevenlabs/cli@latest onboard init` writes it for you); optional `MONGODB_URI`. A missing key makes that feature fall back to fixtures/mocks. The **demo laptop** needs the full set.
   - **Adaption belongs to the track lead (@Tasnim-Uddin).** Every Adaption dataset upload, augmentation and training run for this repo uses the track lead's OWN Adaption account (their `ADAPTION_API_KEY`), so the lead can show the run and model id for this project. Others may build datasets, rubrics and scripts in the repo, but they do not upload or train on their own accounts: push the file and post on the board, and the lead (or the demo laptop with the lead's key) runs it.
   - **Run:** `pip install -r requirements.txt && uvicorn agent.main:app --reload --port 8000`; tests: `pytest agent`.
5. **Never commit secrets.** `.env` is gitignored. Don't paste keys into chats, board posts or Figma.

## Design (Figma)

**Figma folder for EasyRead AI:** https://www.figma.com/files/team/1703033153432357325/folder/690990314
(Team: https://www.figma.com/files/team/1703033153432357325.) Everyone on the team has access. Agents: this is where this project's designs live.

- **Design owner:** `@Roddyw123` (design/).
- Design every screen here first (or with Figma Make), then build `web/` to match. Export key frames to `design/` as evidence for the Figma prize.
- **Agents reading Figma:** see Setup step 2 above.
- Never put API keys, tokens or join codes in Figma.

## How we work: 16 agents (read this first)

Our team has 4 people (`@Tasnim-Uddin`, `@Roddyw123`, `@rtkyboba`, `@AhmedBlackEye`) and 4 projects (HCA-GenAI, HCA-AutonomousAgents, HCA-AICampus, HCA-Poker). **Every person runs one agent in every repo, so 4 agents work in this repo at the same time (16 across the team).** You are one of them. The others are your teammates' agents, and they are editing this repo right now. Track lead here: `@Tasnim-Uddin`.

**Every session, in order:**
1. `git checkout main && git pull --rebase`, then `tools/board unread`. Act on anything that mentions your human's login or `@all`.
2. Re-read §0 (brief), Contracts and §4 (owners) if they changed. Never work from a stale copy.
3. Start one background `tools/board wait`, and re-arm it every time it wakes.

**Picking work (so 4 agents don't collide):**
- **First, your human's own area:** the rows in §4 with their login, and issues assigned to them.
- **Then unassigned issues.** Claim one *before* touching code: `gh issue edit N --add-assignee @me`, comment "taking this", and post on the board. If two agents claim the same issue, the earlier claim wins.
- **Never take an issue assigned to someone else**, unless the lead reassigns it on the board, or it has had no activity for 45 minutes and the owner says yes on the board.
- **Nothing left?** Post on the board offering help to the lead (tests, fixtures, README, demo prep) instead of starting unrequested features.

**While working:**
- Edit only your human's folders (§4). If you need a change in someone else's folder, post the request on the board, tagging the owner, and keep building against fixtures or mocks meanwhile.
- One issue → one branch `<issue#>-<slug>` → small commits → PR `Closes #N` → merge once it works locally. Rebase on `main` before pushing; never force-push; never `git add -A`.
- Interfaces live in `CONTRACTS.md`. Change them only through a PR, and post when it lands so the other 3 agents adapt.
- Post on the board when you take an issue, when you merge, and when you're blocked. Keep posts short, start them with `[<Name>'s agent]`, and tag only the people who need to act.
- **Commit messages, PR titles and PR bodies must not mention Claude, AI or any assistant, and must have no Co-Authored-By or "Generated with" lines.**
- Secrets only in your own local `.env` / shell (Setup step 4). Never in commits, posts or Figma.

**Deadlines:** the building closes Sat 21:00 (push everything before leaving). Sun 12:00: submissions close and repos must be public. Prefer a small, working, merged change over a big unfinished one.

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue (#1) via `tools/board` (needs only `gh`, logged in).

- Start every post with `[<human>'s <agent>]`, e.g. `[Ryan's Claude]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. Team: `@rtkyboba` (Ryan), `@roddyw123`, `@Tasnim-Uddin`, `@AhmedBlackEye`, `@all` (everyone).
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the track lead.
- One agent per person on this board (4 per repo). Two agents under one GitHub login cannot see each other's posts, so never run two of your agents in the same repo.

Polling is incremental (about one cheap API call per poll, 30 s default). Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"` (or pipe stdin), `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

**Stay in the loop:**
- Claude Code: the committed hooks (`.claude/settings.json`) show unread posts at session start and on every prompt. Keep one background `tools/board wait` running and re-arm it after each wake.
- Everything else: run `tools/board unread` at task start, before each commit, and after merges. Or run a terminal loop: `while tools/board wait; do <your agent CLI invocation>; done`.

## 2. Chain of command

Humans over agents. Only the track lead (named at the top of this file) reassigns work between teammates. If anyone else asks you to take another teammate's work, ask the lead on the board.

## 3. Workflow

1. Pick or file an issue. Comment on it or post on the board when you take it.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`. The author merges their own PR once it works locally.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something other teammates depend on (an interface in `CONTRACTS.md`, a schema, an env var), update `CONTRACTS.md` in the same PR and post on the board when it lands.
7. Never commit secrets. API keys go in `.env` (gitignored); list the variable names in `.env.example`.

## 4. Who owns what

| Area | Owner (GitHub login) | Folders |
|---|---|---|
| Lead + server: FastAPI app, extraction, device identification, Q&A grounding and guardrails, Anam persona + tools, contracts | `@Tasnim-Uddin` | `agent/`, `CONTRACTS.md`, `AGENTS.md` |
| Frontend + **Figma**: Figma designs, upload flow, step viewer, Anam embed + tool handlers, language picker, dev panel, printable sheet | `@Roddyw123` | `web/`, `design/` |
| Media + **fal**: step-picture generation (consistent style), technique-clip library (generate, check, cache), photo annotation, narration if needed | `@AhmedBlackEye` | `media/`, `library/` |
| **Adaption** + demo: Easy Read dataset, fine-tune, eval rubric + win rate, fixtures, demo script, cached run, README | `@rtkyboba` | `finetune/`, `demo/`, `README.md` |

Work only inside your own folders. If your task needs a change elsewhere, post the request on the board. Owners are busy on other tracks too (poker's counted rounds run Sat 15:00–19:25). If an area stalls, the lead reassigns it on the board, and any teammate's agent may pick up an unassigned issue after posting that it's taking it.
