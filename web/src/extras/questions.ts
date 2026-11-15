// Check I've got it: 2-3 simple picture questions built only from the guide's own words (any kind of paper).
import type { Guide } from "../types";
import { t, tf } from "../i18n";
import "./strings";

export type Kind = "medicine" | "howto" | "letter" | "form";
export function kindOf(g: Guide): Kind {
  const dt = g.doc_type ?? "how_to";
  if (dt === "form") return "form";
  if (dt !== "how_to") return "letter";
  return g.domain === "medicine" || (!g.domain && !!g.facts?.medicine) ? "medicine" : "howto";
}

export interface Question {
  q: string;
  options: string[];
  /** One picture per option (icon names), so the answer can be found without reading. */
  icons: string[];
  correct: number;
  /** The step that holds the answer, to show again after "Not quite". */
  step: number | null;
}

const cap = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The step whose words contain `text` (or the other way round). */
export function stepFor(g: Guide, text: string): number | null {
  const n = norm(text);
  if (!n) return null;
  const s = g.steps.find((x) => norm(x.text).includes(n) || (norm(x.text).length > 8 && n.includes(norm(x.text))));
  return s ? s.index : null;
}

export function buildQuestions(g: Guide, lang = "en"): Question[] {
  const T = (key: string) => t(lang, key);
  const k = kindOf(g);
  const out: Question[] = [];
  const seen = new Set<string>();
  const mk = (q: string, correct: string, correctIcon: string, wrong: [string, string][], pos: number, step: number | null) => {
    if (!correct || seen.has(norm(correct))) return;
    seen.add(norm(correct));
    const opts: [string, string][] = wrong.filter(([w]) => norm(w) !== norm(correct)).map(([w, i]) => [cap(w), i]);
    const at = Math.min(pos, opts.length);
    opts.splice(at, 0, [cap(correct), correctIcon]);
    out.push({ q, options: opts.map((o) => o[0]), icons: opts.map((o) => o[1]), correct: at, step });
  };
  const f = g.facts;
  const c = g.content;
  const firstHow = g.steps.find((s) => s.kind === "how");

  if (k === "medicine") {
    if ((f?.conflicts?.length ?? 0) > 0) mk(T("qConflict"), T("aPharm"), "chat", [[T("dBigger"), "plus"], [T("dPick"), "hand"]], 1, null);
    if (f?.frequency) mk(T("qWhen"), f.frequency, "clock", [[T("dMorning"), "sun"], [T("dNight"), "moon"]], 1, stepFor(g, f.frequency));
    if (f?.dose) mk(T("qHowMuch"), f.dose, "pill", [[T("dAsMuch"), "plus"], [T("dHalf"), "half"]], 0, stepFor(g, f.dose));
  }
  if (k === "letter") {
    const todo = c?.what_to_do?.[0] ?? firstHow?.text;
    if (todo) mk(T("qLetterFirst"), todo, "check", [[T("dIgnoreLetter"), "x"], [T("dThrow"), "trash"]], 1, stepFor(g, todo) ?? firstHow?.index ?? null);
    const by = c?.by_when?.[0];
    const dated = g.dates?.[0];
    if (by) mk(tf(lang, "qByWhen", { what: by.what }), by.date, "calendar", [[T("dNoDate"), "x"], [T("dNextYear"), "calendar"]], 2, stepFor(g, by.date));
    else if (dated) mk(tf(lang, "qByWhen", { what: dated.what }), dated.quote || dated.date, "calendar", [[T("dNoDate"), "x"], [T("dNextYear"), "calendar"]], 2, stepFor(g, dated.quote));
    const amt = c?.amounts?.[0];
    if (amt) mk(tf(lang, "qAmount", { what: amt.what }), amt.amount, "coin", [[T("dNoPay"), "x"], [T("dAnyAmount"), "hand"]], 0, stepFor(g, amt.amount));
  }
  if (k === "form" && c?.fields?.[0]) mk(tf(lang, "qBox", { label: c.fields[0].label }), c.fields[0].what_to_write, "pen", [[T("dEmpty"), "x"], [T("dAnything"), "hand"]], 0, stepFor(g, c.fields[0].label));
  if ((k === "howto" || k === "medicine" || k === "form") && firstHow) mk(T("qHowFirst"), firstHow.text, "check", [[T("dSkip"), "x"], [T("dAskElse"), "hand"]], 1, firstHow.index);
  const warn = g.steps.find((s) => s.kind === "warning");
  if (warn) mk(T("qWarn"), warn.text, "alert", [[T("dNothing"), "x"], [T("dIgnore"), "hand"]], 2, warn.index);
  // Any paper: at least two questions when it has steps to ask about.
  if (out.length < 2) {
    const other = g.steps.find((s) => (s.kind === "how" || s.kind === "when") && !seen.has(norm(s.text)));
    if (other) mk(T("qWhichStep"), other.text, "check", [[T("dSkip"), "x"], [T("dAskElse"), "hand"]], 0, other.index);
  }
  return out.slice(0, 3);
}
