import { describe, expect, it } from "vitest";
import type { Guide } from "../types";
import { mentionsDate, sheetData, undatedGaps } from "./sheet";

describe("summary dedupe", () => {
  it("spots a date already written in a step", () => {
    expect(mentionsDate("Pay the first part by 1 December.", "2026-12-01")).toBe(true);
    expect(mentionsDate("Pay by December 1st.", "2026-12-01")).toBe(true);
    expect(mentionsDate("Pay by 1/12/2026.", "2026-12-01")).toBe(true);
    expect(mentionsDate("Pay by 11 December.", "2026-12-01")).toBe(false);
    expect(mentionsDate("Pay by 1 January.", "2026-12-01")).toBe(false);
  });
  it("keeps only dated actions that no step covers", () => {
    const steps = ["Pay the first part by 1 December."];
    const dated = [{ date: "2026-12-01" }, { date: "2027-01-15" }];
    expect(undatedGaps(steps, dated)).toEqual([{ date: "2027-01-15" }]);
  });
  it("does not repeat a step's date in the list", () => {
    const g = {
      steps: [{ kind: "how", text: "Pay the first part by 1 December.", text_en: "Pay the first part by 1 December." }],
      dates: [
        { what: "Pay", what_en: "Pay", date: "2026-11-20", quote: "", amount: null },
        { what: "pay the first part", what_en: "pay the first part", date: "2026-12-01", quote: "", amount: null },
      ],
    } as unknown as Guide;
    const s = sheetData(g, true);
    expect(s.steps.filter((x) => /1 December/.test(x))).toHaveLength(1);
  });
});
