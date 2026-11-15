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
  if (k === "letter" && c?.what_this_is) return c.what_this_is;
  return f?.medicine ?? f?.title ?? c?.what_this_is ?? g.steps[0]?.text ?? "";
}

/** `english`: use the English copy of every line the guide has one for (step.text_en, what_en). */
export function sheetData(g: Guide, english = false): SheetData {
  const txt = (s: { text: string; text_en: string }) => (english ? s.text_en || s.text : s.text);
  const key = g.steps.filter((s) => s.kind === "how" || s.kind === "when" || s.kind === "warning");
  const steps = (key.length ? key : g.steps).slice(0, 8).map(txt);
  const dated = datesFor(g)[0] ?? null;
  const amt = g.content?.amounts?.[0];
  const call = g.steps.find((s) => s.callout?.value)?.callout ?? null;
  const amount = dated?.amount
    ? { label: english ? dated.what_en : dated.what, value: dated.amount }
    : amt
    ? { label: amt.what, value: amt.amount }
    : call && /[£$€¥₹]|\d/.test(call.value) && !dated
    ? { label: call.sub ?? "", value: call.value }
    : null;
  const date = dated ? { label: english ? dated.what_en || dated.what : dated.what, value: dated.quote || dated.date, iso: dated.date } : null;
  const sender = g.sender ? [g.sender.name, g.sender.contact].filter(Boolean).join(" · ") : null;
  return { title: guideTitle(g, english), steps, amount, date, sender, made: g.created_at ?? null };
}
