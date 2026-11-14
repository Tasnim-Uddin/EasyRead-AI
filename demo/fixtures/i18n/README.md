# Spanish and Arabic sample guides

`guide_{inhaler,council_letter,flatpack}_{es,ar}.json`: the three English samples in `../`, translated.

- Same structure as the English files. `image_url` and `technique_clip_id` are unchanged. `text_en` keeps the English source. `text`, `content`, `facts` warnings and get-help lines, `safety_lines` and the sample note are translated.
- Ids are `g_sample_<name>_es` / `_ar` and `language` is set. `agent/main.py` loads this folder too (so Q&A and the avatar work), and `web/src/api.ts` shows them when the app language is es or ar.
- "999" stays in every language. Medicine name, doses and £ amounts are unchanged, numbers are digits.
- Machine-written by the agent, not checked by a native speaker. **Arabic needs a fluent read-through before it goes in the video.**
