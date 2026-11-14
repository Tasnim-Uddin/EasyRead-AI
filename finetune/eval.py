"""Win rate of the fine-tuned rewriter vs the base LLM on held-out seeds, scored by the rubric.

    python -m finetune.eval            # needs ANTHROPIC_API_KEY and ADAPTION_MODEL_ID
    python -m finetune.eval --n 3      # samples per held-out seed

A win = higher rubric score (ties split 0.5). Writes finetune/data/eval_report.json with both outputs side by
side for the slides.
"""
import argparse, asyncio, json, os
from . import _base, _tuned
from .rubric import score, score_doc
from .seeds import SEEDS, EVAL_IDS, DOC_SEEDS, DOC_EVAL_IDS


async def main(n: int):
    results, wins = [], 0.0
    for i in EVAL_IDS:
        for _ in range(n):
            facts = SEEDS[i]
            base, tuned = await _base(facts), await _tuned(facts)
            sb, st = score(facts, base), score(facts, tuned)
            w = 1.0 if st["score"] > sb["score"] else 0.5 if st["score"] == sb["score"] else 0.0
            wins += w
            results.append({"seed": i, "base": base, "tuned": tuned, "base_score": sb["score"],
                            "tuned_score": st["score"], "win": w})
    for i in DOC_EVAL_IDS:
        for _ in range(n):
            d = DOC_SEEDS[i]
            args = (d["facts"], d["doc_type"], d["content"])
            base, tuned = await _base(*args), await _tuned(*args)
            sb, st = score_doc(d["doc_type"], d["content"], base), score_doc(d["doc_type"], d["content"], tuned)
            w = 1.0 if st["score"] > sb["score"] else 0.5 if st["score"] == sb["score"] else 0.0
            wins += w
            results.append({"seed": f"doc{i}", "base": base, "tuned": tuned, "base_score": sb["score"],
                            "tuned_score": st["score"], "win": w})
    rate = wins / len(results)
    avg = lambda k: sum(r[k] for r in results) / len(results)
    print(f"win rate {rate:.0%} over {len(results)} comparisons; mean rubric base {avg('base_score'):.2f} tuned {avg('tuned_score'):.2f}")
    os.makedirs("finetune/data", exist_ok=True)
    json.dump({"win_rate": rate, "n": len(results), "results": results}, open("finetune/data/eval_report.json", "w"), indent=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2)
    asyncio.run(main(ap.parse_args().n))
