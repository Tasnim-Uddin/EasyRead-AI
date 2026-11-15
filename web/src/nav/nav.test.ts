import { describe, expect, it } from "vitest";
import { back, backAction, canGoBack, createHistory, current, moveTo, previous, push, replace } from "./history";
import { resumeTarget } from "./resume";
import { initialStage, stageReducer } from "../stage/machine";

type S = "home" | "papers" | "step" | "done" | "share" | "settings" | "reading" | "camera" | "check";

describe("screen history stack", () => {
  it("Finish -> Save or share -> back lands on Finish, not the last step", () => {
    let h = createHistory<S>("home");
    h = push(h, "step");
    h = push(h, "done");
    h = push(h, "share");
    h = back(h);
    expect(current(h)).toBe("done");
    h = back(h);
    expect(current(h)).toBe("step");
  });

  it("the first screen has nothing behind it: back goes Home by replacing", () => {
    const h = createHistory<S>("step");
    expect(canGoBack(h)).toBe(false);
    expect(back(h)).toBe(h);
    expect(backAction(h, "home")).toEqual({ kind: "replace", screen: "home" });
    expect(backAction(push(h, "share"), "home")).toEqual({ kind: "pop" });
  });

  it("replace swaps the top, so Back never lands on a loading or camera screen", () => {
    let h = createHistory<S>("home");
    h = push(h, "camera");
    h = replace(h, "check");
    h = push(h, "reading");
    h = replace(h, "step");
    expect(h.stack).toEqual(["home", "check", "step"]);
    expect(previous(h)).toBe("check");
  });

  it("pushing the screen already on top changes nothing", () => {
    const h = push(createHistory<S>("home"), "settings");
    expect(push(h, "settings")).toBe(h);
  });

  it("a new screen after going back drops the old forward entries", () => {
    let h = createHistory<S>("home");
    h = push(push(h, "papers"), "step");
    h = back(h);
    h = push(h, "settings");
    expect(h.stack).toEqual(["home", "papers", "settings"]);
    expect(h.at).toBe(2);
  });

  it("browser Back / Forward / Android back move to the entry's depth", () => {
    let h = createHistory<S>("home");
    h = push(push(push(h, "step"), "done"), "share");
    h = moveTo(h, 2, "done"); // browser Back
    expect([current(h), h.at]).toEqual(["done", 2]);
    h = moveTo(h, 3, "share"); // browser Forward
    expect([current(h), h.at]).toEqual(["share", 3]);
    h = moveTo(h, 0, "home");
    expect([current(h), canGoBack(h)]).toEqual(["home", false]);
  });

  it("an entry the stack does not know (after a reload) keeps the depths aligned", () => {
    const h = moveTo(createHistory<S>("home"), 3, "papers");
    expect(h.stack.length).toBe(4);
    expect([current(h), h.at]).toEqual(["papers", 3]);
    const fixed = moveTo(push(createHistory<S>("home"), "step"), 1, "done");
    expect(fixed.stack).toEqual(["home", "done"]);
    expect(moveTo(createHistory<S>("home"), Number.NaN, "home").at).toBe(0);
  });
});

describe("resume a guide from My guides", () => {
  it("a guide never opened starts at the beginning", () => {
    expect(resumeTarget(6, null)).toEqual({ screen: "step", index: 0 });
  });

  it("opens on the step the user left off on", () => {
    expect(resumeTarget(6, { step: 3, total: 6, done: false })).toEqual({ screen: "step", index: 3 });
  });

  it("a finished guide opens on You did it", () => {
    expect(resumeTarget(6, { step: 5, total: 6, done: true })).toEqual({ screen: "done", index: 5 });
  });

  it("My guides Continue (an explicit step) wins", () => {
    expect(resumeTarget(6, { step: 5, total: 6, done: true }, 2)).toEqual({ screen: "step", index: 2 });
  });

  it("clamps a saved step when the guide now has fewer steps", () => {
    expect(resumeTarget(4, { step: 7, total: 8, done: false })).toEqual({ screen: "step", index: 3 });
    expect(resumeTarget(4, { step: -2, total: 8, done: false })).toEqual({ screen: "step", index: 0 });
    expect(resumeTarget(0, { step: 3, total: 6, done: true })).toEqual({ screen: "step", index: 0 });
  });
});

describe("the stage follows the You did it screen", () => {
  it("finish (opened directly) shows You did it on the last step; back shows the last step", () => {
    const f = stageReducer(initialStage(4, 1, "step"), { type: "finish" });
    expect([f.phase, f.index]).toEqual(["finish", 3]);
    const b = stageReducer(f, { type: "back" });
    expect([b.phase, b.index]).toEqual(["step", 3]);
  });
});
