import type { Guide, Highlight, Step } from "../types";

/** What fills the stage for a step, in priority order: close-up > highlight on your photo > picture > words only. */
export type StepVisual =
  | { kind: "closeup"; id: string }
  | { kind: "highlight"; url: string; highlights: Highlight[]; callout: { value: string; sub?: string } | null }
  | { kind: "image"; url: string }
  | { kind: "text" };

const validQuad = (q: unknown): q is [number, number][] =>
  Array.isArray(q) && q.length === 4 && q.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v)));

export function chooseVisual(step: Step | undefined, guide: Pick<Guide, "source">, hasCloseUp: (id: string) => boolean): StepVisual {
  if (!step) return { kind: "text" };
  const v = step.visual;
  if (v && v.kind === "closeup" && v.id && hasCloseUp(v.id)) return { kind: "closeup", id: v.id };
  const urls = guide.source?.image_urls ?? [];
  const hs = (step.highlights ?? []).filter((h) => h && validQuad(h.quad) && Number.isInteger(h.page) && !!urls[h.page]);
  if (hs.length) {
    // One photo at a time: the page of the first highlight.
    const page = hs[0].page;
    return { kind: "highlight", url: urls[page], highlights: hs.filter((h) => h.page === page), callout: step.callout?.value ? step.callout : null };
  }
  if (step.image_url) return { kind: "image", url: step.image_url };
  return { kind: "text" };
}

/** Bounding box (normalised) of a set of quads. */
export function quadsBox(hs: Highlight[]): { x: number; y: number; w: number; h: number } {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const h of hs) for (const [x, y] of h.quad) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < x0 || y1 < y0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * How to zoom an image of aspect `imgAspect` (w/h), shown at width `cw` in a box `cw`×`ch`, so the
 * highlight box sits in the middle at a comfortable size. Returns a scale and a translation in px.
 */
export function zoomTo(box: { x: number; y: number; w: number; h: number }, cw: number, ch: number, imgAspect: number) {
  const iw = cw;
  const ih = cw / (imgAspect || 1);
  const bw = Math.max(box.w * iw, 1);
  const bh = Math.max(box.h * ih, 1);
  const scale = Math.max(1, Math.min(3, (cw * 0.8) / bw, (ch * 0.5) / bh));
  const cx = (box.x + box.w / 2) * iw * scale;
  const cy = (box.y + box.h / 2) * ih * scale;
  // keep the image covering the box where possible
  let tx = cw / 2 - cx;
  let ty = ch * 0.58 - cy;
  tx = Math.min(0, Math.max(cw - iw * scale, tx));
  ty = Math.min(0, Math.max(Math.min(0, ch - ih * scale), ty));
  return { scale, tx, ty, iw, ih };
}
