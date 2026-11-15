import { describe, expect, it } from "vitest";
import council from "../../../demo/fixtures/guide_council_letter.json";
import inhaler from "../../../demo/fixtures/guide_inhaler.json";
import flatpack from "../../../demo/fixtures/guide_flatpack.json";
import type { Guide } from "../types";
import { buildChips, chipKey, continueRow, groupRows } from "./guides";
import { buildIcs, datesFor, escapeText, foldLine, googleCalendarLink, minusDays, parseDate } from "./ics";
import { buildQuestions } from "./questions";
import { sheetData } from "./sheet";

const letter = council as unknown as Guide;

describe("filter chips", () => {
  it("maps doc_type + domain to a chip", () => {
    expect(chipKey({ doc_type: "how_to", domain: "medicine" })).toBe("medicine");
    expect(chipKey({ doc_type: "how_to", domain: "furniture" })).toBe("howto");
    expect(chipKey({ doc_type: undefined })).toBe("howto");
    expect(chipKey({ doc_type: "letter" })).toBe("letter");
    expect(chipKey({ doc_type: "bill" })).toBe("bill");
    expect(chipKey({ doc_type: "form" })).toBe("form");
    expect(chipKey({ doc_type: "other" })).toBe("other");
  });
  it("is hidden with fewer than 2 types", () => {
    expect(buildChips([])).toEqual([]);
    expect(buildChips([{ doc_type: "letter" }, { doc_type: "letter" }])).toEqual([]);
  });
  it("puts All first, then the user's own types by count", () => {
    const rows = [
      { doc_type: "letter" },
      { doc_type: "how_to", domain: "medicine" },
      { doc_type: "letter" },
      { doc_type: "bill" },
      { doc_type: "letter" },
      { doc_type: "bill" },
    ];
    expect(buildChips(rows)).toEqual([
      { key: "all", count: 6 },
      { key: "letter", count: 3 },
      { key: "bill", count: 2 },
      { key: "medicine", count: 1 },
    ]);
  });
});

describe("date groups", () => {
  const now = new Date(2026, 10, 15, 10, 0);
  it("splits into Today / This week / Earlier, newest first, empty groups left out", () => {
    const rows = [
      { id: "a", created_at: new Date(2026, 10, 15, 8, 0).toISOString() },
      { id: "b", created_at: new Date(2026, 10, 1).toISOString() },
      { id: "c", created_at: new Date(2026, 10, 15, 9, 30).toISOString() },
      { id: "d", created_at: new Date(2026, 10, 12).toISOString() },
      { id: "e", created_at: null },
    ];
    const g = groupRows(rows, now);
    expect(g.map((x) => [x.key, x.rows.map((r) => r.id)])).toEqual([
      ["today", ["c", "a"]],
      ["thisWeek", ["d"]],
      ["earlier", ["b", "e"]],
    ]);
    expect(groupRows([{ created_at: new Date(2026, 10, 2).toISOString() }], now).map((x) => x.key)).toEqual(["earlier"]);
  });
  it("continue = most recent unfinished ready guide", () => {
    const rows = [
      { id: "a", status: "ready" as const },
      { id: "b", status: "ready" as const },
      { id: "c", status: "writing" as const },
    ];
    const p = { a: { step: 2, total: 9, done: false, at: 10 }, b: { step: 1, total: 5, done: true, at: 20 }, c: { step: 0, total: 3, done: false, at: 30 } };
    expect(continueRow(rows, p)?.id).toBe("a");
    expect(continueRow(rows, {})).toBeNull();
  });
});

describe("calendar", () => {
  it("reads printed dates", () => {
    const now = new Date(2026, 10, 15);
    expect(parseDate("1 December 2026", now)).toBe("2026-12-01");
    expect(parseDate("by 17 Nov", now)).toBe("2026-11-17");
    expect(parseDate("10 Nov", now)).toBe("2027-11-10");
    expect(parseDate("December 3rd, 2026", now)).toBe("2026-12-03");
    expect(parseDate("2026-12-01", now)).toBe("2026-12-01");
    expect(parseDate("01/12/2026", now)).toBe("2026-12-01");
    expect(parseDate("31 February 2026", now)).toBeNull();
    expect(parseDate("soon", now)).toBeNull();
  });
  it("derives dates from content.by_when when guide.dates is missing", () => {
    const d = datesFor(letter, new Date(2026, 10, 15));
    expect(d.map((x) => [x.date, x.what])).toEqual([
      ["2026-12-01", "Pay the first part"],
      ["2026-12-15", "Tell the council if you disagree"],
    ]);
    const withDates = { ...letter, dates: [{ what: "Pay £212.50", what_en: "Pay £212.50", date: "2026-11-17", quote: "17 Nov", amount: "£212.50" }] } as Guide;
    expect(datesFor(withDates, new Date(2026, 10, 15))[0].date).toBe("2026-11-17");
  });
  it("leaves out dates that have passed (no Remind me for an old bill)", () => {
    const old = { ...letter, content: { ...letter.content, by_when: [{ date: "1 Nov 2023", what: "first payment" }, { date: "1 Oct 2024", what: "last payment" }] } } as Guide;
    expect(datesFor(old, new Date(2026, 10, 15))).toEqual([]);
    const saved = { ...letter, dates: [{ what: "Pay", what_en: "Pay", date: "2026-11-14", quote: "14 Nov", amount: null }] } as Guide;
    expect(datesFor(saved, new Date(2026, 10, 15))).toEqual([]);
    expect(datesFor(saved, new Date(2026, 10, 14))).toHaveLength(1);
  });
  it("minusDays crosses months and years", () => {
    expect(minusDays("2026-12-01", 1)).toBe("2026-11-30");
    expect(minusDays("2027-01-02", 3)).toBe("2026-12-30");
    expect(minusDays("2026-11-30", -1)).toBe("2026-12-01");
  });
  it("escapes TEXT values and folds at 75 octets without splitting a character", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = "SUMMARY:" + "ادفع ".repeat(30);
    const folded = foldLine(long);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(long);
  });
  it("builds an all-day event with alarms (golden)", () => {
    const ics = buildIcs({
      uid: "g_1-2026-12-01-1@easyread",
      what: "Pay the first part, £112",
      date: "2026-12-01",
      description: "1. Check the new amount.\n2. Pay by 1 December.",
      alarmsDaysBefore: [1, 3],
      stamp: new Date(Date.UTC(2026, 10, 15, 3, 0, 0)),
    });
    expect(ics).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EasyRead//Remind me//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:g_1-2026-12-01-1@easyread",
        "DTSTAMP:20261115T030000Z",
        "DTSTART;VALUE=DATE:20261201",
        "DTEND;VALUE=DATE:20261202",
        "SUMMARY:Pay the first part\\, £112",
        "DESCRIPTION:1. Check the new amount.\\n2. Pay by 1 December.",
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-P0DT15H",
        "DESCRIPTION:Pay the first part\\, £112",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-P2DT15H",
        "DESCRIPTION:Pay the first part\\, £112",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });
  it("builds a timed event", () => {
    const ics = buildIcs({ uid: "u", what: "GP", date: "2026-11-20", time: "09:30", alarmsDaysBefore: [1], stamp: new Date(0) });
    expect(ics).toContain("DTSTART:20261120T093000\r\nDTEND:20261120T103000\r\n");
    expect(ics).toContain("TRIGGER:-P1D\r\n");
  });
  it("makes a Google Calendar link", () => {
    expect(googleCalendarLink({ what: "Pay £112 & check", date: "2026-12-01", details: "Line 1\nLine 2" })).toBe(
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Pay+%C2%A3112+%26+check&dates=20261201%2F20261202&details=Line+1%0ALine+2",
    );
    expect(googleCalendarLink({ what: "GP", date: "2026-11-20", time: "9:05" })).toContain("dates=20261120T090500%2F20261120T100500");
  });
});

describe("Check I've got it", () => {
  it("asks 2-3 questions about a letter, with the answer's step", () => {
    const qs = buildQuestions(letter, "en");
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.length).toBeLessThanOrEqual(3);
    expect(qs[0].q).toBe("What do you need to do first?");
    expect(qs[0].options[qs[0].correct]).toBe("Check the new amount in the letter.");
    expect(qs[0].step).toBe(1);
    expect(qs[1].options[qs[1].correct]).toBe("1 December 2026");
    for (const q of qs) {
      expect(q.options.length).toBe(3);
      expect(q.icons.length).toBe(3);
      expect(new Set(q.options).size).toBe(3);
    }
  });
  it("works in another UI language and for medicine and how-to papers", () => {
    const es = buildQuestions(letter, "es");
    expect(es[0].q).not.toBe("What do you need to do first?");
    expect(buildQuestions(inhaler as unknown as Guide).length).toBeGreaterThanOrEqual(2);
    expect(buildQuestions(flatpack as unknown as Guide).length).toBeGreaterThanOrEqual(2);
  });
  it("uses the steps' close-ups as picture answers", () => {
    const q = buildQuestions(inhaler as unknown as Guide).find((x) => x.q === "What do you do first?")!;
    expect(q.options[q.correct]).toBe("Shake the inhaler 4 times.");
    expect(q.visuals[q.correct]).toBe("inhaler_shake");
    expect(q.visuals.filter(Boolean).length).toBe(3);
  });
});

describe("share sheet", () => {
  it("has title, key steps, amount and date, and no photo", () => {
    const s = sheetData(letter);
    expect(s.title).toBe("This letter says your council tax bill has changed.");
    expect(s.steps[0]).toBe("Check the new amount in the letter.");
    expect(s.amount?.value).toBe("£112");
    expect(s.date?.iso).toBe("2026-12-01");
  });
  it("uses the user's own name first", () => {
    expect(sheetData({ ...letter, title_override: "Council tax" } as Guide).title).toBe("Council tax");
  });
});
