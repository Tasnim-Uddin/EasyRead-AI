"""Upload rules for multi-file guides: file types, role tags, and file/page caps."""
import io, json, re

MAX_FILES = 8
MAX_PAGES = 20
MAX_FILE_BYTES = 15 * 1024 * 1024
ROLES = ["label", "leaflet", "device_photo", "letter", "form", "other"]


class UploadError(Exception):
    def __init__(self, status: int, error: str, detail: str):
        super().__init__(detail)
        self.status, self.error, self.detail = status, error, detail


def sniff(data: bytes, declared: str | None = None) -> str | None:
    """Trust the bytes over the browser's content type. None if not a supported type."""
    if data[:5] == b"%PDF-":
        return "application/pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"GIF8":
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def count_pages(data: bytes, media_type: str) -> int:
    if media_type != "application/pdf":
        return 1
    try:
        from pypdf import PdfReader  # optional; the regex below is the fallback
        return max(1, len(PdfReader(io.BytesIO(data)).pages))
    except Exception:
        pass
    return max(1, len(re.findall(rb"/Type\s*/Page(?![s\w])", data)))


def parse_roles(raw: str | None, n: int) -> list[str | None]:
    """`roles` form field: a JSON array or comma-separated list, aligned with the `document` files.
    Empty, 'auto' or 'detect' entries mean 'detect it'."""
    if raw is None or not raw.strip():
        return [None] * n
    raw = raw.strip()
    try:
        items = json.loads(raw) if raw.startswith("[") else raw.split(",")
    except ValueError:
        raise UploadError(400, "bad_roles", "roles must be a JSON array or a comma-separated list")
    items = [(str(i).strip().lower() or None) for i in items]
    if len(items) > n:
        raise UploadError(400, "bad_roles", f"{len(items)} roles given for {n} files")
    items += [None] * (n - len(items))
    out = []
    for r in items:
        if r in (None, "auto", "detect"):
            out.append(None)
        elif r in ROLES:
            out.append(r)
        else:
            raise UploadError(400, "bad_role", f"unknown role '{r}'; use one of {ROLES}")
    return out


def check_limits(items: list[tuple[bytes, str]]) -> int:
    """items: (data, media_type) for every file, device photo included. Returns the page total."""
    if len(items) > MAX_FILES:
        raise UploadError(413, "too_many_files", f"That is too many files. Add {MAX_FILES} or fewer. You added {len(items)}.")
    pages = 0
    for data, mt in items:
        if len(data) > MAX_FILE_BYTES:
            raise UploadError(413, "file_too_large", f"This file is too big. Use a file under {MAX_FILE_BYTES // 2**20} MB.")
        pages += count_pages(data, mt)
    if pages > MAX_PAGES:
        raise UploadError(413, "too_many_pages", f"That is too many pages. Use {MAX_PAGES} pages or fewer. You added {pages}.")
    return pages
