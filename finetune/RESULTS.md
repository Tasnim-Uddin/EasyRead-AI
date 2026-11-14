# Easy Read rewriter fine-tune: results (issue #8)

Status at 2026-11-14 22:20 London: run still in progress (iteration 1 of 3 finished). Update the final numbers below when it completes.

- Account: Tasnim's Adaption account
- Base model: Qwen/Qwen3.5-4B
- Dataset: `finetune/data/train_filtered.jsonl`, 1,161 rows (555 seeds + 606 Adaption-generated, style-rubric filtered). Dataset built by Ryan.
- Adaption dataset id: 1ec79f24-a8b3-46c4-9b05-79502b83bc4e (ingestion succeeded, 1,161 rows)
- AutoScientist run id: 6ab34ef1-968e-4b42-a847-b9fdc9509759
- Settings: training_method=instruction, data_format=instruction, max_iterations=3, target_win_rate=0.7, columns prompt/completion
- Best win rate so far: 0.6144 after iteration 1 (Adaption's preference eval against the base model); target 0.7
- Model id / checkpoint: not available until the run succeeds (download with `finetune/adaption_run.py` / SDK `autoscientist.download`)
- This is the only training run.
