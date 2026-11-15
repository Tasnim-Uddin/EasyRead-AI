/**
 * Where a guide opens from My guides (or Home's recent list): never back at the start if the user had got further.
 * - an explicit step (My guides "Continue") wins;
 * - a guide the user finished opens on "You did it";
 * - otherwise the step they were on (saved per guide id on this phone, extras/guides.ts saveProgress).
 */
export interface SavedProgress {
  step: number;
  total: number;
  done: boolean;
}

export interface ResumeAt {
  screen: "step" | "done";
  index: number;
}

export function resumeTarget(steps: number, progress: SavedProgress | null | undefined, at?: number): ResumeAt {
  const last = Math.max(0, steps - 1);
  const clamp = (i: number) => (Number.isFinite(i) ? Math.max(0, Math.min(last, Math.round(i))) : 0);
  if (steps <= 0) return { screen: "step", index: 0 };
  if (at !== undefined && at !== null && Number.isFinite(at)) return { screen: "step", index: clamp(at) };
  if (!progress) return { screen: "step", index: 0 };
  if (progress.done) return { screen: "done", index: last };
  return { screen: "step", index: clamp(progress.step) };
}
