// Run with `npm test` (node --test, Node 22.6+ strips the types). Pure logic only: no DOM, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectQuad, type Quad } from "../src/camera/detect.ts";
import { FULL, Steady, isFull, maxShift, moveCorner, rotateCw, usable } from "../src/camera/quad.ts";

/** A white page (with dark text bars) at `corners` on a brown table, as RGBA pixels. */
function photo(W: number, H: number, corners: Quad) {
  const data = new Uint8ClampedArray(W * H * 4);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4];
      const s = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      if (s && sign && s !== sign) return false;
      if (s) sign = s;
    }
    return true;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const page = inside(x, y);
      const text = page && y % 24 < 5 && x % 50 < 38;
      const v = page ? (text ? [40, 35, 30] : [245, 244, 240]) : [125, 90, 60];
      data[o] = v[0]; data[o + 1] = v[1]; data[o + 2] = v[2]; data[o + 3] = 255;
    }
  return { data, width: W, height: H };
}

test("finds a skewed page within 2% of the diagonal", () => {
  const W = 640, H = 480;
  const corners: Quad = [[170, 60], [460, 85], [485, 430], [145, 410]];
  const r = detectQuad(photo(W, H, corners));
  assert.equal(r.found, true);
  const err = Math.max(...r.corners.map((c, i) => Math.hypot(c[0] - corners[i][0], c[1] - corners[i][1])));
  assert.ok(err < 0.02 * Math.hypot(W, H), `corner error ${err}`);
});

test("an empty table is not a paper", () => {
  const W = 320, H = 240;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 125; data[i + 1] = 90; data[i + 2] = 60; data[i + 3] = 255; }
  const r = detectQuad({ data, width: W, height: H });
  assert.equal(r.found, false);
  assert.deepEqual(r.corners, [[0, 0], [W, 0], [W, H], [0, H]]);
});

test("rotating four times gives the same quad back", () => {
  const q: Quad = [[0.1, 0.2], [0.8, 0.15], [0.9, 0.85], [0.2, 0.9]];
  let r = q;
  for (let i = 0; i < 4; i++) r = rotateCw(r);
  assert.ok(maxShift(q, r) < 1e-9);
  // One turn: the old bottom-left corner is now the top-left one.
  const once = rotateCw(q);
  assert.deepEqual(once[0], [1 - 0.9, 0.2]);
  assert.ok(usable(once));
});

test("full photo, moving corners and usable quads", () => {
  assert.ok(isFull(FULL));
  const moved = moveCorner(FULL, 2, [1.4, 0.7]);
  assert.deepEqual(moved[2], [1, 0.7]);
  assert.ok(!isFull(moved));
  assert.ok(usable(FULL));
  assert.ok(!usable([[0, 0], [1, 1], [1, 0], [0, 1]])); // crossed
  assert.ok(!usable([[0.5, 0.5], [0.51, 0.5], [0.51, 0.51], [0.5, 0.51]])); // tiny
});

test("steady only after the quad holds still for 600 ms", () => {
  const s = new Steady(0.02, 600);
  const q: Quad = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];
  assert.equal(s.push(q, 0), false);
  assert.equal(s.push(moveCorner(q, 0, [0.105, 0.1]), 300), false);
  assert.equal(s.push(q, 650), true);
  assert.equal(s.push(moveCorner(q, 0, [0.2, 0.1]), 700), false); // moved: start again
  assert.equal(s.push(null, 800), false);
});
