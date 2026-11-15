import type { CSSProperties } from "react";

// 3px-stroke line icons from the approved design. Stroke comes from CSS (svg { stroke: currentColor }).
const PATHS: Record<string, { vb: number; d: string; fill?: boolean }> = {
  camera: { vb: 48, d: "M6 15h8l3-5h14l3 5h8v22H6zM24 19a7 7 0 100 14 7 7 0 000-14z" },
  upload: { vb: 32, d: "M16 22V6M9 12l7-7 7 7M5 27h22" },
  x: { vb: 24, d: "M5 5l14 14M19 5L5 19" },
  home: { vb: 24, d: "M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" },
  pause: { vb: 24, d: "M8 5v14M16 5v14" },
  play: { vb: 32, d: "M9 5l18 11L9 27z", fill: true },
  mic: { vb: 32, d: "M11 3h10v17H11zM6 15a10 10 0 0020 0M16 25v4" },
  print: { vb: 32, d: "M9 12V4h14v8M9 23H5V12h22v11h-4M9 19h14v9H9z" },
  arrow: { vb: 32, d: "M6 16h20M18 8l8 8-8 8" },
  back: { vb: 24, d: "M15 5l-7 7 7 7" },
  check: { vb: 24, d: "M5 12l5 5 9-10" },
  plus: { vb: 32, d: "M16 6v20M6 16h20" },
  up: { vb: 24, d: "M12 19V5M6 11l6-6 6 6" },
  down: { vb: 24, d: "M12 5v14M6 13l6 6 6-6" },
  trash: { vb: 24, d: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" },
  alert: { vb: 24, d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v6M12 16.5v.5" },
  sliders: { vb: 24, d: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6" },
  gear: { vb: 24, d: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" },
  speaker: { vb: 24, d: "M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 010 8" },
  sun: { vb: 32, d: "M16 10a6 6 0 100 12 6 6 0 000-12zM16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3" },
  frame: { vb: 32, d: "M8 4h16v24H8zM4 9v14M28 9v14" },
  flat: { vb: 32, d: "M3 20l8-8h18l-8 8zM3 20v4h18v-4M21 20l8-8" },
  doc: { vb: 32, d: "M8 3h12l6 6v20H8zM20 3v6h6M12 15h10M12 20h10M12 25h6" },
  list: { vb: 32, d: "M10 8h16M10 16h16M10 24h16M4 8h.5M4 16h.5M4 24h.5" },
  pill: { vb: 32, d: "M10 6l-6 6a6 6 0 008 8l6-6M12 20l-4-4M20 4l8 8-8 8" },
  wrench: { vb: 32, d: "M20 6a6 6 0 00-5 8L5 24l3 3 10-10a6 6 0 008-5l-4 3-3-1-1-3z" },
  hand: { vb: 32, d: "M10 16V7a2 2 0 014 0v7M14 14V5a2 2 0 014 0v9M18 14V7a2 2 0 014 0v10c0 6-3 10-8 10-4 0-7-3-9-8l-1-4a2 2 0 013-1z" },
  bulb: { vb: 32, d: "M16 3a8 8 0 00-4 15v4h8v-4A8 8 0 0016 3zM12 27h8" },
  // Direction C line icons (24 grid, drawn at 2px in CSS)
  globe: { vb: 24, d: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-3.6 5.6-3.6 9s1.1 6.4 3.6 9c2.5-2.6 3.6-5.6 3.6-9S14.5 5.6 12 3z" },
  history: { vb: 24, d: "M4 12a8 8 0 102.4-5.7M4 4v4h4M12 8v4l3 2" },
  chevDown: { vb: 24, d: "M7 10l5 5 5-5" },
  chevRight: { vb: 24, d: "M10 6l6 6-6 6" },
  phone: { vb: 24, d: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" },
  endCall: { vb: 24, d: "M5 4h4l2 5-2.5 1.5a11 11 0 001.6 2.3M13.9 15.1l1.1-2.1 5 2v4a1 1 0 01-1 1A16 16 0 015.5 9.5M3 21L21 3" },
  lock: { vb: 24, d: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3" },
  volume: { vb: 24, d: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" },
  playCircle: { vb: 24, d: "M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5v7l5.5-3.5z" },
  send: { vb: 24, d: "M21 3L10 14M21 3l-7 18-4-7-7-4z" },
  chat: { vb: 24, d: "M5 5h14v10H10l-5 4z" },
  info: { vb: 24, d: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8v.5" },
  swap: { vb: 24, d: "M4 8h14l-3-3M20 16H6l3 3" },
  file: { vb: 24, d: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" },
};

/** Icons that point along the reading direction: mirrored in RTL. */
const MIRROR = new Set(["arrow", "back", "chevRight", "send"]);

export default function Icon({ name, size, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  const p = PATHS[name] ?? PATHS.doc;
  return (
    <svg
      viewBox={`0 0 ${p.vb} ${p.vb}`}
      width={size}
      height={size}
      // About 2px at the usual 22-24px size, whatever the drawing grid. CSS rules can still override it.
      strokeWidth={p.vb === 24 ? 2 : p.vb === 32 ? 2.6 : 3.6}
      aria-hidden="true"
      className={[className, MIRROR.has(name) ? "mirror" : ""].filter(Boolean).join(" ") || undefined}
      style={p.fill ? { fill: "currentColor", ...style } : style}
    >
      <path d={p.d} />
    </svg>
  );
}

/** The cartoon guide (the same portrait the live Anam avatar is made from). Replaced by the live video when a
 * session is running. Source: design/guide-cartoon/chosen.png. */
export function GuideFace({ large }: { large?: boolean }) {
  if (!large) return <img src="/guide-face.jpg" className="av guide-face" alt="" aria-hidden="true" width={56} height={56} />;
  return <img src="/guide-cartoon.jpg" className="ill guide-ill" alt="" aria-hidden="true" />;
}
