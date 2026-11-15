// Remind me: dated actions from the guide, an .ics calendar file built in the browser, and a Google Calendar link.
import type { DatedAction, Guide } from "../types";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function valid(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** A printed date ("1 December 2026", "17 Nov", "2026-12-01", "01/12/2026" as UK day/month) as YYYY-MM-DD, or null.
 *  With no year, the next such date on or after `now`. */
export function parseDate(text: string, now = new Date()): string | null {
  const s = text.toLowerCase();
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m && valid(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (valid(y, +m[2], +m[1])) return iso(y, +m[2], +m[1]);
  }
  const name = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${name}\\b(?:,?\\s+(\\d{4}))?`));
  let day: number, mon: number, year: number | null;
  if (m) {
    day = +m[1];
    mon = MONTHS[m[2]];
    year = m[3] ? +m[3] : null;
  } else {
    m = s.match(new RegExp(`\\b${name}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`));
    if (!m) return null;
    mon = MONTHS[m[1]];
    day = +m[2];
    year = m[3] ? +m[3] : null;
  }
  if (year === null) {
    year = now.getFullYear();
    const today = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
    if (iso(year, mon, day) < today) year += 1;
  }
  return valid(year, mon, day) ? iso(year, mon, day) : null;
}

/** guide.dates when the server found them; otherwise derived from content.by_when (older guides and the samples). */
export function datesFor(g: Guide, now = new Date()): DatedAction[] {
  if (g.dates && g.dates.length) return g.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  const out: DatedAction[] = [];
  for (const b of g.content?.by_when ?? []) {
    const date = parseDate(b.date, now);
    if (!date) continue;
    const what = b.what ? b.what.charAt(0).toUpperCase() + b.what.slice(1) : "";
    out.push({ what, what_en: what, date, time: null, quote: b.date, amount: null });
  }
  return out;
}

/** YYYY-MM-DD minus n days. */
export function minusDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - n));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** A local Date at noon on that day (safe for formatting in any time zone). */
export const dayDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/* ---- RFC 5545 ---- */
/** TEXT value escaping: backslash, semicolon, comma, newline. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets (UTF-8), never inside a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(cur);
      cur = "";
      bytes = 0;
      limit = 74; // continuation lines start with one space
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export interface IcsEvent {
  uid: string;
  what: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:MM, missing = all day
  description?: string;
  /** Reminders, in days before. */
  alarmsDaysBefore: number[];
  stamp?: Date;
}

const stampOf = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const compact = (date: string) => date.replace(/-/g, "");

/** End of a timed event: one hour later (same day; capped at 23:59). */
function plusHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return h >= 23 ? "235900" : `${pad(h + 1)}${pad(m)}00`;
}

export function buildIcs(ev: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EasyRead//Remind me//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${stampOf(ev.stamp ?? new Date())}`,
  ];
  if (ev.time && /^\d{1,2}:\d{2}$/.test(ev.time)) {
    const [h, m] = ev.time.split(":").map(Number);
    // Floating local time: the reminder is at that clock time wherever the phone is.
    lines.push(`DTSTART:${compact(ev.date)}T${pad(h)}${pad(m)}00`, `DTEND:${compact(ev.date)}T${plusHour(ev.time)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(ev.date)}`, `DTEND;VALUE=DATE:${compact(minusDays(ev.date, -1))}`);
  }
  lines.push(`SUMMARY:${escapeText(ev.what)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  lines.push("TRANSP:TRANSPARENT");
  for (const days of ev.alarmsDaysBefore) {
    // All day: 9 in the morning, `days` days before. Timed: the same clock time, `days` days before.
    const trigger = ev.time ? `-P${days}D` : days > 0 ? `-P${days - 1}DT15H` : "PT9H";
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${trigger}`, `DESCRIPTION:${escapeText(ev.what)}`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** calendar.google.com "add event" link with the same event. */
export function googleCalendarLink(ev: { what: string; date: string; time?: string | null; details?: string }): string {
  let dates: string;
  if (ev.time && /^\d{1,2}:\d{2}$/.test(ev.time)) {
    const [h, m] = ev.time.split(":").map(Number);
    dates = `${compact(ev.date)}T${pad(h)}${pad(m)}00/${compact(ev.date)}T${plusHour(ev.time)}`;
  } else dates = `${compact(ev.date)}/${compact(minusDays(ev.date, -1))}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.what, dates });
  if (ev.details) p.set("details", ev.details);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** The event description: the key steps and who sent the paper. */
export function eventDetails(g: Guide, lang: string, contactLabel: string): string {
  const steps = g.steps.filter((s) => s.kind === "how" || s.kind === "when").slice(0, 5).map((s, i) => `${i + 1}. ${s.text}`);
  const who = g.sender ? [g.sender.name, g.sender.contact].filter(Boolean).join(" - ") : "";
  void lang;
  return [...steps, who ? `${contactLabel}: ${who}` : ""].filter(Boolean).join("\n");
}

/** Open the .ics: iOS Safari shows "Add to Calendar"; Android and desktop download it and hand it to the calendar app. */
export function openIcs(ics: string, name = "reminder.ics") {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) {
    window.location.assign(url);
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
