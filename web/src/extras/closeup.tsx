import type { ComponentType } from "react";

// The close-up library (web/src/closeups) is optional here: when it is present its CloseUp is used,
// otherwise the step picture or an icon. import.meta.glob returns {} when the folder does not exist.
type Mod = { CloseUp?: ComponentType<{ id: string; lang?: string }>; hasCloseUp?: (id: string) => boolean };
const mods = import.meta.glob<Mod>("../closeups/index.{ts,tsx}", { eager: true });
const mod: Mod = Object.values(mods)[0] ?? {};

export function closeUpFor(id: string | null | undefined): ComponentType<{ id: string; lang?: string }> | null {
  if (!id || !mod.CloseUp) return null;
  if (mod.hasCloseUp && !mod.hasCloseUp(id)) return null;
  return mod.CloseUp;
}
