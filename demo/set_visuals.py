"""Set step.visual (animated close-up id or null) on the sample guides with agent/visuals.py.

Run from the repo root after changing agent/visuals.py:  python -m demo.set_visuals
"""
import json
import pathlib

from agent import visuals

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"


def main() -> None:
    files = sorted(FIXTURES.glob("guide_*.json")) + sorted((FIXTURES / "i18n").glob("guide_*.json")) \
        + sorted((FIXTURES / "cached").glob("guide_*.json"))
    for f in files:
        g = json.loads(f.read_text())
        for s in g.get("steps", []):
            s["visual"] = visuals.visual_for(s, g)
        f.write_text(json.dumps(g, indent=2, ensure_ascii=False) + "\n")
        print(f.relative_to(FIXTURES), [(s["visual"] or {}).get("id") for s in g.get("steps", [])])


if __name__ == "__main__":
    main()
