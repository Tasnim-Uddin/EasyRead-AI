"""Adaption pipeline: upload seed rows -> price/generate more -> rubric-filter -> train (AutoScientist).

    python -m finetune.adaption_run upload                  # raw upload of finetune/data/train.jsonl
    python -m finetune.adaption_run augment DATASET_ID N    # N style-matched rows; prints the quote only
    python -m finetune.adaption_run augment DATASET_ID N --go
    python -m finetune.adaption_run filter DATASET_ID       # download + keep rows that pass the rubric
    python -m finetune.adaption_run train DATASET_ID

Needs ADAPTION_API_KEY. Spending steps need --go; everything else is a quote or read-only.
"""
import argparse, json, sys
from adaption import Adaption

DATA = "finetune/data"


def show(x):
    print(json.dumps(x.to_dict() if hasattr(x, "to_dict") else x, indent=1, default=str)[:3000])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["upload", "augment", "filter", "train"])
    ap.add_argument("dataset_id", nargs="?")
    ap.add_argument("rows", nargs="?", type=int)
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
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
