# Technique library

`index.json` follows CONTRACTS.md section 5. Entries are drafts: `video_url` is null and `checked_by` is null, so
**no clip is shown to users yet**. A clip is shown only when `checked_by`, `checked_against` (an nhs.uk page)
and `checked_at` are all set. Clips are generated offline (fal image to video), checked by a human, then cached.
Captions are wordless-picture companions and must match the NHS page named in `checked_against`.
No fal video spend until the flow is final (lead's instruction).
