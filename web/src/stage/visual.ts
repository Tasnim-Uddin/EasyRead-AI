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
    // One photo at a time: the page of the first highlight.
    const page = hs[0].page;
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
