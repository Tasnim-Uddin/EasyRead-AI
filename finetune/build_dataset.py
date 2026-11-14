"""Build the Easy Read training set: Claude drafts steps for each seed, the rubric filters, JSONL out.

    python -m finetune.build_dataset --per-seed 4 --out finetune/data/train.jsonl

Rows are {"prompt", "completion"} (Adaption SFT column mapping). Adaption SFT needs >= 1,000 effective rows, so
raise --per-seed and add seeds; upload with the Adaption SDK (datasets/upload) then autoscientist.create(). Needs ANTHROPIC_API_KEY. Eval seeds (EVAL_IDS) are excluded.
"""
import argparse, asyncio, json, os, random
from agent import llm
from .prompt import SYSTEM, user_message
from .rubric import score
from .seeds import SEEDS, EVAL_IDS

VARIANTS = ["Use very short, warm sentences.", "Prefer everyday words a child would know.",
            "Make each picture_prompt a clear single scene.", "Keep the how-to steps in the order a person does them."]


def perturb(f: dict, rng: random.Random) -> dict:
    f = json.loads(json.dumps(f))
    if rng.random() < 0.3:
        f["warnings"] = f["warnings"][:1]
    return f


async def draft(facts: dict, hint: str) -> list[dict] | None:
    try:
        steps = await llm.complete_json(SYSTEM + "\n" + hint, user_message(facts))
    except Exception:
        return None
    return steps if isinstance(steps, list) else None


async def main(per_seed: int, out: str):
    rng = random.Random(0)
    rows, tried = [], 0
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    for i, seed in enumerate(SEEDS):
        if i in EVAL_IDS:
            continue
        for k in range(per_seed):
            facts = perturb(seed, rng)
            tried += 1
            steps = await draft(facts, VARIANTS[k % len(VARIANTS)])
            if steps and score(facts, steps)["passed"]:
                rows.append({"prompt": SYSTEM + "\n\n" + user_message(facts),
                         "completion": json.dumps(steps, ensure_ascii=False)})
    with open(out, "w") as fh:
        fh.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    print(f"kept {len(rows)}/{tried} rubric-passing examples -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-seed", type=int, default=4)
    ap.add_argument("--out", default="finetune/data/train.jsonl")
    a = ap.parse_args()
    asyncio.run(main(a.per_seed, a.out))
