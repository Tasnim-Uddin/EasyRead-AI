/**
 * Dependency-free paper detector for the live camera outline and the instant first guess on the crop screen
 * (~5-10 ms on a 256 px frame). The server (POST /api/scan, OpenCV) gives the more accurate corners afterwards.
 */
export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt];

export interface Pixels {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}
export interface Detection {
  /** Corners TL, TR, BR, BL in source pixels (the whole frame when not found). */
  corners: Quad;
  found: boolean;
  method: string;
  score: number;
}

export function detectQuad(img: Pixels, work = 256): Detection {
  const { data, width: W, height: H } = img;
  const s = work / Math.max(W, H);
  const w = Math.max(8, Math.round(W * s));
  const h = Math.max(8, Math.round(H * s));
  const g = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // nearest-sample downscale
      const i = (Math.min(H - 1, Math.floor(y / s)) * W + Math.min(W - 1, Math.floor(x / s))) * 4;
      const r = data[i], gg = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      g[y * w + x] = 0.299 * r + 0.587 * gg + 0.114 * b;
      sat[y * w + x] = mx ? (mx - mn) / mx : 0;
    }
  const gb = boxBlur(boxBlur(g, w, h, 2), w, h, 2);
  const t = otsu(gb);
  const masks: [string, Uint8Array][] = [];
  const m1 = new Uint8Array(w * h);
  for (let i = 0; i < m1.length; i++) m1[i] = gb[i] > t ? 1 : 0;
  masks.push(["otsu", m1]);
  const sorted = Float32Array.from(gb).sort();
  const p40 = sorted[Math.floor(sorted.length * 0.4)];
  const m2 = new Uint8Array(w * h);
  for (let i = 0; i < m2.length; i++) m2[i] = sat[i] < 0.24 && gb[i] > p40 ? 1 : 0;
  masks.push(["white", m2]);
  let best: { score: number; q: Pt[]; name: string } | null = null;
  for (const [name, m0] of masks) {
    const m = morph(morph(m0, w, h, 3, true), w, h, 3, false); // close small gaps (text on paper)
    const { pts, area } = largestComponent(m, w, h);
    if (area < 0.15 * w * h || area > 0.98 * w * h) continue;
    const q = maxQuad(simplify(convexHull(pts), 40));
    if (!plausible(order(q))) continue;
    const qa = polyArea(q);
    const fill = area / Math.max(qa, 1);
    const onFrame = q.filter(([x, y]) => x < 2 || y < 2 || x > w - 3 || y > h - 3).length;
    let score = (qa / (w * h)) * Math.min(fill, 1 / fill) ** 2;
    if (onFrame >= 2) score *= 0.25;
    if (!best || score > best.score) best = { score, q, name };
  }
  if (!best) return { corners: [[0, 0], [W, 0], [W, H], [0, H]], found: false, method: "fallback_full", score: 0 };
  return { corners: order(best.q.map(([x, y]) => [(x + 0.5) / s, (y + 0.5) / s] as Pt)), found: true, method: best.name, score: best.score };
}

function boxBlur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const o = new Float32Array(a.length);
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let acc = 0, n = 0;
    for (let x = -r; x < w; x++) {
      if (x + r < w) { acc += a[y * w + x + r]; n++; }
      if (x - r - 1 >= 0) { acc -= a[y * w + x - r - 1]; n--; }
      if (x >= 0) tmp[y * w + x] = acc / n;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0, n = 0;
    for (let y = -r; y < h; y++) {
      if (y + r < h) { acc += tmp[(y + r) * w + x]; n++; }
      if (y - r - 1 >= 0) { acc -= tmp[(y - r - 1) * w + x]; n--; }
      if (y >= 0) o[y * w + x] = acc / n;
    }
  }
  return o;
}

function otsu(a: Float32Array): number {
  const hist = new Float64Array(256);
  for (const v of a) hist[Math.min(255, v | 0)]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, t = 128;
  const N = a.length;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = N - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; t = i; }
  }
  return t;
}

function morph(m: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  let a = m;
  for (let k = 0; k < r; k++) {
    const o = new Uint8Array(a.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = dilate ? 0 : 1;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            const p = yy < 0 || yy >= h || xx < 0 || xx >= w ? (dilate ? 0 : 1) : a[yy * w + xx];
            if (dilate) v |= p;
            else v &= p;
          }
        o[y * w + x] = v;
      }
    a = o;
  }
  return a;
}

function largestComponent(m: Uint8Array, w: number, h: number): { pts: Pt[]; area: number } {
  const lab = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = { area: 0, id: 0 };
  let id = 0;
  for (let i = 0; i < m.length; i++)
    if (m[i] && !lab[i]) {
      id++;
      let sp = 0, area = 0;
      stack[sp++] = i;
      lab[i] = id;
      while (sp) {
        const p = stack[--sp];
        area++;
        const x = p % w, y = (p / w) | 0;
        if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      if (area > best.area) best = { area, id };
    }
  const pts: Pt[] = []; // row extremes are enough for a hull
  for (let y = 0; y < h; y++) {
    let lo = -1, hi = -1;
    for (let x = 0; x < w; x++)
      if (lab[y * w + x] === best.id) {
        if (lo < 0) lo = x;
        hi = x;
      }
    if (lo >= 0) pts.push([lo, y], [hi + 1, y], [lo, y + 1], [hi + 1, y + 1]);
  }
  return { pts, area: best.area };
}

function convexHull(input: Pt[]): Pt[] {
  const p = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function simplify(hull: Pt[], n: number): Pt[] {
  if (hull.length <= n) return hull;
  const st = hull.length / n;
  return Array.from({ length: n }, (_, i) => hull[Math.floor(i * st)]);
}

export function polyArea(q: Pt[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % q.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function maxQuad(hp: Pt[]): Pt[] {
  const n = hp.length;
  let best: Pt[] | null = null, ba = -1;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const q = [hp[a], hp[b], hp[c], hp[d]];
          const ar = polyArea(q);
          if (ar > ba) { ba = ar; best = q; }
        }
  return best ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
}

/** 4 points -> TL, TR, BR, BL. */
export function order(p: Pt[]): Quad {
  const s = p.map(([x, y]) => x + y), d = p.map(([x, y]) => y - x);
  const im = (arr: number[], f: (...v: number[]) => number) => arr.indexOf(f(...arr));
  return [p[im(s, Math.min)], p[im(d, Math.min)], p[im(s, Math.max)], p[im(d, Math.max)]];
}

/** Roughly a rectangle seen at an angle: corner angles 45-135 degrees, opposite sides within 2x. */
export function plausible(q: Pt[]): boolean {
  const ang: number[] = [], L: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
    const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const n1 = Math.hypot(v1[0], v1[1]), n2 = Math.hypot(v2[0], v2[1]);
    ang.push((Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2 + 1e-6)))) * 180) / Math.PI);
    L.push(n2);
  }
  const r = Math.min(L[0] / L[2], L[2] / L[0], L[1] / L[3], L[3] / L[1]);
  return Math.min(...ang) >= 45 && Math.max(...ang) <= 135 && r >= 0.5;
}
