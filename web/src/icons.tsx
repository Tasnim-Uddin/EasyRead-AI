import type { CSSProperties } from "react";

// 3px-stroke line icons from the approved design. Stroke comes from CSS (svg { stroke: currentColor }).
const PATHS: Record<string, { vb: number; d: string; fill?: boolean }> = {
  camera: { vb: 48, d: "M6 15h8l3-5h14l3 5h8v22H6zM24 19a7 7 0 100 14 7 7 0 000-14z" },
  upload: { vb: 32, d: "M16 22V6M9 12l7-7 7 7M5 27h22" },
  x: { vb: 24, d: "M5 5l14 14M19 5L5 19" },
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
};

export default function Icon({ name, size, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  const p = PATHS[name] ?? PATHS.doc;
  return (
    <svg
      viewBox={`0 0 ${p.vb} ${p.vb}`}
      width={size}
      height={size}
      aria-hidden="true"
      className={[className, name === "arrow" || name === "back" ? "mirror" : ""].filter(Boolean).join(" ") || undefined}
      style={p.fill ? { fill: "currentColor", ...style } : style}
    >
      <path d={p.d} />
    </svg>
  );
}

/** Illustrated stand-in for the Anam avatar. Replaced by the live video when a session is running. */
export function GuideFace({ large }: { large?: boolean }) {
  if (!large) {
    return (
      <svg viewBox="0 0 56 56" className="av" aria-hidden="true" style={{ stroke: "none" }}>
        <circle cx="28" cy="28" r="28" fill="var(--sage)" />
        <circle cx="28" cy="22" r="11" fill="var(--sage-ink)" />
        <ellipse cx="28" cy="54" rx="20" ry="15" fill="var(--sage-ink)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 390 330" className="ill" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ stroke: "none" }}>
      <circle cx="350" cy="30" r="90" fill="#B5D6C1" />
      <circle cx="30" cy="300" r="70" fill="#B5D6C1" />
      <path d="M95 330c0-55 45-80 100-80s100 25 100 80z" fill="#24503A" />
      <path d="M170 252l25 40 25-40z" fill="#FFFDF9" />
      <rect x="178" y="215" width="34" height="40" rx="14" fill="#E9B98F" />
      <ellipse cx="195" cy="165" rx="64" ry="72" fill="#F4C9A0" />
      <path d="M128 160c-8-62 30-92 70-92 44 0 72 34 62 92-12-30-30-46-62-46s-50 16-70 46z" fill="#3A2A20" />
      <circle cx="172" cy="170" r="7" fill="#3A2A20" />
      <circle cx="218" cy="170" r="7" fill="#3A2A20" />
      <circle cx="150" cy="195" r="11" fill="#F0A98A" opacity=".7" />
      <circle cx="240" cy="195" r="11" fill="#F0A98A" opacity=".7" />
      <path d="M172 200q23 22 46 0" fill="none" stroke="#3A2A20" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
