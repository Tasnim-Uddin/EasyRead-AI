// The one-page summary used by Share, Print and Save as PDF.
import type { Guide } from "../types";
import { datesFor } from "./ics";
import { kindOf } from "./questions";

export interface SheetData {
  title: string;
  steps: string[];
  amount: { label: string; value: string } | null;
  date: { label: string; value: string; iso: string | null } | null;
  sender: string | null;
  made: string | null;
}

/** Title shown everywhere: the user's own name first. */
export function guideTitle(g: Guide, english = false): string {
  if (g.title_override) return g.title_override;
  const f = g.facts;
  const c = g.content;
  const k = kindOf(g);
  if (english && g.summary_line_en && k !== "medicine") return g.summary_line_en;
  // content.what_this_is is English only: in another language the translated short title wins.
  const otherLang = !english && (g.language ?? "en") !== "en" && !!g.title;
  if (k === "letter" && c?.what_this_is && !otherLang) return c.what_this_is;
  return (english ? g.title_en : g.title) || (f?.medicine ?? f?.title ?? c?.what_this_is ?? g.steps[0]?.text ?? "");
}

const monthNames = (lang: string, m: number): string[] => {
  const out: string[] = [];
  for (const style of ["long", "short"] as const) {
    for (const l of [lang, "en"]) {
      try {
        out.push(new Intl.DateTimeFormat(l, { month: style }).format(new Date(2026, m - 1, 15)).replace(/\.$/, "").toLowerCase());
      } catch {
        /* unknown locale */
      }
    }
  }
  return out.filter((x) => x.length >= 3);
};

/** True when the text already names this calendar day (same day number and month), in the guide's language or English. */
export function mentionsDate(text: string, iso: string, lang = "en"): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const low = text.toLowerCase();
  const d = `0?${day}(?:st|nd|rd|th)?`;
  if (new RegExp(`(?:^|\\D)0?${day}\\s*[/.-]\\s*0?${month}(?:\\D|$)`).test(low)) return true;
  return monthNames(lang, month).some((n) => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<!\\d)${d}(?!\\d)[^\\d\\n]{0,6}${esc}|${esc}[^\\d\\n]{0,6}(?<!\\d)${d}(?!\\d)`, "u").test(low);
  });
}

/** Dated actions that no step already mentions, so "What to do" never says the same thing twice. */
export function undatedGaps<T extends { date: string }>(steps: string[], dated: T[], lang = "en"): T[] {
  return dated.filter((d) => !steps.some((s) => mentionsDate(s, d.date, lang)));
}

/** `english`: use the English copy of every line the guide has one for (step.text_en, what_en). */
export function sheetData(g: Guide, english = false, lang = "en"): SheetData {
  const txt = (s: { text: string; text_en: string }) => (english ? s.text_en || s.text : s.text);
  const key = g.steps.filter((s) => s.kind === "how" || s.kind === "when" || s.kind === "warning");
  const steps = (key.length ? key : g.steps).slice(0, 8).map(txt);
  const allDated = datesFor(g);
  const dated = allDated[0] ?? null;
  // Other dated actions join the list as "date: what", unless a step already names that day.
  const L = english ? "en" : lang;
  for (const d of undatedGaps(steps, allDated.slice(1), L)) {
    let day = d.date;
    try {
      day = new Intl.DateTimeFormat(L, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d.date}T12:00:00`));
    } catch {
      /* keep ISO */
    }
    steps.push(`${day}: ${english ? d.what_en || d.what : d.what}`);
  }
  const amt = g.content?.amounts?.[0];
  // content.amounts / by_when labels are English only: in another language the sheet shows its own translated label.
  const enLabels = english || (g.language ?? "en") === "en";
  const call = g.steps.find((s) => s.callout?.value)?.callout ?? null;
  const amount = dated?.amount
    ? { label: english ? dated.what_en : dated.what, value: dated.amount }
    : amt
    ? { label: enLabels ? amt.what : "", value: amt.amount }
    : call && /[£$€¥₹]|\d/.test(call.value) && !dated
    ? { label: call.sub ?? "", value: call.value }
    : null;
  const by = g.content?.by_when?.[0];
  const date = dated
    ? { label: english ? dated.what_en || dated.what : dated.what, value: dated.quote || dated.date, iso: dated.date }
    : by
    ? { label: enLabels ? by.what : "", value: by.date, iso: null } // a printed date we could not read as a calendar date: shown as printed
    : null;
  const sender = g.sender ? [g.sender.name, g.sender.contact].filter(Boolean).join(" · ") : null;
  return { title: guideTitle(g, english), steps, amount, date, sender, made: g.created_at ?? null };
}
