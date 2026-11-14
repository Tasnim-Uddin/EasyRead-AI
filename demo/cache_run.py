"""Turn a saved real guide (GET /api/guides/{id} response) into a cached sample the server and web can serve offline.

    python demo/cache_run.py path/to/guide.json --name inhaler

Writes demo/fixtures/cached/guide_cached_<name>.json with id g_sample_cached_<name> (so load_samples picks it up
and the app treats it as a labelled sample). Uploaded-file URLs are dropped (they will not exist on another
machine). Steps without a picture borrow the illustrated stand-in from demo/fixtures/img by step kind.
"""
import argparse, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"


def standins(fixture: dict) -> dict[str, list[str]]:
    by_kind: dict[str, list[str]] = {}
    for s in fixture.get("steps", []):
        if s.get("image_url"):
            by_kind.setdefault(s.get("kind", ""), []).append(s["image_url"])
    return by_kind


def build(guide: dict, name: str, fixture: dict) -> dict:
    g = json.loads(json.dumps(guide))
    g["id"] = f"g_sample_cached_{name}"
    g["status"] = "ready"
    src = g.setdefault("source", {})
    src["is_sample"] = True
    src["image_urls"] = []
    for d in src.get("documents", []) or []:
        d.pop("image_url", None)
    pool, used = standins(fixture), {}
    for s in g.get("steps", []):
        if not s.get("image_url"):
            urls = pool.get(s.get("kind", ""))
            if urls:
                n = used.get(s["kind"], 0)
                s["image_url"] = urls[min(n, len(urls) - 1)]
                used[s["kind"]] = n + 1
                s["status"] = "ready"
    return g


def main(argv=None) -> pathlib.Path:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("guide_json", help="saved /api/guides/{id} response")
    ap.add_argument("--name", required=True, help="short name, e.g. inhaler (letters, digits, - _)")
    ap.add_argument("--fixture", default=str(FIXTURES / "guide_inhaler.json"), help="fixture to borrow stand-in pictures from")
    ap.add_argument("--out-dir", default=str(FIXTURES / "cached"))
    a = ap.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9_-]+", a.name):
        ap.error("--name may only contain letters, digits, - and _")
    guide = json.loads(pathlib.Path(a.guide_json).read_text(encoding="utf-8"))
    out = build(guide, a.name, json.loads(pathlib.Path(a.fixture).read_text(encoding="utf-8")))
    d = pathlib.Path(a.out_dir)
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"guide_cached_{a.name}.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path} (id {out['id']})")
    return path


if __name__ == "__main__":
    main()
