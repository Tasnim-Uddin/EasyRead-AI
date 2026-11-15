// Tiny event bus so any screen (the guide stage, the finish screen) can open the extras without new props.
import type { Guide } from "../types";

type Events = {
  remind: { guide: Guide; dateIndex: number };
  share: { guide: Guide };
  language: Record<string, never>;
  privacy: Record<string, never>;
};
const target = typeof window !== "undefined" ? new EventTarget() : null;

export function emit<K extends keyof Events>(name: K, detail: Events[K]) {
  target?.dispatchEvent(new CustomEvent(name, { detail }));
}
export function on<K extends keyof Events>(name: K, fn: (d: Events[K]) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<Events[K]>).detail);
  target?.addEventListener(name, h);
  return () => target?.removeEventListener(name, h);
}

/** Open the Remind me sheet for `guide.dates[dateIndex]` (or the date derived from content.by_when). */
export const openRemindMe = (guide: Guide, dateIndex = 0) => emit("remind", { guide, dateIndex });
/** Open Save or share for this guide. */
export const openShare = (guide: Guide) => emit("share", { guide });
/** Open the full-screen language picker. */
export const openLanguagePicker = () => emit("language", {});
/** Open Your papers are private. */
export const openPrivacy = () => emit("privacy", {});
