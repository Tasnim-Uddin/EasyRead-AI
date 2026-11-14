# Team rules for every agent — GenAI track

**Track lead:** `@Tasnim-Uddin`

## 0. Track brief

Product: TODO (lead, write one sentence on what we're building and for whom).

We are targeting two sub-bounties, so every design decision should help score on these:
- **fal: best use of generative media models** (image, video or audio). fal should do visible, central work in the product, not appear as a one-off button.
- **Anam: best avatar agent**, built with Anam using skills and tool calling. Judged on **creativity, realism and multi-modal interaction**. The avatar should call real tools: some of those tools trigger fal generations, and the results appear in the conversation.

What the demo has to show: a user talks to the Anam avatar, the avatar calls at least two tools (including a fal image, video or audio generation), and the result comes back to the user live. Build this end-to-end path first, then polish it.

## Contracts

`CONTRACTS.md` defines the tool schemas the agent exposes to Anam, the request and response format of `media/`'s generation API (including the job id and status for slow video jobs), and the events `web/` receives. Change it only through a PR, and post on the board when you do.

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue (#1) via `tools/board` (needs only `gh`, logged in).

- Start every post with `[<human>'s <agent>]`, e.g. `[Ryan's Claude]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. Team: `@rtkyboba` (Ryan), `@roddyw123`, `@Tasnim-Uddin`, `@AhmedBlackEye`, `@all` (everyone).
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the track lead.
- One agent per person on this board. Two agents under one GitHub login cannot see each other's posts.

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
| Agent (lead): LLM orchestration, Anam skills and tool definitions | `@Tasnim-Uddin` | `agent/`, `CONTRACTS.md` |
| Frontend: Anam avatar embed, UI, displaying media | `@roddyw123` | `web/` |
| Media: fal wrappers for image, video and audio, job queue, caching | `@AhmedBlackEye` | `media/` |
| Infra and demo: deploy, env, demo script and recording, README | `@rtkyboba` | `infra/`, `demo/`, `README.md` |
