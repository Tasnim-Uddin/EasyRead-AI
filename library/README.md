# Technique library

`index.json` follows CONTRACTS.md section 5. A clip is shown to users only when `checked_by`, `checked_against`
(an NHS page) and `checked_at` are all set. Clips are generated offline (fal image to video), checked by a human,
then cached. Captions are wordless-picture companions and must match the page named in `checked_against`.

Clips so far (`clips/`, made with `fal-ai/kling-video/v2.5-turbo/standard/image-to-video` from the step pictures in
`demo/fixtures/img/`, 5 s, re-encoded to 640 px H.264, under 150 KB each): `inhaler_mdi_shake`, `inhaler_mdi_press`,
`inhaler_mdi_hold`, all in the flat cartoon style of the step pictures, with the guide (the same woman as the Anam avatar) as the person. Start frames: `demo/fixtures/img/step_2.png` (shake), `step_4.png` (hold), and a one-panel press picture made the same way (the fixture `step_3.png` is two panels).
They are served at `/api/library/clips/` and are **unchecked**: `checked_by` and `checked_at` stay null until a human
signs off. Demo only: start the server with `SHOW_UNCHECKED_CLIPS=1` to preview them; the clip screen then shows a
"Not yet checked by a pharmacist" badge. Default is off, so users never see them.
