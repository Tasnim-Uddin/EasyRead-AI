/** Line icons used only by the capture screens (24px grid, 2px stroke, colour from CSS). */
const P: Record<string, string> = {
  camera: "M3 8h4l2-3h6l2 3h4v11H3zM12 10.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  image: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15.5 8.5a1 1 0 100 .1",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5 9-10",
  plus: "M12 5v14M5 12h14",
  rotate: "M4 12a8 8 0 108-8H8M8 4l-3 3M8 4L5 1",
  move: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  corners: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  camoff: "M3 3l18 18M9 5h6l2 3h4v11h-2M15.5 15.5A3.5 3.5 0 0110 11M3 8h3v11h12",
  blur: "M4 8h16M4 12h16M4 16h16M6 8v8M18 8v8",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  crop: "M6 2v16h16M2 6h16v16",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  home: "M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5",
  retry: "M4 12a8 8 0 108-8H8M8 4l-3 3M8 4L5 1",
  alert: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v6M12 16.5v.5",
};

export function CIcon({ name, size = 24 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="cap-ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.alert} />
    </svg>
  );
}
