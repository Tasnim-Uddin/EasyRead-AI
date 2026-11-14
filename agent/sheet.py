"""Printable Easy Read sheet: one row per step, picture on the left, big text on the right. Self-contained HTML."""
from html import escape
from . import langs, postprocess

CSS = """
@page{size:A4;margin:15mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:18pt;line-height:1.35}
h1{font-size:26pt;margin:0 0 6mm}
.warn{border:3pt solid #111;background:#fff3b0;padding:4mm;margin:0 0 6mm;page-break-inside:avoid}
.warn p{margin:0 0 2mm;font-weight:bold}
.warn .q{font-size:18pt;font-weight:normal}
.steps{list-style:none;margin:0;padding:0}
.row{display:flex;align-items:center;gap:6mm;padding:4mm 0;border-bottom:1pt solid #999;page-break-inside:avoid;break-inside:avoid}
.pic{flex:0 0 45mm;width:45mm;min-height:45mm;display:flex;align-items:center;justify-content:center}
.pic img{width:45mm;height:auto;display:block}
.n{flex:0 0 12mm;font-size:26pt;font-weight:bold}
.txt{flex:1;font-size:18pt}
footer{margin-top:8mm;border-top:3pt solid #111;padding-top:4mm;page-break-inside:avoid}
footer p{margin:0 0 2mm;font-weight:bold;font-size:18pt}
"""


def render(g: dict) -> str:
    lang = langs.clean(g.get("language") or "en")
    code = langs.code_of(lang) or lang
    f = g.get("facts") or {}
    title = f.get("medicine") or f.get("title") or (g.get("content") or {}).get("what_this_is") or "Your guide"
    steps = g.get("steps") or []
    conflict_step = next((s for s in steps if postprocess.is_conflict(s.get("text_en") or "")), None)
    warn = ""
    if conflict_step or f.get("conflicts"):
        quotes = "".join(f"<p class=q><b>{escape(str(c.get('field') or ''))}:</b> {escape(str(c.get('label') or ''))} / "
                         f"{escape(str(c.get('leaflet') or ''))}</p>" for c in f.get("conflicts") or [])
        text = (conflict_step or {}).get("text") or postprocess.CONFLICT_TEXT
        warn = f"<div class=warn role=alert><p>{escape(text)}</p>{quotes}</div>"
    rows = ""
    n = 0
    for s in steps:
        if s is conflict_step:
            continue
        n += 1
        img = f'<img src="{escape(s["image_url"], quote=True)}" alt="">' if s.get("image_url") else ""
        rows += (f"<li class=row><div class=n>{n}</div><div class=pic>{img}</div>"
                 f"<div class=txt>{escape(s.get('text') or s.get('text_en') or '')}</div></li>")
    safety = "".join(f"<p>{escape(x)}</p>" for x in g.get("safety_lines") or [])
    foot = f"<footer>{safety}</footer>" if safety else ""
    return (f'<!doctype html><html lang="{escape(code, quote=True)}" dir=auto><head><meta charset=utf-8>'
            f'<meta name=viewport content="width=device-width,initial-scale=1"><title>{escape(title)}</title>'
            f"<style>{CSS}</style></head><body><h1>{escape(title)}</h1>{warn}<ol class=steps>{rows}</ol>{foot}</body></html>")
