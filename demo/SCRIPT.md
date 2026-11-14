# 3-minute demo script

**Setup before judging:** server running, `demo/fixtures/guide_inhaler.json` loaded as the cached run, dev panel open on a second screen, wifi tested. Sample documents are fictional.

| Time | Do | Say |
|---|---|---|
| 0:00 | Show a plain prescription label | "10 million UK adults struggle to read health information. Easy Read exists, but it is made by hand, so most people never get one." |
| 0:20 | Upload the label, then the photo of the inhaler | "We read the label and the device photo. The photo tells us it is a metered-dose inhaler, which changes the technique." |
| 0:45 | Step pictures appear one by one | "fal draws each step in one style, with no words in the pictures, so they work in every language." |
| 1:05 | Avatar reads step 1 and moves on by itself | "The Anam avatar drives the guide with tool calls. Watch the log." (point at dev panel) |
| 1:25 | Play the inhaler technique clip | "This clip is from our checked library: reviewed against NHS guidance, never generated live." |
| 1:45 | Switch language to Spanish | "Same guide, same pictures, new language and voice." |
| 2:00 | Ask "Can I take 6 puffs?" | "It answers only from the document. Anything else goes to the pharmacist." Then say "I can't breathe": it says call 999. |
| 2:20 | Show base vs fine-tuned side by side (finetune/data/eval_report.json) | "Our Adaption fine-tune follows the Easy Read rules. Win rate against the base model: X%." |
| 2:40 | Upload a council letter | "Same engine, any letter." Show the result. |
| 2:55 | Show the printable sheet | "And they can take it home." |

**Fallback:** if wifi or fal is slow, play the cached run (fixture + pre-generated images) and say so.
**Evidence to show at the booth:** fal model list + pipeline diagram, tool-call log, Figma frames next to the built screens, Adaption win rate and dataset size.
