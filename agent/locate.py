"""Find the model's short quotes on the user's own photo with OCR (RapidOCR), so a step can outline the exact printed
words. Never uses model-guessed boxes: if OCR cannot find the quote, there is no highlight.

Also: which quotes belong to which step, the big number/date card (`callout`), checking `dates` against the paper,
and the parts of a photo that could not be read."""
import asyncio, datetime as dt, io, logging, os, pathlib, re, tempfile
from .doctypes import _facts_in

log = logging.getLogger("agent.locate")
MIN_SCORE = 85
LOW_CONF = 0.55          # an OCR line read with less confidence than this is "hard to read"
OCR_MAX_EDGE = 1600      # OCR a downscaled copy: quads are normalised, so the size does not matter
_engine = None
_cache: dict = {}


def uploads_dir() -> pathlib.Path:
    """Same place agent/main.py stores uploads."""
    return pathlib.Path(os.environ.get("UPLOAD_DIR", tempfile.gettempdir())) / "easyread_uploads"


def path_for_url(url: str | None) -> pathlib.Path | None:
    if not url or not url.startswith("/api/uploads/"):
        return None
    p = uploads_dir() / pathlib.Path(url).name
    return p if p.is_file() else None


def available() -> bool:
    try:
        import rapidocr  # noqa: F401
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


def _get_engine():
    global _engine
    if _engine is None:
        from rapidocr import RapidOCR
        _engine = RapidOCR()
    return _engine


def _load(data: bytes):
    """Image bytes -> (BGR array, as shown in a browser: EXIF rotation applied, long side <= OCR_MAX_EDGE)."""
    import numpy as np
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    im.thumbnail((OCR_MAX_EDGE, OCR_MAX_EDGE))
    return np.array(im)[:, :, ::-1].copy()


def ocr_image(data: bytes) -> dict | None:
    """{"w", "h", "lines": [{"poly": [[x,y]x4] px clockwise from top-left, "text", "conf"}], "gray": array}. Cached."""
    import hashlib
    key = hashlib.sha1(data).hexdigest()
    if key in _cache:
        return _cache[key]
    try:
        img = _load(data)
        r = _get_engine()(img)
        lines = []
        for poly, text, conf in zip(r.boxes if r.boxes is not None else [], r.txts or [], r.scores or []):
            lines.append({"poly": [[float(x), float(y)] for x, y in poly], "text": str(text), "conf": float(conf)})
        import cv2
        out = {"w": img.shape[1], "h": img.shape[0], "lines": lines, "gray": cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)}
    except Exception as e:
        log.warning("ocr failed: %s", e)
        out = None
    if len(_cache) > 64:
        _cache.clear()
    _cache[key] = out
    return out


def is_image(data: bytes) -> bool:
    return not data.startswith(b"%PDF")


async def ocr_pages(pages: list[bytes | None]) -> list[dict | None]:
    """OCR each page (None/PDF -> None) in worker threads. Run this in parallel with the model call."""
    if not available():
        return [None] * len(pages)
    return list(await asyncio.gather(*(asyncio.to_thread(ocr_image, p) if p and is_image(p) else _none() for p in pages)))


async def _none():
    return None


def page_bytes(image_urls: list[str], files: list) -> list[bytes | None]:
    """The stored image for each page (what the user sees in source.image_urls), else the uploaded bytes."""
    out = []
    for i, url in enumerate(image_urls):
        p = path_for_url(url)
        data = None
        if p is not None:
            try:
                data = p.read_bytes()
            except OSError:
                data = None
        if data is None and i < len(files):
            data = files[i][0]
        out.append(data)
    return out


def pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
        return "\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(data)).pages)
    except Exception:
        return ""


# ---------- matching ----------

_FOLD = str.maketrans({"o": "0", "i": "1", "l": "1", "|": "1"})
_KEEP = re.compile(r"[0-9a-z£€$.:/@-]")


def _norm_map(s: str) -> tuple[str, list[int]]:
    """Lower case, OCR look-alikes folded (o/0, i/l/1), spaces and punctuation that OCR drops removed.
    Also returns, for each kept character, its index in the raw text."""
    out, idx = [], []
    for i, ch in enumerate(s.lower().translate(_FOLD)):
        if _KEEP.match(ch):
            out.append(ch)
            idx.append(i)
    return "".join(out), idx


def _norm(s: str) -> str:
    return _norm_map(s)[0]


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def match_line(quote: str, text: str) -> tuple[float, float, float] | None:
    """Best fuzzy match of the quote inside one OCR line -> (score, start fraction, end fraction) of the raw line text."""
    from rapidfuzz import fuzz
    q = _norm(quote)
    t, idx = _norm_map(text)
    if len(q) < 3 or not t:
        return None
    if len(q) > len(t):
        if len(t) < 0.8 * len(q) or fuzz.ratio(q, t) < MIN_SCORE:
            return None  # most of the quote is not on this line
        start, end, score = 0, len(t), fuzz.ratio(q, t)
    else:
        al = fuzz.partial_ratio_alignment(q, t)
        if al is None or al.score < MIN_SCORE:
            return None
        start, end, score = al.dest_start, al.dest_end, al.score
    if _digits(q) and _digits(q) != _digits(t[start:end]):
        return None  # "17 November" must not land on "10 November": digits are exact
    return score, _xfrac(text, idx[start]), _xfrac(text, idx[end - 1] + 1)


_NARROW, _WIDE = set(" .,:;'|!()[]/-iIl1jtfr"), set("mwMW@%")


def _xfrac(text: str, i: int) -> float:
    """Where character i starts along the line, as a fraction of its width (narrow and wide glyphs weighted)."""
    w = [0.45 if c in _NARROW else 1.35 if c in _WIDE else 1.0 for c in text]
    total = sum(w) or 1.0
    return sum(w[:i]) / total


def _lerp(a, b, f):
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]


def _span_quad(poly, f0: float, f1: float, nchars: int, pad_chars: float = 1.0, end_x: float | None = None):
    """Sub-quad of an OCR line between fractions f0..f1, padded about one character each side and a little in height."""
    tl, tr, br, bl = poly
    pad = pad_chars / max(nchars, 1)
    f0, f1 = max(0.0, f0 - pad), min(1.0, f1 + pad)
    if end_x is not None and tr[0] != tl[0]:
        f1 = max(f1, (end_x - tl[0]) / (tr[0] - tl[0]))
    q = [_lerp(tl, tr, f0), _lerp(tl, tr, f1), _lerp(bl, br, f1), _lerp(bl, br, f0)]
    # 12% taller on each side
    out = []
    for top, bot in ((q[0], q[3]), (q[1], q[2])):
        dx, dy = (bot[0] - top[0]) * 0.12, (bot[1] - top[1]) * 0.12
        out.append(([top[0] - dx, top[1] - dy], [bot[0] + dx, bot[1] + dy]))
    return [out[0][0], out[1][0], out[1][1], out[0][1]]


def _blank_line_end(page: dict, poly) -> float | None:
    """A form box: the x where the blank line (____ or a box) after this OCR line ends, if there is one."""
    g = page.get("gray")
    if g is None:
        return None
    tl, tr, br, bl = poly
    h = max(abs(bl[1] - tl[1]), abs(br[1] - tr[1]), 4)
    x0 = int(max(tr[0], br[0]))
    y0, y1 = int(max(0, br[1] - 0.6 * h)), int(min(g.shape[0], br[1] + 0.4 * h))
    if x0 >= g.shape[1] - 2 or y1 <= y0:
        return None
    band = g[y0:y1, x0:] < 110
    best_end = None
    for row in band:
        xs = row.nonzero()[0]
        if not len(xs) or xs[0] > 3 * h:
            continue
        # longest continuous run starting near the text
        run_start, prev, end = xs[0], xs[0], None
        for x in xs[1:]:
            if x - prev > 2:
                break
            prev = x
        if prev - run_start >= 2 * h:
            end = x0 + prev
        if end and (best_end is None or end > best_end):
            best_end = end
    return float(best_end) if best_end else None


def find(pages: list[dict | None], quote: str, page_hint: int | None = None, form: bool = False) -> dict | None:
    """Locate one quote: {"page", "text", "quad"} normalised 0-1, or None. The hinted page is tried first; a match
    elsewhere is only used when it scores better."""
    best = None
    order = list(range(len(pages)))
    if page_hint is not None and 0 <= page_hint < len(pages):
        order.remove(page_hint)
        order.insert(0, page_hint)
    for pi in order:
        page = pages[pi]
        if not page:
            continue
        for line in page["lines"]:
            m = match_line(quote, line["text"])
            if m and (best is None or m[0] > best[0]):
                best = (m[0], pi, line, m[1], m[2])
    if not best:
        return None
    score, pi, line, f0, f1 = best
    page = pages[pi]
    end_x = None
    if form:
        rest = line["text"][int(round(f1 * len(line["text"]))):]
        # the quote is the whole box label, or the start of one that ends in a colon: the box follows on this line
        if re.fullmatch(r"[\s:_\-\[\]().|]*", rest) or re.fullmatch(r"[^:]{0,60}:[\s_\-\[\]().|]*", rest):
            f1 = 1.0  # boxes/underscores read as text: the rest of the line is the box
            end_x = _blank_line_end(page, line["poly"])
    quad = _span_quad(line["poly"], f0, f1, len(line["text"]), end_x=end_x)
    w, h = page["w"], page["h"]
    quad = [[round(min(1, max(0, x / w)), 4), round(min(1, max(0, y / h)), 4)] for x, y in quad]
    return {"page": pi, "text": quote, "quad": quad}


# ---------- steps ----------

_YEAR = re.compile(r"^(19|20)\d\d$")
_MONEY = re.compile(r"[£€$]\s?\d[\d,]*(?:\.\d{2})?")
_DATEISH = re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b", re.I)


def _facts(text: str) -> set[str]:
    return {f for f in _facts_in(text) if not _YEAR.match(f)}


def _words(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", t.lower())} - {"the", "and", "your", "you", "for", "from", "with", "this", "that"}


def quotes_for_step(step_text: str, quotes: list[dict], form: bool = False) -> list[dict]:
    """0-2 quotes this step is about: the quote's money/numbers/dates are in the step, or (no numbers) its words are."""
    sf, sw = _facts(step_text), _words(step_text)
    # A form step that names its box ("Find the box called Family doctor name and address") only highlights a label
    # whose words are all in that name: "Family doctor telephone" is the next box, not this one.
    named = re.search(r"\bbox (?:called|for|that says|marked|labelled|named)\s+(.+?)(?:[.:](?:\s|$)|$)", step_text, re.I) if form else None
    label_words = _words(named.group(1)) if named else None
    scored = []
    for i, q in enumerate(quotes):
        qt = q.get("t") or ""
        qf = _facts(qt)
        if qf:
            hit = qf & sf
            if not hit or len(hit) / len(qf) < 0.6 or hit <= {m for m in hit if m.isalpha()}:
                continue  # a month alone is not enough
            score = 2 + len(hit) / len(qf) + (1 if any(h.startswith(("£", "€", "$")) for h in hit) else 0)
        else:
            qw = _words(qt)
            if not qw or len(qw & sw) / len(qw) < (0.6 if form else 0.75):
                continue
            if label_words is not None and not qw <= label_words:
                continue
            # a label written out in the step ("the box called Signature(s)") beats one whose words are just nearby
            # and a label named early in the step ("Find the box called Signature. ...") beats one in a later sentence
            plain = lambda x: _norm(re.sub(r"\((s|es)\)", "", x))
            low = step_text.lower()
            first = min(low.find(w) for w in qw & sw)
            score = (len(qw & sw) / len(qw) + (1 if plain(qt) in plain(step_text) else 0)
                     + 0.2 * (1 - first / max(len(low), 1)))
        scored.append((score, -i, bool(qf), q))
    scored.sort(key=lambda x: x[:2], reverse=True)
    out, wordy = [], False
    for _, _, has_facts, q in scored:
        if not has_facts and wordy:
            continue  # one label per step: a second, weaker label match is usually a neighbouring box
        wordy = wordy or not has_facts
        out.append(q)
    return out[:2]


def callout_for(step: dict, quotes: list[dict], language: str) -> dict | None:
    """The big number card when a step centres on an amount, a date or a number (phone, reference)."""
    if step.get("kind") not in ("what", "how", "when"):
        return None
    texts = [q["t"] for q in quotes]
    money = next((m.group(0) for t in texts for m in [_MONEY.search(t)] if m), None)
    date = next((m.group(0) for t in texts for m in [_DATEISH.search(t)] if m), None)
    if money:
        sub = f"by {date}" if date and language == "en" and re.search(r"\bby\b", step.get("text_en", ""), re.I) else None
        return {"value": money, **({"sub": sub} if sub else {})}
    if date:
        return {"value": date}
    num = next((t for t in texts if len(_digits(t)) >= 4 and len(_digits(t)) >= 0.5 * len(re.sub(r"\s", "", t))), None)
    return {"value": num} if num else None


def attach(guide: dict, quotes: list[dict], pages: list[dict | None]) -> dict:
    """Fill step.highlights and step.callout. Returns {"quotes", "located"} counts for logging."""
    form = guide.get("doc_type") == "form"
    found: dict[str, dict | None] = {}
    n_q = n_hit = 0
    for s in guide.get("steps", []):
        mine = quotes_for_step(s.get("text_en") or "", quotes, form)
        hl = []
        for q in mine:
            k = q["t"]
            if k not in found:
                found[k] = find(pages, k, q.get("page"), form)
                n_q += 1
                n_hit += bool(found[k])
            if found[k]:
                hl.append(found[k])
        if hl:
            s["highlights"] = hl
        else:
            s.pop("highlights", None)
        c = callout_for(s, mine, guide.get("language", "en"))
        if c:
            s["callout"] = c
    return {"quotes": n_q, "located": n_hit}


# ---------- urgency the paper does not print ----------

# Any way a paper asks for speed. If the OCR finds one, the step's urgency stands.
URGENT = re.compile(r"\s*,?\s*\b(?:right now|now|today|immediately|straight away|straightaway|at once|as soon as possible|asap|urgently)\b", re.I)
# The words a writer adds on its own. Only these are ever removed: OCR can miss words (white print on a dark box),
# so a paper phrase such as "as soon as possible" is never taken out on OCR evidence alone.
ADDED = re.compile(r"\s*,?\s*\b(?:right now|now|today|straight away|straightaway)\b", re.I)


def page_words(pages: list[dict | None], pdf_texts: list[str]) -> str | None:
    """All printed words (OCR lines and PDF text), lower case; None when nothing could be read (so nothing is judged)."""
    text = " ".join(l["text"] for p in pages if p for l in p.get("lines") or []) + " " + " ".join(pdf_texts or [])
    text = text.lower()
    return text if len(text.strip()) >= 40 else None


def ground_urgency(steps: list[dict], printed: str | None) -> int:
    """'Pay the amount now', 'call today': a time word the paper itself does not print is removed from the step
    (the writer invents urgency; the reader must not be rushed by us). Returns how many steps changed."""
    if not printed or URGENT.search(printed):
        return 0  # the paper itself asks for speed: the writer's own words for it ("as soon as possible") stand
    changed = 0
    for s in steps:
        t = s.get("text_en") or ""

        def keep(m):
            word = m.group(0).strip(" ,").lower()
            return m.group(0) if re.search(rf"\b{re.escape(word)}\b", printed) else ""
        new = ADDED.sub(keep, t)
        if new != t:
            new = re.sub(r"\s+([.,!?])", r"\1", new).strip()
            new = new[:1].upper() + new[1:]
            s["text_en"] = new
            if s.get("text") == t:
                s["text"] = new
            changed += 1
    return changed


# ---------- dates ----------

def fix_year(date: str, quote: str, today: dt.date | None = None) -> str | None:
    """YYYY-MM-DD, or None. When the printed quote has no year, use the next time that day comes round."""
    try:
        d = dt.date.fromisoformat(str(date)[:10])
    except ValueError:
        return None
    today = today or dt.date.today()
    if not re.search(r"\b(19|20)\d\d\b|\b\d{1,2}/\d{1,2}/\d{2}\b", quote or ""):
        try:
            d = d.replace(year=today.year)
            if d < today:
                d = d.replace(year=today.year + 1)
        except ValueError:
            return None
    return d.isoformat()


def _on_pdf(quote: str, text: str) -> bool:
    from rapidfuzz import fuzz
    q, t = _norm(quote), _norm(text)
    return len(q) >= 3 and fuzz.partial_ratio(q, t) >= MIN_SCORE and _digits(quote) in _digits(t)


def check_dates(dates: list[dict], pages: list[dict | None], pdf_texts: list[str], ocr_ok: bool = True,
                today: dt.date | None = None) -> list[dict]:
    """Keep only dates whose quote is printed on the paper (OCR on photos, the text layer on PDFs)."""
    out = []
    for d in dates:
        q = d.get("quote") or ""
        date = fix_year(d.get("date"), q, today)
        if not date or not q:
            continue
        on_paper = (any(find([p], q) for p in pages if p) or any(_on_pdf(q, t) for t in pdf_texts if t)
                    or not ocr_ok)
        if on_paper:
            out.append({**d, "date": date})
    return out


# ---------- unreadable parts ----------

def unreadable_regions(pages: list[dict | None], parts: list[dict]) -> list[dict]:
    """Model-reported unreadable parts we can place (by a nearby quote), plus OCR lines read with low confidence."""
    out = []
    for p in parts:
        q = p.get("quote") or ""
        hit = find(pages, q, p.get("page")) if q else None
        if hit:
            out.append({"page": hit["page"], "quad": hit["quad"], "note": p.get("note") or ""})
    for pi, page in enumerate(pages):
        if not page:
            continue
        for line in page["lines"]:
            if line["conf"] < LOW_CONF and len(line["text"].strip()) >= 3:
                quad = [[round(min(1, max(0, x / page["w"])), 4), round(min(1, max(0, y / page["h"])), 4)] for x, y in line["poly"]]
                out.append({"page": pi, "quad": quad, "note": "hard to read"})
    return out[:4]
