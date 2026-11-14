"""Adaption pipeline: upload seed rows -> price/generate more -> rubric-filter -> train (AutoScientist).

    python -m finetune.adaption_run upload                  # raw upload of finetune/data/train.jsonl
    python -m finetune.adaption_run augment DATASET_ID N    # N style-matched rows; prints the quote only
    python -m finetune.adaption_run augment DATASET_ID N --go
    python -m finetune.adaption_run filter DATASET_ID       # status + export links
    python -m finetune.adaption_run filter EXPORT.jsonl     # keep rows that pass the style rubric
    python -m finetune.adaption_run train DATASET_ID

Needs ADAPTION_API_KEY. Spending steps need --go; everything else is a quote or read-only.
"""
import argparse, json, sys
from finetune.rubric import score_generic

DATA = "finetune/data"


def show(x):
    print(json.dumps(x.to_dict() if hasattr(x, "to_dict") else x, indent=1, default=str)[:3000])


def filter_file(path):
    """Keep exported rows whose completion is a JSON step list that passes score_generic.
    Adaption exports carry enhanced_* (generated rows) and original_* (our seeds): prefer enhanced."""
    out, kept, total = f"{DATA}/train_filtered.jsonl", 0, 0
    with open(path) as f, open(out, "w") as o:
        for line in f:
            total += 1
            try:
                r = json.loads(line)
                prompt = r.get("enhanced_prompt") or r.get("original_prompt") or r["prompt"]
                comp = r.get("enhanced_completion") or r.get("original_completion") or r["completion"]
                steps = json.loads(comp) if isinstance(comp, str) else comp
            except (ValueError, KeyError):
                continue
            if score_generic(steps)["passed"]:
                o.write(json.dumps({"prompt": prompt, "completion": comp if isinstance(comp, str) else json.dumps(comp)}) + "\n")
                kept += 1
    print(f"kept {kept}/{total} -> {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["upload", "augment", "filter", "train"])
    ap.add_argument("dataset_id", nargs="?")
    ap.add_argument("rows", nargs="?", type=int)
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
    if a.cmd == "filter" and a.dataset_id and a.dataset_id.endswith(".jsonl"):
        return filter_file(a.dataset_id)
    from adaption import Adaption
    c = Adaption()
    if a.cmd == "upload":
        show(c.datasets.upload_file(f"{DATA}/train.jsonl", name="easyread-sft", processing_mode="raw",
                                    column_mapping={"prompt": "prompt", "completion": "completion"}))
    elif a.cmd == "augment":
        show(c.datasets.augment(a.dataset_id, similar_rows=a.rows, estimate=not a.go))
    elif a.cmd == "filter":
        show(c.datasets.get_status(a.dataset_id))
        show(c.datasets.get_export_links(a.dataset_id))
    elif a.cmd == "train":
        show(c.autoscientist.create(dataset_id=a.dataset_id))


if __name__ == "__main__":
    main()
