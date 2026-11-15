/** Small pure helpers for corner quads (normalised 0-1, TL, TR, BR, BL). Tested in quad.test.ts. */
import type { Pt, Quad } from "./detect";

export const FULL: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function normalise(q: Pt[], w: number, h: number): Quad {
  return q.map(([x, y]) => [clamp01(x / w), clamp01(y / h)]) as Quad;
}

/** Largest corner move between two quads (normalised units). */
export function maxShift(a: Quad, b: Quad): number {
  let m = 0;
  for (let i = 0; i < 4; i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return m;
}

/** True when the quad is (almost) the whole photo. */
export const isFull = (q: Quad, tol = 0.01) => maxShift(q, FULL) < tol;

/** The quad after turning the photo 90 degrees clockwise (corners stay TL, TR, BR, BL of the new photo). */
export function rotateCw(q: Quad): Quad {
  // A point (x, y) moves to (1 - y, x); the old BL becomes the new TL.
  const r = q.map(([x, y]) => [1 - y, x] as Pt);
  return [r[3], r[0], r[1], r[2]];
}

/** Moves one corner, kept inside the photo. */
export function moveCorner(q: Quad, i: number, p: Pt): Quad {
  const n = q.map((c) => [...c] as Pt) as Quad;
  n[i] = [clamp01(p[0]), clamp01(p[1])];
  return n;
}

/** A convex, non-tiny quad: something a page can be flattened from. */
export function usable(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-9) return false;
    const s = Math.sign(cr);
    if (sign && s !== sign) return false;
    sign = s;
  }
  let a = 0;
  for (let i = 0; i < 4; i++) a += q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1];
  return Math.abs(a) / 2 > 0.02;
}

/**
 * Stability tracker for auto-capture and the "Got it! Hold still." state: stable once the quad has moved less
 * than `tol` for `ms` milliseconds.
 */
export class Steady {
  private last: Quad | null = null;
  private since = 0;
  private tol: number;
  private ms: number;
  constructor(tol = 0.02, ms = 600) {
    this.tol = tol;
    this.ms = ms;
  }
  push(q: Quad | null, now: number): boolean {
    if (!q) {
      this.last = null;
      return false;
    }
    if (!this.last || maxShift(q, this.last) > this.tol) {
      this.last = q;
      this.since = now;
      return false;
    }
    return now - this.since >= this.ms;
  }
  reset() {
    this.last = null;
  }
}
