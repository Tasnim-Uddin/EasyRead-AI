import type { Guide, Highlight, Step } from "../types";

/**
 * Close-ups that show an action on the paper itself. For these, the user's OWN photo with the words highlighted
 * wins when the step has a located highlight; physical-action close-ups (inhaler, cream, screwdriver...) always win.
 */
export const PAPER_ACTION_CLOSEUPS: ReadonlySet<string> = new Set([
  "write_in_box", "sign_here", "tick_box", "pay_card", "pay_bank", "phone_call",
  "go_online", "calendar_date", "post_letter", "bring_document", "keep_safe", "clock_wait",
]);

type Callout = { value: string; sub?: string } | null;

/**
 * What fills the stage for a step: a physical-action close-up > a highlight on the user's photo > a paper-action
 * close-up (with the callout card) > the picture > words only.
 */
export type StepVisual =
  | { kind: "closeup"; id: string; callout: Callout }
  | { kind: "highlight"; url: string; highlights: Highlight[]; callout: Callout }
  | { kind: "image"; url: string }
  | { kind: "text" };

const validQuad = (q: unknown): q is [number, number][] =>
  Array.isArray(q) && q.length === 4 && q.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v)));

export function chooseVisual(step: Step | undefined, guide: Pick<Guide, "source">, hasCloseUp: (id: string) => boolean): StepVisual {
  if (!step) return { kind: "text" };
  const callout: Callout = step.callout?.value ? step.callout : null;
  const v = step.visual;
  const closeup = v && v.kind === "closeup" && v.id && hasCloseUp(v.id) ? v.id : null;
  const paperAction = !!closeup && PAPER_ACTION_CLOSEUPS.has(closeup);
  if (closeup && !paperAction) return { kind: "closeup", id: closeup, callout: null };
  const urls = guide.source?.image_urls ?? [];
  const hs = (step.highlights ?? []).filter((h) => h && validQuad(h.quad) && Number.isInteger(h.page) && !!urls[h.page]);
  if (hs.length) {
    // One photo at a time: the page of the highlight the step is about.
    const page = hs[primaryHighlight(hs, callout)].page;
    return { kind: "highlight", url: urls[page], highlights: hs.filter((h) => h.page === page), callout };
  }
  if (closeup) return { kind: "closeup", id: closeup, callout };
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

export type Box = { x: number; y: number; w: number; h: number };
export type PxRect = { x: number; y: number; w: number; h: number };

const normText = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s,]+/g, "");

/** The highlight the step is about: the one whose words match the callout (e.g. "£98.27"), else the first. */
export function primaryHighlight(hs: Highlight[], callout?: { value: string } | null): number {
  const v = normText(callout?.value);
  if (v) {
    const i = hs.findIndex((h) => {
      const t = normText(h.text);
      return !!t && (t.includes(v) || v.includes(t));
    });
    if (i >= 0) return i;
  }
  return 0;
}

export interface HighlightPlanIn {
  highlights: Highlight[];
  /** Index into `highlights` of the one the arrow points at. */
  primary: number;
  /** Stage size in px. */
  cw: number;
  ch: number;
  /** Image width / height. */
  imgAspect: number;
  /** Px kept clear at the top (callout card, the guide's circle) and at the bottom (Remind me chip). */
  reserveTop: number;
  reserveBottom: number;
  /** Where the callout card sits (stage px), or null when the step has none. */
  callout: PxRect | null;
  /** Most zoom allowed (default 5); the caller can allow more for a sharp, high-resolution photo. */
  maxScale?: number;
}

export interface HighlightPlan {
  scale: number;
  tx: number;
  ty: number;
  /** Image size before scaling (shown at the stage width). */
  iw: number;
  ih: number;
  /** Every highlight, in stage px (padded), and which one is the primary. */
  boxes: PxRect[];
  /** The same highlights as outlines that follow the words (stage px, padded). */
  polys: [number, number][][];
  primary: number;
  /** From the callout (or a short lead-in) to the edge of the primary box. */
  arrow: { x1: number; y1: number; x2: number; y2: number } | null;
}

/** Comfortable on-screen height (px) for the highlighted line of text, and the most we zoom. */
const READ_PX = 40;
const DEFAULT_MAX_SCALE = 5;
/** Zoom limit for a photo of `naturalWidth` px shown `cw` px wide: up to ~1.3 photo px per screen px, 3x..8x. */
export const maxScaleFor = (naturalWidth: number, cw: number) => Math.max(3, Math.min(8, (naturalWidth / Math.max(1, cw)) * 1.3));
const PAD = 6;
/** Smallest on-screen text height (px) we accept for a long line, and its margin from the stage edge. */
const MIN_READ_PX = 24;
const EDGE = 12;

/**
 * Pan/zoom the user's photo so the step's highlight sits centred and readable in the free part of the stage
 * (below the callout / guide circle, above the Remind me chip), then aim an arrow at it.
 * Other highlights of the step are included in the frame only when that keeps the main one readable.
 */
export function planHighlight(p: HighlightPlanIn): HighlightPlan {
  const { cw, ch } = p;
  const MAX_SCALE = Math.max(1, p.maxScale ?? DEFAULT_MAX_SCALE);
  const iw = cw;
  const ih = cw / (p.imgAspect > 0 ? p.imgAspect : 1);
  const pi = Math.min(Math.max(0, p.primary), Math.max(0, p.highlights.length - 1));
  const prim = quadsBox(p.highlights.slice(pi, pi + 1));
  const all = quadsBox(p.highlights);
  // the free band for the highlight
  let top = Math.max(0, p.reserveTop);
  let bottom = Math.max(0, p.reserveBottom);
  if (ch - top - bottom < ch * 0.4) {
    // a very short stage: shrink the reserves, keep at least 40% free
    const k = (ch * 0.6) / Math.max(1, top + bottom);
    top *= k;
    bottom *= k;
  }
  const availH = ch - top - bottom;
  const fit = (b: Box) => Math.min((cw * 0.86) / Math.max(b.w * iw, 1), (availH * 0.8) / Math.max(b.h * ih, 1));
  // Text height from the quad's own sides (a tilted photo's bounding box is much taller than its text).
  const textH = Math.min(prim.h * ih, quadTextHeight(p.highlights[pi]?.quad, iw, ih) || prim.h * ih);
  const readable = READ_PX / Math.max(textH, 1);
  const scaleFor = (b: Box) => Math.max(1, Math.min(MAX_SCALE, fit(b), Math.max(readable, 1.6)));
  // Include the other highlights only if the main one stays readable (>= 60% of the comfortable size).
  let focus = prim;
  if (p.highlights.length > 1) {
    const sAll = scaleFor(all);
    if (sAll * textH >= READ_PX * 0.6) focus = all;
  }
  let scale = scaleFor(focus);
  // A long line (a whole form row) cannot fit the width at a readable size: zoom to a minimum readable size
  // anyway and show the start of the line, where its words begin.
  const wide = focus === prim && scale * textH < MIN_READ_PX;
  if (wide) scale = Math.max(scale, Math.min(MAX_SCALE, MIN_READ_PX / Math.max(textH, 1)));
  const W = iw * scale;
  const H = ih * scale;
  const fx = (focus.x + focus.w / 2) * W;
  const fy = (focus.y + focus.h / 2) * H;
  let tx = cw / 2 - fx;
  let ty = top + availH / 2 - fy;
  const fits = prim.w * W + PAD * 2 <= cw - 8;
  if (!fits) tx = EDGE + PAD - prim.x * W;
  // Keep the photo covering the stage where it can; a photo shorter than the stage is placed so the highlight
  // still sits in the middle of the free band.
  tx = Math.min(0, Math.max(Math.min(0, cw - W), tx));
  ty = H >= ch ? Math.min(0, Math.max(ch - H, ty)) : Math.min(ch - H, Math.max(0, ty));
  // Never hide the highlight under the callout or the chip: then show a margin of background instead.
  const pTop = prim.y * H + ty - PAD;
  const pBot = (prim.y + prim.h) * H + ty + PAD;
  if (pTop < top) ty += top - pTop;
  else if (pBot > ch - bottom) ty -= Math.min(pBot - (ch - bottom), pTop - top);
  const pL = prim.x * W + tx - PAD;
  const pR = (prim.x + prim.w) * W + tx + PAD;
  if (pL < 0) tx -= pL - (fits ? 0 : EDGE);
  else if (fits && pR > cw) tx -= Math.min(pR - cw, pL);

  const boxes = p.highlights.map((h) => {
    const b = quadsBox([h]);
    return { x: b.x * W + tx - PAD, y: b.y * H + ty - PAD, w: b.w * W + PAD * 2, h: b.h * H + PAD * 2 };
  });
  // The outline follows the words even on a tilted photo: each quad in stage px, pushed out by the padding.
  const polys = p.highlights.map((h) => {
    const pts = h.quad.map(([x, y]) => [x * W + tx, y * H + ty] as [number, number]);
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
    const cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    return pts.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const sx = dx === 0 ? 0 : Math.sign(dx) * PAD;
      const sy = dy === 0 ? 0 : Math.sign(dy) * PAD;
      return [x + sx, y + sy] as [number, number];
    });
  });
  const pb = boxes[pi] ?? { x: cw / 2, y: ch / 2, w: 0, h: 0 };
  let from: { x: number; y: number };
  if (p.callout) {
    const c = p.callout;
    // leave from the callout edge facing the box
    const below = pb.y >= c.y + c.h;
    const cx = Math.max(c.x + 16, Math.min(c.x + c.w - 16, pb.x + pb.w / 2));
    const after = pb.x >= c.x + c.w / 2;
    from = below ? { x: cx, y: c.y + c.h + 4 } : { x: after ? c.x + c.w + 4 : c.x - 4, y: c.y + c.h / 2 };
  } else {
    // a short lead-in from above-before the box
    from = { x: Math.max(12, pb.x - 44), y: Math.max(12, pb.y - 60) };
  }
  // aim at the nearest point of the box edge, stopping just short of it
  const nx = Math.max(pb.x, Math.min(pb.x + pb.w, from.x));
  const ny = Math.max(pb.y, Math.min(pb.y + pb.h, from.y));
  const dx = nx - from.x;
  const dy = ny - from.y;
  const len = Math.hypot(dx, dy);
  const arrow = len >= 18 ? { x1: from.x, y1: from.y, x2: nx - (dx / len) * 3, y2: ny - (dy / len) * 3 } : null;
  return { scale, tx, ty, iw, ih, boxes, polys, primary: pi, arrow };
}

/** Height (px, unscaled) of the text in a quad: the mean length of its two short sides. */
export function quadTextHeight(q: [number, number][] | undefined, iw: number, ih: number): number {
  if (!q || q.length !== 4) return 0;
  const d = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * iw, (a[1] - b[1]) * ih);
  return (d(q[0], q[3]) + d(q[1], q[2])) / 2;
}

/** True when two px rects overlap. */
export function overlaps(a: PxRect, b: PxRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const words = (s: string) =>
  new Set((s.toLowerCase().match(/[\p{L}\p{N}£$€.,]+/gu) ?? []).map((w) => w.replace(/[.,]+$/, "")).filter((w) => w.length > 1));

/** The step the "two papers disagree" card goes before: the step sharing most words with a conflicting quote
 *  (else step 1). -1 when the papers agree. */
export function conflictStepIndex(guide: Pick<Guide, "facts" | "steps">): number {
  const cs = guide.facts?.conflicts ?? [];
  if (!cs.length) return -1;
  let best = 0;
  let bestScore = 0;
  guide.steps.forEach((s, i) => {
    const sw = words(`${s.text_en} ${s.text}`);
    let score = 0;
    for (const c of cs)
      for (const w of words(`${c.label} ${c.leaflet}`)) {
        if (!sw.has(w)) continue;
        score += /\d/.test(w) ? 2 : w.length > 3 ? 1 : 0;
      }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Which of `guide.dates` this step is about (its highlighted words, callout or text), or -1. */
export function dateIndexFor(step: Step | undefined, guide: Pick<Guide, "dates">): number {
  const dates = guide.dates ?? [];
  if (!step || !dates.length) return -1;
  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const hs = (step.highlights ?? []).map((h) => norm(h.text)).filter(Boolean);
  const text = norm(`${step.text} ${step.text_en} ${step.callout?.value ?? ""} ${step.callout?.sub ?? ""}`);
  for (let i = 0; i < dates.length; i++) {
    const q = norm(dates[i].quote);
    if (q && hs.some((h) => h.includes(q) || q.includes(h))) return i;
  }
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    if (d.amount && step.callout?.value && norm(step.callout.value).includes(norm(d.amount))) return i;
    if (norm(d.what) && text.includes(norm(d.what))) return i;
  }
  return -1;
}
