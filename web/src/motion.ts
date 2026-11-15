/**
 * Shared animation tokens, matching the Figma prototype. The same values live as CSS custom properties in
 * styles.css (--ease-out, --dur-morph, ...), so CSS and JS animations stay in step.
 */

/** Ease-out used for every transition in the prototype. */
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Durations in milliseconds. */
export const DURATION = {
  /** A shape changing into another (for example a card growing into a screen). */
  morph: 400,
  /** A screen or sheet sliding in or out. */
  slide: 350,
  /** One cycle of a looping shake (for example the "shake your inhaler" hint). */
  loopShake: 700,
  /** A press-and-hold cue. */
  press: 750,
  /** A highlight pulse on something the guide points at. */
  highlight: 900,
} as const;

export type MotionToken = keyof typeof DURATION;

/** The CSS custom property for each duration token. */
export const DURATION_VAR: Record<MotionToken, string> = {
  morph: "--dur-morph",
  slide: "--dur-slide",
  loopShake: "--dur-loop-shake",
  press: "--dur-press",
  highlight: "--dur-highlight",
};

/** True when the user asked for less motion: loops should not run. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
