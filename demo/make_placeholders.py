"""Write wordless placeholder step pictures into demo/fixtures/img/ and link them in the fixture.

Stand-ins until fal pictures are generated. No text in images, per the ground rules.
Run: python demo/make_placeholders.py
"""
import json
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"
COLOURS = {"what": "#2f7d4f", "when": "#c98a1b", "how": "#2b6cb0", "warning": "#c05621", "get_help": "#c53030"}
SHAPES = {
    "what": '<rect x="140" y="110" width="120" height="180" rx="40" fill="#fff"/><circle cx="200" cy="150" r="22" fill="{c}"/>',
    "when": '<circle cx="200" cy="200" r="90" fill="#fff"/><path d="M200 140v60l40 30" stroke="{c}" stroke-width="14" fill="none" stroke-linecap="round"/>',
    "how": '<path d="M110 200h150m-40-50 50 50-50 50" stroke="#fff" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    "warning": '<path d="M200 105 300 285H100z" fill="#fff"/><rect x="190" y="160" width="20" height="70" rx="8" fill="{c}"/><circle cx="200" cy="255" r="11" fill="{c}"/>',
    "get_help": '<circle cx="200" cy="200" r="95" fill="#fff"/><rect x="180" y="140" width="40" height="120" rx="8" fill="{c}"/><rect x="140" y="180" width="120" height="40" rx="8" fill="{c}"/>',
}

path = FIX / "guide_inhaler.json"
g = json.loads(path.read_text())
for s in g["steps"]:
    c = COLOURS[s["kind"]]
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="32" fill="{c}"/>'
           + SHAPES[s["kind"]].format(c=c) + "</svg>")
    (FIX / "img" / f"step_{s['index']}.svg").write_text(svg)
    s["image_url"] = f"/fixtures/img/step_{s['index']}.svg"
path.write_text(json.dumps(g, indent=2, ensure_ascii=False) + "\n")
