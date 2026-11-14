# Easy Read rewriter fine-tune: results (issue #8)

Both runs are on Tasnim's Adaption account (EasyRead project lead). Win rate = Adaption's preference eval of the
fine-tuned model against its base model on held-out rows. Adaption does not serve the tuned models, so the app
keeps using Claude for reading and rewriting; the fine-tune is the evidence that a small open model can learn
the Easy Read style.

## Result

**Best win rate: 0.7712 (run 1, Qwen/Qwen3.5-4B, 77% preferred over the base model; target 0.7 reached).**

## Run 1 (filtered data): finished

- Base model: Qwen/Qwen3.5-4B
- Dataset: `finetune/data/train_filtered.jsonl`, 1,161 rows (555 seeds + 606 Adaption-generated, style-rubric filtered). Dataset built by Ryan.
- Adaption dataset id: 1ec79f24-a8b3-46c4-9b05-79502b83bc4e (ingestion succeeded, 1,161 rows)
- AutoScientist run id: 6ab34ef1-968e-4b42-a847-b9fdc9509759
- Settings: training_method=instruction, data_format=instruction, max_iterations=3, target_win_rate=0.7, columns prompt/completion
- Status: succeeded at 2026-11-14 ~23:30 London after 2 of 3 iterations (stopped early: target reached)
- Win rate by iteration: 0.6144 (iteration 1), **0.7712** (iteration 2, best)
- Checkpoint: download with `finetune/adaption_run.py` / SDK `autoscientist.download`

## Run 2 (cleaned data)

Same base and settings, trained on a cleaned copy of the 1,161 filtered rows (`finetune/clean_v2.py`,
output `finetune/data/train_v2.jsonl`).

- Dataset id: `c3d8bd88-0450-494e-bcd2-1ec13329b0e4` (1,002 rows, raw upload, prompt/completion)
- Run id: `7477f072-ea28-40cd-ae62-9ec893a51667`
- Base: `Qwen/Qwen3.5-4B`, max iterations 3, target win rate 0.8
- Status at 2026-11-14 23:31 London: running, iteration 0 of 3 finished
- Best win rate: pending (update when the run finishes)

### Cleaning rules (all deterministic, applied to both prompt and completion where relevant)

1. **Verb first.** In how-steps, "You <verb> ..." becomes "<Verb> ..."; "You need to / must / should / have to"
   is dropped; "You do not" becomes "Do not". Modal "You can/will/may", past tense, adverbs and unclear
   words are left alone. A row is dropped if fewer than half its how-steps are verb-first afterwards.
2. **UK forms.** "$N", "N dollars", "eighty dollars" and "N dollars and M cents" become "£N" (digits, same
   number in input and answer); 555-xxxx becomes "0300 000 xxxx"; "November 20, 2023" becomes
   "20 November 2026". Rows with DMV, zip, leftover dollar/cent words, or an amount, year or phone number in the
   answer that is not in the input are dropped.
3. **One answer per identical input.** Best answer kept (most verb-first how-steps, best rubric score). The cap
   was raised from 1 to 15 answers per input because 1 or 2 left only 627 rows and Adaption needs 1,000 or more.
4. **Re-validation.** Valid JSON list of steps, kinds valid, sentences of 15 words or fewer, digits not number
   words, picture_prompt present, 3 words or more, no text/words/numbers in the picture; plus the generic rubric.

### Row counts

| Stage | Rows |
|---|---|
| Input (`train_filtered.jsonl`) | 1,161 |
| Rows changed by rule 1 (1,130 steps rewritten) | 529 |
| Rows changed by rule 2: money / phone / date | 155 / 77 / 28 |
| Dropped by rule 2 (cannot convert consistently) | 30 |
| Dropped by rule 4 (validation) | 38 |
| Dropped by rule 1 (not verb-first) | 26 |
| Dropped by rule 3 (duplicate inputs beyond the cap) | 65 |
| Unique inputs after rules | 627 |
| **Final** | **1,002** |
