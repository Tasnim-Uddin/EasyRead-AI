// Script fonts, loaded only when the language needs them (Fredoka and Atkinson have no Arabic or Bengali glyphs).
const FONTS: Record<string, string> = {
  ar: "family=Readex+Pro:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700",
  ur: "family=Readex+Pro:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700",
  bn: "family=Noto+Sans+Bengali:wght@400;600;700",
};
const loaded = new Set<string>();

export function loadScriptFont(lang: string) {
  const code = lang.toLowerCase().split("-")[0];
  const q = FONTS[code];
  if (!q || loaded.has(q) || typeof document === "undefined") return;
  loaded.add(q);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
  document.head.appendChild(link);
}
