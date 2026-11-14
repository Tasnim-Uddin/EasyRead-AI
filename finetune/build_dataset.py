"""Build the Easy Read training set: Claude drafts steps for each seed, the rubric filters, JSONL out.

    python -m finetune.build_dataset --per-seed 45 --out finetune/data/train.jsonl

Rows are {"prompt", "completion"} (Adaption SFT column mapping). Adaption SFT needs >= 1,000 effective rows, so
raise --per-seed and add seeds; upload with the Adaption SDK (datasets/upload) then autoscientist.create(). Needs ANTHROPIC_API_KEY. Eval seeds (EVAL_IDS) are excluded.
"""
import argparse, asyncio, json, os, random
from agent import llm
from .prompt import SYSTEM, user_message
from .rubric import score, score_doc
from .seeds import SEEDS, EVAL_IDS, DOC_SEEDS, DOC_EVAL_IDS

VARIANTS = ["Use very short, warm sentences.", "Prefer everyday words a child would know.",
            "Make each picture_prompt a clear single scene.", "Keep the how-to steps in the order a person does them."]


def perturb(f: dict, rng: random.Random) -> dict:
    f = json.loads(json.dumps(f))
    if rng.random() < 0.3:
        f["warnings"] = f["warnings"][:1]
    if rng.random() < 0.2:
        f["warnings"] = []
    if rng.random() < 0.2:
        f["get_help"] = []
    if rng.random() < 0.15:
        f["unreadable"] = [rng.choice(["the frequency", "the end of the warning", "the pharmacy name"])]
    return f


def perturb_doc(d: dict, rng: random.Random) -> dict:
    d = json.loads(json.dumps(d))
    c = d["content"]
    if rng.random() < 0.25 and c.get("amounts"):
        c["amounts"] = c["amounts"][:1]
    if rng.random() < 0.2 and c.get("by_when"):
        c["by_when"] = []
    if rng.random() < 0.2 and len(c.get("fields") or []) > 2:
        c["fields"] = c["fields"][:-1]
    return d


async def draft(facts: dict, hint: str, doc_type: str = "how_to", content: dict | None = None) -> list[dict] | None:
    try:
        steps = await llm.complete_json(SYSTEM + "\n" + hint, user_message(facts, doc_type, content))
    except Exception:
        return None
    return steps if isinstance(steps, list) else None


async def main(per_seed: int, out: str, workers: int = 8):
    rng = random.Random(0)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    jobs = []  # (prompt facts args, hint, scorer)
    for i, seed in enumerate(SEEDS):
        if i not in EVAL_IDS:
            for k in range(per_seed):
                jobs.append(("how_to", perturb(seed, rng), None, VARIANTS[k % len(VARIANTS)]))
    for i, seed in enumerate(DOC_SEEDS):
        if i not in DOC_EVAL_IDS:
            for k in range(per_seed):
                d = perturb_doc(seed, rng)
                jobs.append((d["doc_type"], d["facts"], d["content"], VARIANTS[k % len(VARIANTS)]))
    sem = asyncio.Semaphore(workers)

    async def run(job):
        dt, facts, content, hint = job
        async with sem:
            steps = await draft(facts, hint, dt, content)
        ok = steps and (score(facts, steps)["passed"] if dt == "how_to" else score_doc(dt, content, steps)["passed"])
        if not ok:
            return None
        return {"prompt": SYSTEM + "\n\n" + user_message(facts, dt, content),
                "completion": json.dumps(steps, ensure_ascii=False)}

    rows = [r for r in await asyncio.gather(*(run(j) for j in jobs)) if r]
    tried = len(jobs)
    with open(out, "w") as fh:
        fh.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    print(f"kept {len(rows)}/{tried} rubric-passing examples -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-seed", type=int, default=45)
    ap.add_argument("--out", default="finetune/data/train.jsonl")
    a = ap.parse_args()
    asyncio.run(main(a.per_seed, a.out))
