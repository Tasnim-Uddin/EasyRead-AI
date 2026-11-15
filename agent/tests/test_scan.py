"""Paper edges, photo quality and flattening (agent/scan.py, POST /api/scan, `quads` on POST /api/guides).
Synthetic photos only: a printed page warped onto a table at known corners."""
import json
import pathlib

import cv2
import numpy as np
import pytest

from agent import scan

W, H = 1600, 1200


def page(w=850, h=1100, seed=0):
    """A white A4-ish page with dark text lines. Words are rows of letter-sized strokes (not solid bars: a solid bar
    is what a line of text looks like after the phone shook sideways)."""
    rng = np.random.default_rng(seed)
    p = np.full((h, w, 3), 245, np.uint8)
    y = 90
    while y < h - 80:
        x = 70
        while x < w - 120:
            ww = int(rng.integers(30, 120))
            end = min(x + ww, w - 70)
            lx = x
            while lx < end:
                lw = int(rng.integers(3, 7))
                top = y - 5 if rng.random() < 0.3 else y  # some ascenders
                cv2.rectangle(p, (lx, top), (min(lx + lw, end), y + 14), (40, 35, 30), -1)
                lx += lw + int(rng.integers(3, 6))
            x += ww + 18
        y += 38
    return p


def table(seed=1):
    """A brown wood-ish background with some texture."""
    rng = np.random.default_rng(seed)
    bg = np.zeros((H, W, 3), np.uint8)
    bg[:] = (60, 90, 125)
    for y in range(0, H, 40):
        bg[y:y + 3] = (45, 70, 100)
    noise = rng.integers(-12, 12, (H, W, 1))
    return np.clip(bg.astype(int) + noise, 0, 255).astype(np.uint8)


def photo(corners, seed=0, bg=None):
    """The page warped onto the table at `corners` (TL,TR,BR,BL px)."""
    p = page(seed=seed)
    ph, pw = p.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [pw, 0], [pw, ph], [0, ph]]), np.float32(corners))
    out = table() if bg is None else bg.copy()
    warped = cv2.warpPerspective(p, M, (W, H))
    mask = cv2.warpPerspective(np.full((ph, pw), 255, np.uint8), M, (W, H)) > 0
    out[mask] = warped[mask]
    return out


def jpeg(img, q=92) -> bytes:
    return cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])[1].tobytes()


SKEWS = [
    [[420, 150], [1150, 210], [1210, 1080], [360, 1020]],
    [[300, 120], [1100, 90], [1250, 1100], [380, 1150]],
    [[500, 200], [1050, 160], [1120, 950], [470, 1010]],
    [[350, 260], [1300, 180], [1260, 1000], [420, 1080]],
]


@pytest.mark.parametrize("corners", SKEWS)
def test_detect_skewed_page_within_2pct_of_diagonal(corners):
    img = photo(corners)
    q, method = scan.detect(img)
    assert method != "fallback_full"
    err = np.linalg.norm(q - np.float32(corners), axis=1).max()
    assert err < 0.02 * np.hypot(W, H), (method, q.tolist(), err)


def test_scan_returns_normalised_quad_and_clean_quality():
    corners = SKEWS[0]
    r = scan.scan(jpeg(photo(corners)))
    assert r["found"] is True
    want = np.float32(corners) / [W, H]
    assert np.abs(np.float32(r["quad"]) - want).max() < 0.02
    assert r["quality"]["ok"] is True and r["quality"]["issues"] == [] and r["quality"]["block"] is False


def test_not_a_document_is_not_found():
    # An empty table (no paper), and the repo's realistic "not a paper" photo.
    r = scan.scan(jpeg(table()))
    assert r["found"] is False
    assert r["quad"] == [[0, 0], [1, 0], [1, 1], [0, 1]]
    real = pathlib.Path(__file__).resolve().parents[2] / "demo/inputs/realistic/g_not_document.jpg"
    if real.exists():
        assert scan.scan(real.read_bytes())["found"] is False


def test_realistic_photos():
    root = pathlib.Path(__file__).resolve().parents[2] / "demo/inputs/realistic"
    if not root.exists():
        pytest.skip("no realistic inputs")
    a = scan.scan((root / "a_council_photo.jpg").read_bytes())
    assert a["found"] and a["quality"]["ok"]
    b = scan.scan((root / "b_inhaler_dim.jpg").read_bytes())
    assert "dark" in b["quality"]["issues"] and b["quality"]["block"] is False  # warn, never block
    i = scan.scan((root / "i_unreadable.jpg").read_bytes())
    assert i["quality"]["block"] is True


def test_blurred_photo_is_flagged():
    img = cv2.GaussianBlur(photo(SKEWS[0]), (0, 0), 9)
    r = scan.scan(jpeg(img))
    assert "blurry" in r["quality"]["issues"]
    assert r["quality"]["ok"] is False


def test_dark_photo_is_flagged():
    img = (photo(SKEWS[0]).astype(np.float32) * 0.3).astype(np.uint8)
    r = scan.scan(jpeg(img), quad=(np.float32(SKEWS[0]) / [W, H]).tolist())
    assert "dark" in r["quality"]["issues"]


def test_tiny_photo_blocks():
    img = cv2.resize(photo(SKEWS[0]), (400, 300), interpolation=cv2.INTER_AREA)
    r = scan.scan(jpeg(img))
    assert "small" in r["quality"]["issues"] and r["quality"]["block"] is True


def test_page_cut_off_is_flagged():
    corners = [[-150, 100], [1000, 80], [1050, 1100], [-100, 1150]]  # left edge runs off the photo
    q = [[0, 0.07], [0.62, 0.07], [0.65, 0.92], [0, 0.95]]
    r = scan.scan(jpeg(photo(corners)), quad=q)
    assert "cut_off" in r["quality"]["issues"]


def test_glare_is_flagged_with_a_region():
    img = photo(SKEWS[2])
    cv2.circle(img, (800, 560), 260, (255, 255, 255), -1)
    q = (np.float32(SKEWS[2]) / [W, H]).tolist()
    r = scan.scan(jpeg(img, 98), quad=q)
    assert "glare" in r["quality"]["issues"]
    x, y, w, h = r["quality"]["region"]
    assert 0 <= x < 0.5 < x + w and 0 <= y < 0.47 < y + h


def test_flatten_makes_the_page_upright():
    corners = SKEWS[1]
    img = photo(corners)
    flat = scan.flatten(img, np.float32(corners) / [W, H])
    h, w = flat.shape[:2]
    assert 0.6 < w / h < 0.95  # portrait page
    g = cv2.cvtColor(flat, cv2.COLOR_BGR2GRAY)
    # The table is gone: the border of the flat page is paper-white, not brown.
    border = np.concatenate([g[3:8, 20:-20].ravel(), g[-8:-3, 20:-20].ravel(), g[20:-20, 3:8].ravel(), g[20:-20, -8:-3].ravel()])
    assert np.median(border) > 200
    # Text lines are horizontal again: row darkness alternates strongly.
    rows = (g < 128).mean(1)
    assert rows.max() > 0.3 and np.median(rows) < 0.1


def test_flatten_bytes_skips_whole_photo_and_bad_quads():
    data = jpeg(photo(SKEWS[0]))
    assert scan.flatten_bytes(data, [[0, 0], [1, 0], [1, 1], [0, 1]]) is None
    assert scan.flatten_bytes(data, [[0, 0], [1, 0]]) is None
    assert scan.flatten_bytes(data, [[0, 0], [5, 0], [1, 1], [0, 1]]) is None
    out = scan.flatten_bytes(data, (np.float32(SKEWS[0]) / [W, H]).tolist())
    assert out and out[:3] == b"\xff\xd8\xff"


def test_exif_rotation_is_applied():
    from io import BytesIO
    from PIL import Image
    img = photo(SKEWS[0])
    im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    exif = im.getexif()
    exif[0x0112] = 6  # rotate 90 clockwise when shown
    buf = BytesIO()
    im.save(buf, "JPEG", exif=exif)
    out = scan.decode(buf.getvalue())
    assert out.shape[:2] == (W, H)


# ---------- HTTP ----------
def test_scan_route(client):
    r = client.post("/api/scan", files={"image": ("p.jpg", jpeg(photo(SKEWS[0])), "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True and len(body["quad"]) == 4
    assert set(body["quality"]) >= {"ok", "issues", "block"}


def test_scan_route_with_quad_and_bad_files(client):
    data = jpeg(photo(SKEWS[0]))
    r = client.post("/api/scan", files={"image": ("p.jpg", data, "image/jpeg")}, data={"quad": json.dumps([[0, 0], [1, 0], [1, 1], [0, 1]])})
    assert r.status_code == 200 and r.json()["found"] is False
    assert client.post("/api/scan", files={"image": ("x.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")}).status_code == 400
    assert client.post("/api/scan", files={"image": ("x.txt", b"hello", "text/plain")}).status_code == 400


def test_guide_upload_flattens_quads(client, monkeypatch):
    from agent import pipeline
    seen = {}

    async def fake_run(store, gid, files, dev, language, urls):
        seen["files"], seen["urls"] = files, urls

    monkeypatch.setattr(pipeline, "run", fake_run)
    a = jpeg(photo(SKEWS[0]))
    b = jpeg(photo(SKEWS[1]))
    q = (np.float32(SKEWS[0]) / [W, H]).tolist()
    r = client.post("/api/guides", files=[("document", ("a.jpg", a, "image/jpeg")), ("document", ("b.jpg", b, "image/jpeg"))],
                    data={"language": "en", "quads": json.dumps([q, None])})
    assert r.status_code == 200, r.text
    files, urls = seen["files"], seen["urls"]
    assert len(files) == 2 and len(urls) == 2
    assert files[0][0] != a and files[0][1] == "image/jpeg"  # page 1 flattened
    assert files[1][0] == b  # page 2 untouched
    assert "flat_" in urls[0] and "flat_" not in urls[1]
    flat = cv2.imdecode(np.frombuffer(files[0][0], np.uint8), cv2.IMREAD_COLOR)
    assert flat.shape[0] > flat.shape[1]  # upright portrait page
    # The original is kept too.
    from agent.main import UPLOADS
    assert any(p.name.startswith(r.json()["guide_id"]) and "orig_a.jpg" in p.name for p in UPLOADS.iterdir())


def test_guide_upload_rejects_bad_quads(client):
    a = jpeg(photo(SKEWS[0]))
    r = client.post("/api/guides", files=[("document", ("a.jpg", a, "image/jpeg"))], data={"quads": "not json"})
    assert r.status_code == 400 and r.json()["error"] == "bad_quads"
    r = client.post("/api/guides", files=[("document", ("a.jpg", a, "image/jpeg"))], data={"quads": json.dumps([None, None])})
    assert r.status_code == 400


def test_motion_blur_is_flagged():
    # A shaken phone: a long straight streak. Sharpness alone stays high (edges across the streak survive).
    k = np.zeros((25, 25), np.float32)
    k[12, :] = 1 / 25
    img = cv2.filter2D(photo(SKEWS[0]), -1, k)
    r = scan.scan(jpeg(img), quad=(np.float32(SKEWS[0]) / [W, H]).tolist())
    assert "blurry" in r["quality"]["issues"]
    assert r["quality"]["block"] is False  # warn, never block


def test_bright_white_page_is_not_glare():
    # Good light makes most of a white page 250+, but the print is all still there: that is not glare.
    p = page()
    p[p == 245] = 255
    ph, pw = p.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [pw, 0], [pw, ph], [0, ph]]), np.float32(SKEWS[2]))
    img = table()
    mask = cv2.warpPerspective(np.full((ph, pw), 255, np.uint8), M, (W, H)) > 0
    img[mask] = cv2.warpPerspective(p, M, (W, H))[mask]
    r = scan.scan(jpeg(img, 98), quad=(np.float32(SKEWS[2]) / [W, H]).tolist())
    assert "glare" not in r["quality"]["issues"]
    assert r["quality"]["ok"] is True
