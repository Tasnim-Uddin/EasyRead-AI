/**
 * The guide stage as a small pure state machine (no React, no audio), so every move is testable.
 *
 * intro    big avatar, "Yes, let's start"
 * step     the step's visual fills the stage, the avatar stays a small circle in the corner the whole time;
 *          she narrates the step and stops (no check-in). Back / Next / Speak / Type are always on screen.
 * ask      the user is asking (by voice or by typing)
 * answer   her answer, with "From your paper" (or who to ask), and Back to the step (she stays the circle)
 * finish   "You did it"
 */
export type Phase = "intro" | "step" | "ask" | "answer" | "finish";
export type AskMode = "voice" | "type";

export interface StageState {
  phase: Phase;
  index: number;
  total: number;
  /** How the current step arrived: forward slides in from the end side, back from the start side. */
  dir: "fwd" | "back" | "none";
  askMode: AskMode;
  question: string;
  /** null while waiting for the answer. */
  answer: string | null;
  grounded: boolean | null;
  askWho: string | null;
  /** The phase to go back to after asking (a question can be asked from intro, step or finish). */
  askFrom: "intro" | "step" | "finish";
}

export type StageEvent =
  | { type: "start" }
  | { type: "next" }
  | { type: "back" }
  | { type: "jump"; index: number }
  | { type: "sync"; index: number } // the index changed from outside (the avatar called a step tool)
  | { type: "ask"; mode: AskMode }
  | { type: "asked"; question: string }
  | { type: "answered"; answer: string; grounded?: boolean | null; askWho?: string | null }
  | { type: "backToStep" }
  | { type: "restart" }
  | { type: "finish" } // the app opened "You did it" directly (a finished guide, or browser Forward)
  | { type: "total"; total: number };

export function initialStage(total: number, index = 0, phase: Phase = "intro"): StageState {
  return {
    phase,
    index: clamp(index, total),
    total,
    dir: "none",
    askMode: "type",
    question: "",
    answer: null,
    grounded: null,
    askWho: null,
    askFrom: "intro",
  };
}

function clamp(i: number, total: number) {
  if (!Number.isFinite(i) || total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(i)));
}

const clearAsk = { question: "", answer: null, grounded: null, askWho: null } as const;

function toStep(s: StageState, index: number): StageState {
  const to = clamp(index, s.total);
  const dir = to < s.index ? "back" : to > s.index ? "fwd" : "none";
  return { ...s, ...clearAsk, phase: "step", index: to, dir };
}

export function stageReducer(s: StageState, e: StageEvent): StageState {
  switch (e.type) {
    case "total":
      return { ...s, total: e.total, index: clamp(s.index, e.total) };
    case "start":
      return { ...toStep(s, s.index), dir: "none" };
    case "next":
      if (s.index >= s.total - 1) return { ...s, ...clearAsk, phase: "finish", dir: "none" };
      return toStep(s, s.index + 1);
    case "back":
      if (s.phase === "intro") return s;
      if (s.phase === "finish") return toStep({ ...s, index: s.total }, s.total - 1);
      return s.index <= 0 ? toStep(s, 0) : toStep(s, s.index - 1);
    case "jump":
      return toStep(s, e.index);
    case "sync":
      if (clamp(e.index, s.total) === s.index && s.phase !== "intro" && s.phase !== "finish") return s;
      return toStep(s, e.index);
    case "ask": {
      const from = s.phase === "ask" || s.phase === "answer" ? s.askFrom : (s.phase as StageState["askFrom"]);
      return { ...s, ...clearAsk, phase: "ask", askMode: e.mode, askFrom: from };
    }
    case "asked":
      return { ...s, phase: "answer", question: e.question.trim(), answer: null, grounded: null, askWho: null };
    case "answered":
      if (s.phase !== "answer" && s.phase !== "ask") return s;
      return { ...s, phase: "answer", answer: e.answer, grounded: e.grounded ?? null, askWho: e.askWho ?? null };
    default:
      return s;
    case "backToStep":
      return { ...s, ...clearAsk, phase: s.askFrom, dir: "none" };
    case "restart":
      return { ...initialStage(s.total, 0, "step") };
    case "finish":
      return { ...s, ...clearAsk, phase: "finish", index: clamp(s.total - 1, s.total), dir: "none" };
  }
}

/** True when the avatar should be the big picture (not the small circle): only before the steps start and at the end.
 *  Through every step, question and answer she stays in the corner so the step picture stays visible. */
export function avatarBig(phase: Phase): boolean {
  return phase === "intro" || phase === "finish";
}

/** The last ~`max` characters of a running caption, cut at a word. */
export function tailCaption(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return "…" + t.slice(-max).replace(/^\S*\s/, "");
}

/** Who to ask when the paper does not answer: the sender's name, else a plain phrase. */
/** The server's "nobody named" fallbacks (agent/qa.py WHO.unknown, the persona's line): not a name to show. */
const GENERIC_WHO = new Set(
  ["whoever sent it", "whoever sent them this paper", "quien se lo envió", "من أرسلها", "جس نے یہ بھیجا", "nadawcę", "যে পাঠিয়েছে তাকে"].map((s) => s.toLowerCase()),
);

/** A sender name short enough for the chip (same rule as agent/qa.py short_name). */
export function shortName(name: string, limit = 48): string {
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length <= limit) return n;
  const head = n.split(/\s*(?:,|\(|;| - | – | — )\s*/)[0].trim();
  if (head.length > 2 && head.length <= limit) return head;
  const cut = n.slice(0, limit);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;\-–—]+$/, "") || cut;
}

/** Who to ask when the paper has no answer: the /ask result's ask_who, else the paper's sender, else null
 *  (the UI then says "whoever sent it"). A generic "whoever sent it" from the server never hides a real sender. */
export function whoToAsk(sender: { name?: string | null } | null | undefined, askWho?: string | null): string | null {
  const a = (askWho ?? "").trim();
  if (a && !GENERIC_WHO.has(a.toLowerCase())) return a;
  const n = (sender?.name ?? "").trim();
  return n ? shortName(n) : null;
}
