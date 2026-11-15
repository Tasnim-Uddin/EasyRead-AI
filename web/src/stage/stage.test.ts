import { describe, expect, it } from "vitest";
import { avatarBig, initialStage, stageReducer as r, tailCaption, whoToAsk, type StageState } from "./machine";
import { chooseVisual, conflictStepIndex, dateIndexFor, PAPER_ACTION_CLOSEUPS, maxScaleFor, overlaps, quadTextHeight, planHighlight, primaryHighlight, quadsBox } from "./visual";
import type { Step } from "../types";

const s0 = () => initialStage(3);

describe("stage machine", () => {
  it("starts on the intro and moves to step 1", () => {
    const s = r(s0(), { type: "start" });
    expect(s.phase).toBe("step");
    expect(s.index).toBe(0);
  });

  it("there is no check-in phase: a step stays a step until the user moves", () => {
    const s = r(s0(), { type: "start" });
    // an unknown or old "narrated" event changes nothing
    expect(r(s, { type: "narrated" } as never)).toBe(s);
    expect(s.phase).toBe("step");
  });

  it("next from a step goes forward, and finishes after the last step", () => {
    let s = r(s0(), { type: "start" });
    s = r(s, { type: "next" });
    expect([s.phase, s.index, s.dir]).toEqual(["step", 1, "fwd"]);
    s = r(r(s, { type: "next" }), { type: "next" });
    expect(s.phase).toBe("finish");
  });

  it("back slides back, and stays on step 1 at the start", () => {
    let s: StageState = { ...r(s0(), { type: "start" }), index: 2 };
    s = r(s, { type: "back" });
    expect([s.index, s.dir]).toEqual([1, "back"]);
    s = r(r(s, { type: "back" }), { type: "back" });
    expect(s.index).toBe(0);
    expect(r(s0(), { type: "back" }).phase).toBe("intro");
  });

  it("back from finish shows the last step", () => {
    let s = initialStage(3, 2, "step");
    s = r(s, { type: "next" });
    expect(s.phase).toBe("finish");
    s = r(s, { type: "back" });
    expect([s.phase, s.index]).toEqual(["step", 2]);
  });

  it("jump clamps", () => {
    const s = r(r(s0(), { type: "start" }), { type: "jump", index: 9 });
    expect(s.index).toBe(2);
    expect(r(s, { type: "jump", index: Number.NaN }).index).toBe(0);
  });

  it("sync from the avatar ignores the same step but follows a move", () => {
    const s = r(s0(), { type: "start" });
    expect(r(s, { type: "sync", index: 0 })).toBe(s);
    expect(r(s, { type: "sync", index: 1 }).phase).toBe("step");
  });

  it("ask, answer, and back to the step it came from", () => {
    let s = r(s0(), { type: "start" });
    s = r(s, { type: "ask", mode: "voice" });
    expect([s.phase, s.askMode, s.askFrom]).toEqual(["ask", "voice", "step"]);
    s = r(s, { type: "asked", question: " Can I drive? " });
    expect([s.phase, s.question, s.answer]).toEqual(["answer", "Can I drive?", null]);
    s = r(s, { type: "answered", answer: "That is not on your paper.", grounded: false, askWho: "the pharmacy" });
    expect([s.answer, s.grounded, s.askWho]).toEqual(["That is not on your paper.", false, "the pharmacy"]);
    // asking again keeps where we came from
    expect(r(s, { type: "ask", mode: "type" }).askFrom).toBe("step");
    s = r(s, { type: "backToStep" });
    expect([s.phase, s.index, s.answer]).toEqual(["step", 0, null]);
  });

  it("asking from the intro goes back to the intro", () => {
    const s = r(r(r(s0(), { type: "ask", mode: "type" }), { type: "asked", question: "hi" }), { type: "backToStep" });
    expect(s.phase).toBe("intro");
  });

  it("a late answer after leaving is dropped", () => {
    const s = r(s0(), { type: "start" });
    expect(r(s, { type: "answered", answer: "x" })).toBe(s);
  });

  it("the avatar is big only on intro and finish (a circle through steps, questions and answers)", () => {
    expect(["intro", "step", "ask", "answer", "finish"].map((p) => avatarBig(p as never))).toEqual([true, false, false, false, true]);
  });

  it("restart goes to step 1", () => {
    const s = r({ ...s0(), phase: "finish", index: 2 }, { type: "restart" });
    expect([s.phase, s.index]).toEqual(["step", 0]);
  });
});

describe("helpers", () => {
  it("tailCaption keeps the latest words", () => {
    expect(tailCaption("short")).toBe("short");
    const t = tailCaption("word ".repeat(100), 20);
    expect(t.startsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(21);
  });
  it("whoToAsk prefers the server's ask_who, then the sender", () => {
    expect(whoToAsk({ name: "Boots" }, "the council")).toBe("the council");
    expect(whoToAsk({ name: "Boots" }, null)).toBe("Boots");
    expect(whoToAsk(null, "")).toBeNull();
    // the real HMRC letter: the chip names the sender, as the guide does
    const hmrc = { name: "HM Revenue & Customs, Accounts Office Cumbernauld" };
    expect(whoToAsk(hmrc, "whoever sent it")).toBe("HM Revenue & Customs");
    expect(whoToAsk(hmrc, null)).toBe("HM Revenue & Customs");
    expect(whoToAsk(hmrc, "HM Revenue & Customs")).toBe("HM Revenue & Customs");
    expect(whoToAsk({ name: "Boots" }, "nadawcę")).toBe("Boots");
    expect(whoToAsk(null, "whoever sent it")).toBeNull();
  });
});

const step = (over: Partial<Step> = {}): Step => ({
  index: 0, text: "t", text_en: "t", kind: "how", picture_prompt: "", image_url: null, technique_clip_id: null, status: "ready", ...over,
});
const quad: [number, number][] = [[0.1, 0.2], [0.5, 0.2], [0.5, 0.3], [0.1, 0.3]];
const guide = { source: { kind: "x", image_urls: ["/p0.jpg", "/p1.jpg"], is_sample: false } };

describe("visual priority", () => {
  const yes = () => true;
  const no = () => false;
  it("a physical-action close-up wins over a highlight", () => {
    const s = step({ visual: { kind: "closeup", id: "inhaler_shake" }, highlights: [{ page: 0, text: "x", quad }], image_url: "/i.png" });
    expect(chooseVisual(s, guide, yes)).toEqual({ kind: "closeup", id: "inhaler_shake", callout: null });
  });
  it("a paper-action close-up gives way to the highlight on the user's photo", () => {
    const s = step({ visual: { kind: "closeup", id: "pay_card" }, highlights: [{ page: 0, text: "x", quad }], callout: { value: "£212.50", sub: "by 17 Nov" } });
    const v = chooseVisual(s, guide, yes);
    expect(v.kind).toBe("highlight");
    if (v.kind === "highlight") expect(v.callout).toEqual({ value: "£212.50", sub: "by 17 Nov" });
  });
  it("a paper-action close-up without a highlight keeps the callout card", () => {
    const s = step({ visual: { kind: "closeup", id: "pay_card" }, callout: { value: "£212.50" }, image_url: "/i.png" });
    expect(chooseVisual(s, guide, yes)).toEqual({ kind: "closeup", id: "pay_card", callout: { value: "£212.50" } });
  });
  it("the paper-action list", () => {
    expect([...PAPER_ACTION_CLOSEUPS].sort()).toEqual(
      ["bring_document", "calendar_date", "clock_wait", "go_online", "keep_safe", "pay_bank", "pay_card", "phone_call", "post_letter", "sign_here", "tick_box", "write_in_box"],
    );
    for (const id of ["inhaler_shake", "spacer_use", "tablet_with_water", "eye_drops", "liquid_measure_spoon", "cream_apply", "rinse_mouth", "screwdriver_turn", "plug_in"])
      expect(PAPER_ACTION_CLOSEUPS.has(id)).toBe(false);
  });
  it("unknown close-up falls through to the highlight on the user's photo", () => {
    const s = step({ visual: { kind: "closeup", id: "nope" }, highlights: [{ page: 1, text: "x", quad }], callout: { value: "£5" }, image_url: "/i.png" });
    const v = chooseVisual(s, guide, no);
    expect(v.kind).toBe("highlight");
    if (v.kind === "highlight") {
      expect(v.url).toBe("/p1.jpg");
      expect(v.callout).toEqual({ value: "£5" });
    }
  });
  it("highlights on a missing page or with a bad quad are ignored", () => {
    const s = step({ highlights: [{ page: 5, text: "x", quad }, { page: 0, text: "y", quad: [[0, 0]] as never }], image_url: "/i.png" });
    expect(chooseVisual(s, guide, no)).toEqual({ kind: "image", url: "/i.png" });
  });
  it("words only when nothing else", () => {
    expect(chooseVisual(step(), guide, no)).toEqual({ kind: "text" });
    expect(chooseVisual(undefined, guide, no)).toEqual({ kind: "text" });
  });
  it("quadsBox frames the highlight", () => {
    const b = quadsBox([{ page: 0, text: "x", quad }]);
    expect(b.x).toBeCloseTo(0.1);
    expect(b.w).toBeCloseTo(0.4);
  });
});

describe("highlight pan/zoom", () => {
  type Q = [number, number][];
  const rect = (x: number, y: number, w: number, h: number): Q => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  // the real HMRC letter: £98.27 mid-page, the helpline lower down, a reference near the top
  const amount = { page: 0, text: "£98.27", quad: rect(0.5513, 0.4183, 0.0747, 0.021) };
  const phone = { page: 0, text: "0345 302 1429", quad: rect(0.2595, 0.5793, 0.1441, 0.0202) };
  const ref = { page: 0, text: "payment reference", quad: rect(0.08, 0.06, 0.2, 0.018) };
  const stage = { cw: 358, ch: 371, imgAspect: 0.75 };
  const card = { x: 12, y: 12, w: 140, h: 64 };
  const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const inside = (b: { x: number; y: number; w: number; h: number }, cw: number, ch: number) =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= cw && b.y + b.h <= ch;
  const hits = (a: { x1: number; y1: number; x2: number; y2: number }, b: { x: number; y: number; w: number; h: number }) => {
    const pad = 5; // the arrow stops just short of the box
    return a.x2 >= b.x - pad && a.x2 <= b.x + b.w + pad && a.y2 >= b.y - pad && a.y2 <= b.y + b.h + pad;
  };

  it("picks the highlight matching the callout", () => {
    expect(primaryHighlight([ref, amount], { value: "£98.27" })).toBe(1);
    expect(primaryHighlight([ref, amount], { value: "0345 302 1429" })).toBe(0);
    expect(primaryHighlight([ref, phone], { value: "0345302 1429" })).toBe(1);
    expect(primaryHighlight([ref, amount], null)).toBe(0);
  });

  it("zooms in so the highlighted words are readable, centred in the free band, clear of the callout", () => {
    const p = planHighlight({ highlights: [amount], primary: 0, ...stage, reserveTop: 108, reserveBottom: 0, callout: card });
    const b = p.boxes[0];
    expect(p.scale).toBeGreaterThan(2);
    expect(b.h).toBeGreaterThanOrEqual(30); // text line ~ 40px tall on screen
    expect(inside(b, stage.cw, stage.ch)).toBe(true);
    expect(b.y).toBeGreaterThanOrEqual(108);
    expect(overlaps(b, card)).toBe(false);
    const c = centre(b);
    expect(Math.abs(c.x - stage.cw / 2)).toBeLessThan(stage.cw * 0.2);
    expect(Math.abs(c.y - (108 + (stage.ch - 108) / 2))).toBeLessThan(40);
    expect(p.arrow).not.toBeNull();
    expect(hits(p.arrow!, b)).toBe(true);
    // the arrow leaves from the callout
    expect(p.arrow!.y1).toBeGreaterThanOrEqual(card.y + card.h);
    expect(p.arrow!.x1).toBeGreaterThanOrEqual(card.x);
    expect(p.arrow!.x1).toBeLessThanOrEqual(card.x + card.w);
  });

  it("with highlights far apart, frames the one the step is about instead of the whole page", () => {
    const p = planHighlight({ highlights: [ref, amount, phone], primary: 1, ...stage, reserveTop: 88, reserveBottom: 64, callout: card });
    expect(p.primary).toBe(1);
    const b = p.boxes[1];
    expect(p.scale).toBeGreaterThan(2);
    expect(inside(b, stage.cw, stage.ch - 64)).toBe(true);
    expect(b.y).toBeGreaterThanOrEqual(88);
    expect(hits(p.arrow!, b)).toBe(true);
  });

  it("keeps two nearby highlights in one frame when both stay readable", () => {
    const near = { page: 0, text: "by 17 Nov", quad: rect(0.55, 0.45, 0.12, 0.02) };
    const p = planHighlight({ highlights: [amount, near], primary: 0, ...stage, reserveTop: 88, reserveBottom: 0, callout: card });
    for (const b of p.boxes) expect(inside(b, stage.cw, stage.ch)).toBe(true);
  });

  it("a highlight at the very top of the page still clears the callout band", () => {
    const p = planHighlight({ highlights: [ref], primary: 0, ...stage, reserveTop: 108, reserveBottom: 64, callout: card });
    const b = p.boxes[0];
    expect(b.y).toBeGreaterThanOrEqual(108 - 0.5);
    expect(b.y + b.h).toBeLessThanOrEqual(stage.ch - 64 + 0.5);
    expect(overlaps(b, card)).toBe(false);
    expect(hits(p.arrow!, b)).toBe(true);
  });

  it("a highlight at the bottom right corner stays on screen", () => {
    const corner = { page: 0, text: "Sign here", quad: rect(0.82, 0.95, 0.16, 0.03) };
    const p = planHighlight({ highlights: [corner], primary: 0, ...stage, reserveTop: 108, reserveBottom: 64, callout: null });
    const b = p.boxes[0];
    expect(inside(b, stage.cw, stage.ch - 64 + 0.5)).toBe(true);
    expect(p.arrow).not.toBeNull();
    expect(hits(p.arrow!, b)).toBe(true);
  });

  it("a whole form row too wide to fit is still zoomed to readable text, starting at its first word", () => {
    const row = { page: 0, text: "Name and full postal address of your bank", quad: rect(0.03, 0.4, 0.9, 0.02) };
    const p = planHighlight({ highlights: [row], primary: 0, cw: 358, ch: 320, imgAspect: 1.3, reserveTop: 86, reserveBottom: 0, callout: null });
    const b = p.boxes[0];
    expect(b.h - 12).toBeGreaterThanOrEqual(23); // text height on screen (box minus padding)
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThan(24);
    expect(b.y).toBeGreaterThanOrEqual(86);
    expect(b.y + b.h).toBeLessThanOrEqual(320);
  });

  it("a photo shorter than the stage is placed so the highlight sits in the free band, not stuck to the top", () => {
    const form = { page: 0, text: "Date", quad: rect(0.6, 0.85, 0.2, 0.05) };
    const p = planHighlight({ highlights: [form], primary: 0, cw: 358, ch: 400, imgAspect: 2.4, reserveTop: 108, reserveBottom: 0, callout: card });
    const b = p.boxes[0];
    expect(b.y).toBeGreaterThanOrEqual(108);
    expect(b.y + b.h).toBeLessThanOrEqual(400);
    expect(hits(p.arrow!, b)).toBe(true);
  });

  it("measures text height along a tilted quad, so a skewed photo is zoomed as much as a flat one", () => {
    const tilted: [number, number][] = [[0.2315, 0.6705], [0.4271, 0.6453], [0.4308, 0.6734], [0.2346, 0.6986]];
    expect(quadTextHeight(tilted, 358, 333)).toBeLessThan(10);
    const p = planHighlight({ highlights: [{ page: 0, text: "0300 000 0000", quad: tilted }], primary: 0, cw: 358, ch: 320, imgAspect: 1.075, reserveTop: 100, reserveBottom: 0, callout: card, maxScale: 4.47 });
    expect(p.scale).toBeGreaterThan(3.5);
  });

  it("zooms further into a sharp photo than a small one", () => {
    expect(maxScaleFor(4000, 358)).toBe(8);
    expect(maxScaleFor(800, 358)).toBe(3);
    expect(maxScaleFor(0, 358)).toBe(3);
    const tiny = { page: 0, text: "0300 000 0000", quad: rect(0.4, 0.5, 0.12, 0.008) };
    const base = { highlights: [tiny], primary: 0, ...stage, reserveTop: 108, reserveBottom: 0, callout: card };
    expect(planHighlight({ ...base, maxScale: 8 }).scale).toBeGreaterThan(planHighlight(base).scale);
  });

  it("works in a short Read-mode stage and with a landscape photo", () => {
    const p = planHighlight({ highlights: [phone], primary: 0, cw: 358, ch: 208, imgAspect: 1.4, reserveTop: 86, reserveBottom: 64, callout: card });
    const b = p.boxes[0];
    expect(inside(b, 358, 208)).toBe(true);
    expect(p.scale).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(p.tx) && Number.isFinite(p.ty)).toBe(true);
  });
});

describe("extras hooks", () => {
  const facts = { medicine: null, dose: null, frequency: null, route: null, device_type: "", device_confidence: 0, warnings: [], get_help: [], unreadable: [] };
  it("puts the conflict card before the step about it", () => {
    const steps = [step({ text_en: "This is your inhaler." }), step({ index: 1, text_en: "Take 2 puffs each time." })];
    expect(conflictStepIndex({ facts: { ...facts, conflicts: [{ field: "dose", label: "Take 2 puffs", leaflet: "Take 1 puff" }] }, steps })).toBe(1);
    expect(conflictStepIndex({ facts, steps })).toBe(-1);
  });
  it("finds the date a step is about", () => {
    const dates = [{ what: "Pay £212.50", what_en: "Pay £212.50", date: "2026-11-17", quote: "by 17 November 2026", amount: "£212.50" }];
    expect(dateIndexFor(step({ highlights: [{ page: 0, text: "by 17 November 2026", quad }] }), { dates })).toBe(0);
    expect(dateIndexFor(step({ callout: { value: "£212.50", sub: "by 17 Nov" } }), { dates })).toBe(0);
    expect(dateIndexFor(step({ text: "Keep it safe." }), { dates })).toBe(-1);
    expect(dateIndexFor(step(), {})).toBe(-1);
  });
});
