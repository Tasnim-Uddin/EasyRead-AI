import { describe, expect, it } from "vitest";
import { avatarBig, initialStage, narrationTimeoutMs, stageReducer as r, tailCaption, whoToAsk, type StageState } from "./machine";
import { chooseVisual, PAPER_ACTION_CLOSEUPS, quadsBox, zoomTo } from "./visual";
import type { Step } from "../types";

const s0 = () => initialStage(3);

describe("stage machine", () => {
  it("starts on the intro and moves to step 1", () => {
    const s = r(s0(), { type: "start" });
    expect(s.phase).toBe("step");
    expect(s.index).toBe(0);
  });

  it("turns a narrated step into a check-in, and only a step", () => {
    let s = r(r(s0(), { type: "start" }), { type: "narrated" });
    expect(s.phase).toBe("checkin");
    expect(r(s0(), { type: "narrated" }).phase).toBe("intro");
    s = r(s, { type: "ask", mode: "type" });
    expect(r(s, { type: "narrated" }).phase).toBe("ask");
  });

  it("next from check-in goes forward, and finishes after the last step", () => {
    let s = r(s0(), { type: "start" });
    s = r(r(s, { type: "narrated" }), { type: "next" });
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
    const s = r(r(s0(), { type: "start" }), { type: "narrated" });
    expect(r(s, { type: "sync", index: 0 })).toBe(s);
    expect(r(s, { type: "sync", index: 1 }).phase).toBe("step");
  });

  it("ask, answer, and back to the step it came from", () => {
    let s = r(r(s0(), { type: "start" }), { type: "narrated" });
    s = r(s, { type: "ask", mode: "voice" });
    expect([s.phase, s.askMode, s.askFrom]).toEqual(["ask", "voice", "checkin"]);
    s = r(s, { type: "asked", question: " Can I drive? " });
    expect([s.phase, s.question, s.answer]).toEqual(["answer", "Can I drive?", null]);
    s = r(s, { type: "answered", answer: "That is not on your paper.", grounded: false, askWho: "the pharmacy" });
    expect([s.answer, s.grounded, s.askWho]).toEqual(["That is not on your paper.", false, "the pharmacy"]);
    // asking again keeps where we came from
    expect(r(s, { type: "ask", mode: "type" }).askFrom).toBe("checkin");
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

  it("the avatar is big on intro, check-in, answer, finish", () => {
    expect(["intro", "step", "checkin", "ask", "answer", "finish"].map((p) => avatarBig(p as never))).toEqual([true, false, true, false, true, true]);
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
  });
  it("narration timeout is bounded", () => {
    expect(narrationTimeoutMs("")).toBe(9000);
    expect(narrationTimeoutMs("a ".repeat(500))).toBe(30000);
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
  it("quadsBox and zoomTo frame the highlight", () => {
    const b = quadsBox([{ page: 0, text: "x", quad }]);
    expect(b.x).toBeCloseTo(0.1);
    expect(b.w).toBeCloseTo(0.4);
    const z = zoomTo(b, 360, 300, 0.75);
    expect(z.scale).toBeGreaterThanOrEqual(1);
    expect(z.scale).toBeLessThanOrEqual(3);
    expect(z.tx).toBeLessThanOrEqual(0);
  });
});
