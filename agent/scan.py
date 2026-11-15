"""Paper edges, photo quality and flattening (no AI, no cost).

- `detect(img)`: the paper's 4 corners in a photo (OpenCV contours over three masks).
- `quality(img, quad)`: is the photo good enough to read (blur, dark, low contrast, glare, cut off, too small)?
- `scan(data, quad=None)`: both, for `POST /api/scan`; corners normalised 0-1, clockwise from top-left.
- `flatten_bytes(data, quad)`: the paper cut out and made flat (perspective warp) as a JPEG.

Thresholds come from the v4 spike (real and synthetic photos): blur = variance of the Laplacian inside the page,
measured with the photo's long side at 1000 px.
"""
from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image, ImageOps

WORK = 500           # long side (px) the detector works at
QUALITY_SIDE = 1000  # long side (px) the quality numbers are measured at
MAX_FLAT_SIDE = 2400  # long side (px) of a flattened page

# Quality thresholds (spike REPORT.md)
MIN_SIDE = 500
BLUR_WARN = 25.0
BLUR_BLOCK = 10.0
BLOCK_CONTRAST = 25.0
DARK = 100.0
LOW_CONTRAST = 35.0
LOW_CONTRAST_MAX_LUMA = 200.0
GLARE_FRAC = 0.25
# Glare washes the print out: a bright patch only counts when it holds under GLARE_INK of the page's usual ink.
# (A plain white page in good light is mostly 250+ too, but its words are still there.)
GLARE_INK = 0.2
# Motion blur smears every edge the same way: the gradients line up (structure-tensor coherence near 1).
# Sharp print has strokes in all directions (0.0-0.45 on letters, bills, forms and tables).
MOTION_COHERENCE = 0.6


class ScanError(ValueError):
    pass


# ---------- decoding ----------
def decode(data: bytes) -> np.ndarray:
    """Image bytes -> BGR array, turned the way the phone showed it (EXIF orientation applied, as the browser does)."""
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
    except Exception as e:  # noqa: BLE001 - any decode failure is "not an image"
        raise ScanError("not an image") from e
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


# ---------- corners ----------
def order(p) -> np.ndarray:
    """4 points -> TL, TR, BR, BL."""
    p = np.asarray(p, np.float32).reshape(4, 2)
    s = p.sum(1)
    d = np.diff(p, axis=1).ravel()
    return np.float32([p[s.argmin()], p[d.argmin()], p[s.argmax()], p[d.argmax()]])


def plausible(q) -> bool:
    """Roughly a rectangle seen at an angle: corner angles 45-135 degrees, opposite sides within 2x."""
    q = order(q)
    ang, lens = [], []
    for i in range(4):
        a, b, c = q[i - 1], q[i], q[(i + 1) % 4]
        v1, v2 = a - b, c - b
        cos = float(v1 @ v2 / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6))
        ang.append(np.degrees(np.arccos(np.clip(cos, -1, 1))))
        lens.append(float(np.linalg.norm(c - b)))
    r = min(lens[0] / max(lens[2], 1e-6), lens[2] / max(lens[0], 1e-6), lens[1] / max(lens[3], 1e-6), lens[3] / max(lens[1], 1e-6))
    return min(ang) >= 45 and max(ang) <= 135 and r >= 0.5


def _quad_from_contour(c):
    peri = cv2.arcLength(c, True)
    for eps in (0.02, 0.03, 0.05, 0.08):
        a = cv2.approxPolyDP(cv2.convexHull(c), eps * peri, True)
        if len(a) == 4:
            return a.reshape(4, 2)
    return None


def _masks(small):
    g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    g = cv2.medianBlur(cv2.GaussianBlur(g, (5, 5), 0), 7)
    v = float(np.median(g))
    edges = cv2.dilate(cv2.Canny(g, int(max(0, .5 * v)), int(min(255, 1.4 * v))), np.ones((3, 3), np.uint8), iterations=2)
    _, bright = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    white = ((hsv[..., 1] < 60) & (hsv[..., 2] > np.percentile(hsv[..., 2], 40))).astype(np.uint8) * 255
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return [("canny", edges), ("otsu", bright), ("whiteseg", white)]


def detect(img: np.ndarray, work: int = WORK, min_area: float = 0.15):
    """-> (corners 4x2 float32 in px TL,TR,BR,BL, method). method 'fallback_full' = not found (whole photo)."""
    H, W = img.shape[:2]
    s = work / max(H, W)
    small = cv2.resize(img, (max(1, int(W * s)), max(1, int(H * s))), interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    A = h * w
    best = None
    for name, m in _masks(small):
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in sorted(cs, key=cv2.contourArea, reverse=True)[:3]:
            ca = cv2.contourArea(c)
            if ca < min_area * A or ca > 0.98 * A:
                continue
            q = _quad_from_contour(c)
            if q is None or not plausible(q):
                continue
            qa = cv2.contourArea(q.astype(np.float32))
            fill = ca / max(qa, 1)
            score = qa / A * min(fill, 1 / fill) ** 2
            on_frame = sum(1 for x, y in q if x < 3 or y < 3 or x > w - 4 or y > h - 4)
            if on_frame >= 2:
                score *= 0.25  # quads hugging the frame are usually background leaks
            if best is None or score > best[0]:
                best = (score, q, name)
    if best is None:
        return np.float32([[0, 0], [W, 0], [W, H], [0, H]]), "fallback_full"
    return order(best[1] / s), best[2]


def normalise(q, w: int, h: int) -> list[list[float]]:
    return [[round(float(min(max(x / w, 0), 1)), 4), round(float(min(max(y / h, 0), 1)), 4)] for x, y in q]


def parse_quad(raw) -> np.ndarray | None:
    """A client quad (4 [x,y] pairs, normalised 0-1) -> 4x2 array, or None when it is missing or not usable."""
    if raw is None:
        return None
    try:
        q = np.asarray(raw, np.float64).reshape(4, 2)
    except (ValueError, TypeError):
        return None
    if not np.isfinite(q).all() or (q < -0.05).any() or (q > 1.05).any():
        return None
    q = np.clip(q, 0, 1)
    if cv2.contourArea(order(q).astype(np.float32)) < 0.01:
        return None
    return q


# ---------- quality ----------
def quality(img: np.ndarray, quad_px, found: bool = True) -> dict:
    """{ ok, issues, block, region? }. `region` [x,y,w,h] normalised: where the problem is (glare), when known."""
    H, W = img.shape[:2]
    q = np.asarray(quad_px, np.float32)
    issues: list[str] = []
    region = None
    if min(H, W) < MIN_SIDE:
        issues.append("small")
    s = QUALITY_SIDE / max(H, W)
    g = cv2.cvtColor(cv2.resize(img, (max(1, int(W * s)), max(1, int(H * s))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC), cv2.COLOR_BGR2GRAY)
    hh, ww = g.shape
    mask = np.zeros((hh, ww), np.uint8)
    cv2.fillPoly(mask, [np.int32(q * s)], 255)
    inner = cv2.erode(mask, np.ones((15, 15), np.uint8))  # ignore the page edge itself
    m = (inner if inner.any() else mask) > 0
    if not m.any():
        m = np.ones_like(g, bool)
    lap = cv2.Laplacian(g, cv2.CV_64F)
    lap_var = float(lap[m].var())
    luma = float(g[m].mean())
    p5, p95 = np.percentile(g[m], [5, 95])
    contrast = float(p95 - p5)
    if lap_var < BLUR_WARN or motion_blur(g, m):
        issues.append("blurry")
    if luma < DARK:
        issues.append("dark")
    if contrast < LOW_CONTRAST and luma < LOW_CONTRAST_MAX_LUMA:
        issues.append("low_contrast")
    if found:
        blown = ((g >= 250) & m).astype(np.uint8)
        # Close the gaps that letters leave in a bright page, so "is there print inside?" can be asked of the patch.
        blown = cv2.morphologyEx(blown, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)) & m.astype(np.uint8)
        nb, lab, st, _ = cv2.connectedComponentsWithStats(blown)
        if nb > 1:
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            ink = (g < np.median(g[m]) - 60) & m
            washed = ink[lab == k].mean() < GLARE_INK * ink[m].mean()
            if st[k, cv2.CC_STAT_AREA] / m.sum() >= GLARE_FRAC and washed:
                issues.append("glare")
                x, y, bw, bh = (int(v) for v in st[k, :4])
                region = [round(x / ww, 4), round(y / hh, 4), round(bw / ww, 4), round(bh / hh, 4)]
        touch = sum(1 for x, y in q * s if x < 4 or y < 4 or x > ww - 5 or y > hh - 5)
        # All 4 corners on the border = a flat scan or screenshot whose paper IS the image (nothing is missing);
        # 1-3 corners on the border = the paper runs off the photo.
        if 1 <= touch <= 3:
            issues.append("cut_off")
    block = "small" in issues or ("blurry" in issues and lap_var < BLUR_BLOCK and contrast < BLOCK_CONTRAST)
    out = {"ok": not issues, "issues": issues, "block": bool(block),
           "metrics": {"sharpness": round(lap_var, 1), "brightness": round(luma, 1), "contrast": round(contrast, 1)}}
    if region:
        out["region"] = region
    return out


def motion_blur(g: np.ndarray, m: np.ndarray) -> bool:
    """True when the page's edges all run one way (a shaken phone): structure-tensor coherence >= MOTION_COHERENCE."""
    if m.sum() < 1000:
        return False
    f = g.astype(np.float64)
    gx, gy = cv2.Sobel(f, cv2.CV_64F, 1, 0), cv2.Sobel(f, cv2.CV_64F, 0, 1)
    jxx, jyy, jxy = (gx * gx)[m].mean(), (gy * gy)[m].mean(), (gx * gy)[m].mean()
    coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-9)
    return bool(coh >= MOTION_COHERENCE)


def scan(data: bytes, quad=None) -> dict:
    """POST /api/scan. With a client `quad` (normalised), quality is measured inside it instead of the detected one."""
    img = decode(data)
    H, W = img.shape[:2]
    user = parse_quad(quad)
    if user is not None:
        q_px = order(user * [W, H])
        found = True
        # A quad that is just the whole photo is "not found" for glare/cut-off purposes.
        if np.abs(user - [[0, 0], [1, 0], [1, 1], [0, 1]]).max() < 0.01:
            found = False
    else:
        q_px, method = detect(img)
        found = method != "fallback_full"
    return {"quad": normalise(q_px, W, H), "found": found, "quality": quality(img, q_px, found), "size": [W, H]}


# ---------- flattening ----------
def flatten(img: np.ndarray, quad_norm) -> np.ndarray:
    """Perspective-warp the quad (normalised 0-1) to an upright rectangle."""
    H, W = img.shape[:2]
    q = order(np.asarray(quad_norm, np.float64).reshape(4, 2) * [W, H])
    tl, tr, br, bl = q
    out_w = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    out_h = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    k = min(1.0, MAX_FLAT_SIDE / max(out_w, out_h, 1))
    out_w, out_h = max(8, int(round(out_w * k))), max(8, int(round(out_h * k)))
    dst = np.float32([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]])
    M = cv2.getPerspectiveTransform(q.astype(np.float32), dst)
    return cv2.warpPerspective(img, M, (out_w, out_h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def is_whole_photo(quad_norm) -> bool:
    q = np.asarray(quad_norm, np.float64).reshape(4, 2)
    return bool(np.abs(order(q) - [[0, 0], [1, 0], [1, 1], [0, 1]]).max() < 0.01)


def flatten_bytes(data: bytes, quad) -> bytes | None:
    """The flattened page as JPEG bytes, or None when there is nothing to do (no usable quad, or the whole photo)."""
    q = parse_quad(quad)
    if q is None or is_whole_photo(q):
        return None
    flat = flatten(decode(data), q)
    ok, buf = cv2.imencode(".jpg", flat, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes() if ok else None
