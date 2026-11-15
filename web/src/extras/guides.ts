// My guides: pure helpers (filter chips, date groups, search) and the per-guide progress kept on this device.
import type { Guide, GuideStatus } from "../types";

/** One row of My guides. Extra fields are optional: the list endpoint may not send them yet, the device cache fills them. */
export interface GuideRow {
  id: string;
  title: string;
  title_override?: string | null;
  language: string;
  doc_type: string;
  domain?: string | null;
  created_at: string | null;
  status: GuideStatus;
  thumbnail: string | null;
  /** The user's own paper (first photo), when known. */
  paper?: string | null;
  steps?: number;
}

export type ChipKey = "medicine" | "howto" | "letter" | "bill" | "form" | "other";
export const CHIP_ORDER: ChipKey[] = ["medicine", "letter", "bill", "form", "howto", "other"];
export const CHIP_ICON: Record<ChipKey | "all", string> = {
  all: "list",
  medicine: "pill",
  howto: "wrench",
  letter: "mail",
  bill: "receipt",
  form: "pen",
  other: "file",
};

export function chipKey(r: { doc_type?: string | null; domain?: string | null }): ChipKey {
  const dt = r.doc_type || "how_to";
  if (dt === "how_to") return r.domain === "medicine" ? "medicine" : "howto";
  if (dt === "letter" || dt === "bill" || dt === "form") return dt;
  return "other";
}

/** "All" first, then the types this user actually has, most first. None when there is only one type. */
export function buildChips(rows: { doc_type?: string | null; domain?: string | null }[]): { key: ChipKey | "all"; count: number }[] {
  const counts = new Map<ChipKey, number>();
  for (const r of rows) counts.set(chipKey(r), (counts.get(chipKey(r)) ?? 0) + 1);
  if (counts.size < 2) return [];
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1] || CHIP_ORDER.indexOf(a[0]) - CHIP_ORDER.indexOf(b[0]));
  return [{ key: "all", count: rows.length }, ...types.map(([key, count]) => ({ key, count }))];
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export type Group = "today" | "thisWeek" | "earlier";

export function groupOf(iso: string | null, now = new Date()): Group {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "earlier";
  const age = startOfDay(now) - startOfDay(d);
  return age <= 0 ? "today" : age < 7 * DAY ? "thisWeek" : "earlier";
}

/** Today / This week / Earlier, each newest first; empty groups are left out. */
export function groupRows<T extends { created_at: string | null }>(rows: T[], now = new Date()): { key: Group; rows: T[] }[] {
  const time = (r: T) => (r.created_at ? new Date(r.created_at).getTime() || 0 : 0);
  const sorted = [...rows].sort((a, b) => time(b) - time(a));
  return (["today", "thisWeek", "earlier"] as Group[])
    .map((key) => ({ key, rows: sorted.filter((r) => groupOf(r.created_at, now) === key) }))
    .filter((g) => g.rows.length > 0);
}

export const rowTitle = (r: { title: string; title_override?: string | null }) => (r.title_override || r.title || "").trim();

export function matches(r: GuideRow, q: string): boolean {
  const n = q.normalize("NFC").trim().toLowerCase();
  return !n || rowTitle(r).normalize("NFC").toLowerCase().includes(n);
}

/* ---- this device only: last step per guide, and a small cache of what the list endpoint does not send ---- */
export interface Progress {
  step: number; // 0-based
  total: number;
  done: boolean;
  at: number; // ms
}
const PKEY = "er.progress";
const MKEY = "er.guideMeta";

function read<T>(key: string): Record<string, T> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: lasts for this visit only */
  }
}

export const allProgress = () => read<Progress>(PKEY);
export function getProgress(id: string): Progress | null {
  return allProgress()[id] ?? null;
}
export function saveProgress(id: string, step: number, total: number, done = false) {
  if (!id || total <= 0) return;
  const all = allProgress();
  const was = all[id];
  all[id] = { step, total, done: done || (!!was?.done && step >= total - 1), at: Date.now() };
  write(PKEY, all);
}
export function forgetProgress(id: string) {
  const all = allProgress();
  delete all[id];
  write(PKEY, all);
  const meta = read<Partial<GuideRow>>(MKEY);
  delete meta[id];
  write(MKEY, meta);
}

/** Remember what the list endpoint may not send (type, own photo, step count, own title). */
export function rememberMeta(g: Guide, paper?: string | null) {
  const meta = read<Partial<GuideRow>>(MKEY);
  meta[g.id] = { ...meta[g.id], doc_type: g.doc_type ?? "how_to", domain: g.domain ?? null, steps: g.steps.length, paper: paper ?? meta[g.id]?.paper ?? null };
  if (g.title_override !== undefined) meta[g.id]!.title_override = g.title_override;
  write(MKEY, meta);
}
export function setMetaTitle(id: string, title: string | null) {
  const meta = read<Partial<GuideRow>>(MKEY);
  meta[id] = { ...meta[id], title_override: title };
  write(MKEY, meta);
}
/** Server row + cached extras (server fields win when present). */
export function withMeta(r: GuideRow): GuideRow {
  const m = read<Partial<GuideRow>>(MKEY)[r.id] ?? {};
  return {
    ...r,
    domain: r.domain ?? m.domain ?? null,
    title_override: m.title_override ?? r.title_override ?? null,
    steps: r.steps ?? m.steps,
    paper: r.paper ?? m.paper ?? null,
  };
}

/** The most recently used guide that is not finished, if any. */
export function continueRow<T extends { id: string; status: GuideStatus }>(rows: T[], progress = allProgress()): T | null {
  let best: T | null = null;
  let at = -1;
  for (const r of rows) {
    const p = progress[r.id];
    if (r.status === "ready" && p && !p.done && p.at > at) {
      best = r;
      at = p.at;
    }
  }
  return best;
}
