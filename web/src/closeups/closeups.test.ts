import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ids from "./ids.json";
import { CloseUp, CLOSEUP_IDS, hasCloseUp } from "./index";

describe("close-up library", () => {
  it("has a drawing for every shared id, and no duplicates", () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(45);
    for (const id of CLOSEUP_IDS) expect(hasCloseUp(id)).toBe(true);
    expect(hasCloseUp("nope")).toBe(false);
  });

  it("renders every close-up as wordless svg, still when not playing", () => {
    for (const id of CLOSEUP_IDS) {
      const still = renderToStaticMarkup(createElement(CloseUp, { id, playing: false }));
      expect(still).toContain(`data-closeup="${id}"`);
      expect(still).not.toContain("cu-on");
      expect(still).not.toMatch(/<text|<foreignObject/);
      expect(renderToStaticMarkup(createElement(CloseUp, { id, playing: true }))).toContain("cu-on");
    }
  });

  it("keeps each new everyday drawing small", () => {
    const src = readFileSync(new URL("./everyday.tsx", import.meta.url), "utf8");
    const parts = src.split(/\nexport function /).slice(1);
    expect(parts.length).toBe(18);
    for (const p of parts) expect(p.length).toBeLessThan(8000);
  });
});
