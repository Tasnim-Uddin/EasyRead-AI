import Icon from "../icons";

// Extra line icons for My guides, Remind me, Share and Privacy (24 grid, same 2px stroke as icons.tsx).
const EXTRA: Record<string, string> = {
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4",
  pen: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  coin: "M12 3a9 9 0 100 18 9 9 0 000-18zM14.5 8.5c-.5-1-1.4-1.5-2.5-1.5-1.5 0-2.5.9-2.5 2 0 2.8 5 1.6 5 4.3 0 1.2-1.1 2.2-2.6 2.2-1.2 0-2.2-.6-2.6-1.6M12 5.5V7M12 17v1.5",
  bell: "M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  moon: "M20 14A8 8 0 0110 4a8 8 0 1010 10z",
  half: "M12 3a9 9 0 100 18zM12 3a9 9 0 010 18",
  search: "M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM15.5 15.5L20 20",
  more: "M5 12h.5M12 12h.5M19 12h.5",
  pencil: "M4 20l4-1 11-11-3-3L5 16z",
  phoneSmall: "M8 3h8v18H8zM11 18h2",
  sendPlane: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  textSize: "M3 18l5-12 5 12M5 14h6M15 18l3-7 3 7M16 16h4",
  noteq: "M5 9h14M5 15h14M16 5L8 19",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.5",
};
const MIRROR = new Set(["sendPlane"]);

export function XIcon({ name, size, className }: { name: string; size?: number; className?: string }) {
  const d = EXTRA[name];
  if (!d) return <Icon name={name} size={size} className={className} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={2} aria-hidden="true" className={[className, MIRROR.has(name) ? "mirror" : ""].filter(Boolean).join(" ") || undefined}>
      <path d={d} />
    </svg>
  );
}
