/** Browser image helpers for capture: decoding, pixels for the detector, rotation, and POST /api/scan. */
import type { ScanResult } from "../types";
import { detectQuad, type Pixels } from "./detect";
import { FULL, normalise } from "./quad";
import type { Quad } from "./detect";

/** Decodes a photo file the way the phone shows it (EXIF orientation applied). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

/** Pixels of an image or video frame scaled so the long side is `side` px. */
export function pixelsOf(src: CanvasImageSource, w: number, h: number, side = 256, canvas?: HTMLCanvasElement): Pixels {
  const s = Math.min(1, side / Math.max(w, h));
  const cw = Math.max(8, Math.round(w * s));
  const ch = Math.max(8, Math.round(h * s));
  const c = canvas ?? document.createElement("canvas");
  if (c.width !== cw) c.width = cw;
  if (c.height !== ch) c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, cw, ch);
  const d = ctx.getImageData(0, 0, cw, ch);
  return { data: d.data, width: cw, height: ch };
}

/** The client's instant guess: normalised corners, or null when no paper was found. */
export function quickDetect(img: HTMLImageElement): Quad | null {
  const px = pixelsOf(img, img.naturalWidth, img.naturalHeight, 256);
  const r = detectQuad(px, 256);
  return r.found ? normalise(r.corners, px.width, px.height) : null;
}

/** The photo turned 90 degrees clockwise, as a new JPEG file. */
export async function rotateFile(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const c = document.createElement("canvas");
    c.width = img.naturalHeight;
    c.height = img.naturalWidth;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POST /api/scan: server corners + photo quality (no AI, no cost). `quad` measures quality inside the user's corners. */
export async function scanPhoto(file: Blob, quad?: Quad, signal?: AbortSignal): Promise<ScanResult> {
  const f = new FormData();
  f.append("image", file, (file as File).name || "photo.jpg");
  if (quad) f.append("quad", JSON.stringify(quad));
  const res = await fetch("/api/scan", { method: "POST", body: f, signal });
  if (!res.ok) throw new Error(`scan ${res.status}`);
  const r = (await res.json()) as ScanResult;
  if (!Array.isArray(r.quad) || r.quad.length !== 4) r.quad = FULL;
  return r;
}
