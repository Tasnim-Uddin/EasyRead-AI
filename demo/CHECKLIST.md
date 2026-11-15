# Demo morning checklist

For the live script in `demo/SCRIPT.md` (the video is 2 minutes and uses the v4 flow with a real paper, so for the live final also bring a real paper with personal details covered, or a printed public template, and photograph it in the app). Judging Sun 13:00 to 16:30, Huxley 308.

## 1. Before leaving home / on arrival
- [ ] Laptop charged and charger in the bag. Phone hotspot as a second network.
- [ ] `git checkout main && git pull --rebase` (this PR merged). Repo public, README has the APIs/models/datasets table.
- [ ] `pip install -r requirements.txt` and `cd web && npm ci` done once while there is wifi.
- [ ] Copy the three fictional inhaler images (label, leaflet, device photo) and one council letter image to the Desktop, and to the phone if you will upload from it. They are not in the repo.
- [ ] Printed label as a prop (optional).

## 2. Env vars to verify (names only; keys live in your own local `.env`, never paste them)
- `ANTHROPIC_API_KEY`: extraction, rewrite, translation, Ask
- `FAL_KEY`: step pictures
- `ANAM_API_KEY` (optional `ANAM_AVATAR_ID`, `ANAM_VOICE_ID`, `ANAM_VOICE_ID_ES`, `ANAM_VOICE_ID_AR`): live avatar
- `ELEVENLABS_API_KEY`: natural voice
- `ADAPTION_API_KEY`, `ADAPTION_MODEL_ID`: tuned rewriter (else base model runs)
- `MONGODB_URI`: optional

Check what the server can see: `curl localhost:8000/api/health` should show `"anthropic": true, "anam": true` (it shows booleans, not the keys). Without `ANAM_API_KEY` the avatar is the illustrated stand-in.

## 3. Start commands
Keyed mode (full live demo), from the repo root:
```bash
uvicorn agent.main:app --port 8000
cd web && npm run dev          # open the URL Vite prints (usually http://localhost:5173)
```
Free mode (no keys, no wifi; samples and the cached run only):
```bash
EASYREAD_NO_DOTENV=1 uvicorn agent.main:app --port 8000
cd web && npm run dev
```
Do not run a paid upload while in free mode: uploading needs a model.

## 4. Browser setup
- **Open the app with `?demo=1` first** (`http://localhost:5173/?demo=1`). Without it the app is in customer mode: no sample chips on home. The browser remembers demo mode; Settings > Demo mode turns it off. `#/sample/...` tabs work either way.
- Chrome, one window, a fresh profile or incognito (no extensions, no password popups).
- Zoom 100% to 125%. Narrow the window to a phone frame (about 390 px wide, DevTools device toolbar, iPhone 14) or keep desktop and say so. Make sure the 999 link and the dev panel button are visible.
- Allow microphone for localhost (needed for talking to the avatar) and sound on.
- Tabs, in order: 1 app home `/?demo=1`; 2 `#/sample/cached-inhaler` (plan B); 3 `#/sample/council`; 4 `#/sample/flatpack`; 5 Figma https://www.figma.com/design/tNc9gbdjtkrXMAgsvRT30w; 6 slide or terminal with the Adaption win rate; 7 README on GitHub.
- Video recording: do NOT add `?debug=1` (debug panel hidden). For live judging only, `?debug=1` shows the Tool calls panel.

## 5. Dry run (5 minutes before)
- [ ] Open `#/sample/inhaler`, go through all steps, switch to Spanish and Arabic and back to English.
- [ ] Ask "Can I take 6 puffs?" and "I can't breathe": second one must show call 999.
- [ ] One live upload of the three inhaler images with a stopwatch. If it takes more than about 60 seconds, or errors, use plan B for that section.
- [ ] Guide: Summary ("Your steps") > **Start with my guide**: the dock shows "Guide is talking" and narrates step 1; say "next" and it moves. With `?debug=1` the log shows `show_step` / `next_step`. If not, use the stand-in and say so.
- [ ] With `?debug=1`, screenshot the Tool calls log as backup evidence.

## 6. Reset between judges
- Refresh the tab (samples and the cached run reload themselves). Guides now survive a restart (`data/guides`); delete a judge's upload from **My guides** (top bar list button) if you want a clean list. Language back to English, text size back to default in Settings.
- If anything is odd: stop and restart uvicorn, hard refresh the browser.
- Delete old uploads if you want (`$TMPDIR/easyread_uploads`, or `UPLOAD_DIR`).

## 7. Saving a new cached run (after a good live run)
```bash
curl localhost:8000/api/guides/<guide_id> -o /tmp/run.json
python demo/cache_run.py /tmp/run.json --name inhaler2   # writes demo/fixtures/cached/guide_cached_inhaler2.json
```
The server then serves it as `g_sample_cached_inhaler2` after a restart. The web app lists cached runs by name in `web/src/api.ts` (`SAMPLES`); add a line there for a new one. Real pictures from fal live under `/api/uploads` and are not copied: the script borrows stand-in pictures by step kind.
