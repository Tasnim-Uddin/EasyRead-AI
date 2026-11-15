/**
 * The app's screen history: a real stack of the screens the user went through, kept in step with the
 * browser's own history (each entry's state carries its depth), so the top-left back arrow, the browser's
 * Back button and the Android back gesture all land on the same previous screen.
 *
 * Pure (no window, no React) so every move is testable; App.tsx mirrors it into history.pushState.
 */
export interface ScreenHistory<S extends string> {
  /** Every entry, oldest first. Entries after `at` are the "forward" ones (browser Forward). */
  stack: S[];
  /** The entry on screen now. */
  at: number;
}

export function createHistory<S extends string>(first: S): ScreenHistory<S> {
  return { stack: [first], at: 0 };
}

export const current = <S extends string>(h: ScreenHistory<S>): S => h.stack[h.at];
export const canGoBack = <S extends string>(h: ScreenHistory<S>): boolean => h.at > 0;
export const previous = <S extends string>(h: ScreenHistory<S>): S | null => (h.at > 0 ? h.stack[h.at - 1] : null);

/** A new screen on top (drops any forward entries, like the browser does). Going to the screen already on top changes nothing. */
export function push<S extends string>(h: ScreenHistory<S>, s: S): ScreenHistory<S> {
  if (current(h) === s) return h;
  return { stack: [...h.stack.slice(0, h.at + 1), s], at: h.at + 1 };
}

/** Swap the screen on top (loading -> guide, camera -> corners): Back never lands on the replaced one. */
export function replace<S extends string>(h: ScreenHistory<S>, s: S): ScreenHistory<S> {
  const stack = h.stack.slice(0, h.at + 1);
  stack[h.at] = s;
  return { stack, at: h.at };
}

/** One step back. The first screen has nothing behind it: the caller goes Home instead. */
export function back<S extends string>(h: ScreenHistory<S>): ScreenHistory<S> {
  return canGoBack(h) ? { ...h, at: h.at - 1 } : h;
}

/**
 * The browser moved to the entry at `depth` (Back, Forward, or the Android gesture). The entry's own screen
 * is kept when the stack does not know it (a reload keeps history.state but not this stack).
 */
export function moveTo<S extends string>(h: ScreenHistory<S>, depth: number, screen: S): ScreenHistory<S> {
  const d = Math.max(0, Math.floor(Number.isFinite(depth) ? depth : 0));
  if (d < h.stack.length) {
    const stack = h.stack[d] === screen ? h.stack : [...h.stack.slice(0, d), screen, ...h.stack.slice(d + 1)];
    return { stack, at: d };
  }
  // Deeper than we know: pad with the screen itself so depths stay aligned with the browser.
  const stack = [...h.stack];
  while (stack.length < d) stack.push(screen);
  stack.push(screen);
  return { stack, at: d };
}

/** What a "back" press should do: pop to the previous entry, or (nothing behind) replace with Home. */
export function backAction<S extends string>(h: ScreenHistory<S>, home: S): { kind: "pop" } | { kind: "replace"; screen: S } {
  return canGoBack(h) ? { kind: "pop" } : { kind: "replace", screen: home };
}
