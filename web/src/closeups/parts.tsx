// Shared drawing pieces for the close-up library. One flat style (see Figma 06a/07a): sand card, cream glow,
// guide skin tones, sage sleeve, no outlines, no text. Coordinates are in the 358 x 380 card space.
import React from "react";

export const C = {
  bg: "#FCEBD6",
  glow: "#FFF6EA",
  paper: "#FFFCF7",
  border: "#F1DFC6",
  bar: "#E6D5BF",
  ink: "#3A2A20",
  muted: "#6B5646",
  orange: "#F5973F",
  softOrange: "#FDE4C9",
  accent: "#E8673F",
  sage: "#DCEBDF",
  sageInk: "#24503A",
  skin: "#B5744A",
  skinDark: "#A8673F",
  skinLine: "#8E5432",
  sleeve: "#93A27A",
  cuff: "#7E8E66",
  lip: "#8C3B2C",
  blue: "#3F78B0",
  blueDark: "#2F5F8E",
  blueDeep: "#1D3F60",
  metal: "#C9CFD6",
  shine: "#E8ECF0",
  steel: "#A9B3BC",
  pen: "#24476B",
  water: "#CFE3F0",
  waterLine: "#9FB4C4",
  red: "#D8432E",
  redDark: "#B5361F",
  green: "#3E9B5C",
};

/** The soft cream circle behind the subject. */
export function Glow({ cx = 179, cy = 205, r = 135 }: { cx?: number; cy?: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={C.glow} />;
}

/** Side-on face (from the Figma press frame), drawn at the card's left edge. `mouth` picks the lips. */
export function Face({ mouth }: { mouth: "mouthpiece" | "open" | "closed" }) {
  return (
    <g transform="translate(0 24)">
      <path d="M0 0H54C58 70 90 140 118 172C132 190 128 204 108 208C100 210 98 220 102 230C114 232 122 240 116 252L118 300C124 312 116 324 106 330C100 340 104 352 110 366C114 380 104 394 86 400H0V0Z" fill={C.skinDark} />
      <path d="M102 200C107.333 202.667 112 202 116 198" stroke={C.skinLine} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 120C33.3333 128 43.3333 128.667 54 122" stroke="#2A1D15" strokeWidth="4" strokeLinecap="round" />
      {mouth === "mouthpiece" && (
        <>
          <path d="M102 230C116 230 126 240 122 256L104 258L102 230Z" fill={C.lip} />
          <path d="M104 296H122C126 312 118 326 104 330V296Z" fill={C.lip} />
        </>
      )}
      {mouth === "open" && (
        <>
          <ellipse cx="113" cy="266" rx="9" ry="12" fill="#4A1F17" />
          <path d="M102 232C116 232 126 240 123 254L104 256L102 232Z" fill={C.lip} />
          <path d="M104 278H122C125 292 118 302 104 306V278Z" fill={C.lip} />
        </>
      )}
      {mouth === "closed" && (
        <>
          <path d="M102 238C114 238 124 246 121 260L103 262Z" fill={C.lip} />
          <path d="M103 262L121 262C123 274 116 284 104 287Z" fill={C.lip} />
        </>
      )}
    </g>
  );
}

/** A writing hand holding a pen; the pen tip is at (0, 0) of the group. */
export function PenHand() {
  return (
    <g transform="rotate(32)">
      <rect x="22" y="-300" width="74" height="200" rx="18" fill={C.sleeve} />
      <rect x="22" y="-118" width="74" height="22" fill={C.cuff} />
      <path d="M-6 -16L0 0L6 -16Z" fill={C.ink} />
      <rect x="-8" y="-118" width="16" height="104" rx="5" fill={C.blue} />
      <rect x="-8" y="-118" width="16" height="20" rx="5" fill={C.blueDark} />
      <ellipse cx="44" cy="-82" rx="44" ry="40" fill={C.skinDark} />
      <ellipse cx="12" cy="-40" rx="17" ry="13" fill={C.skin} />
      <ellipse cx="28" cy="-56" rx="16" ry="13" fill={C.skin} />
      <ellipse cx="-14" cy="-58" rx="12" ry="20" fill={C.skin} transform="rotate(-20 -14 -58)" />
      <path d="M2 -46C6 -42 12 -42 16 -46" stroke={C.skinLine} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** A pointing finger coming in from the lower right; the fingertip is at (0, 0). */
export function PointHand() {
  return (
    <g>
      <path d="M60 120L150 70L190 170L110 220Z" fill={C.sleeve} />
      <ellipse cx="66" cy="98" rx="42" ry="50" fill={C.skinDark} transform="rotate(-30 66 98)" />
      <path d="M8 8L46 72" stroke={C.skin} strokeWidth="26" strokeLinecap="round" />
      <path d="M-2 4C2 0 8 -2 13 0" stroke={C.skinLine} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M52 96C66 92 78 100 86 112" stroke={C.skin} strokeWidth="24" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** A sheet of paper with a few grey "text" bars. */
export function Paper({ x = 54, y = 46, w = 250, h = 300, rot = -2 }: { x?: number; y?: number; w?: number; h?: number; rot?: number }) {
  return (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={C.paper} stroke={C.border} strokeWidth="3" />
    </g>
  );
}

export function Bar({ x, y, w, h = 10, fill = C.bar }: { x: number; y: number; w: number; h?: number; fill?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;
}

/** Phone handset glyph (24 x 24), placed with a transform. */
export const HANDSET =
  "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z";

/** Clock face; hands are separate so they can turn. */
export function ClockFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.paper} stroke={C.muted} strokeWidth={r * 0.08} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const big = i % 3 === 0;
        const r1 = r * (big ? 0.72 : 0.8);
        const r2 = r * 0.88;
        return (
          <line key={i} x1={cx + r1 * Math.sin(a)} y1={cy - r1 * Math.cos(a)} x2={cx + r2 * Math.sin(a)} y2={cy - r2 * Math.cos(a)}
            stroke={big ? C.ink : C.bar} strokeWidth={big ? 5 : 4} strokeLinecap="round" />
        );
      })}
    </g>
  );
}
