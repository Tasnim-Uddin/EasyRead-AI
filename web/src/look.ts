// Look options for comparing UI directions: `?theme=calm|fresh|warm-modern|default`, `?density=compact|regular`, `?dock=1|0`.
// The theme is remembered (localStorage); the new themes turn on the compact scale and the guide dock unless the URL says otherwise.
export const THEMES = ["default", "calm", "fresh", "warm-modern"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY: Record<Theme, string> = {
  default: "themeDefault",
  calm: "themeCalm",
  fresh: "themeFresh",
  "warm-modern": "themeWarm",
};

const params = new URLSearchParams(location.search);

function stored(): Theme {
  try {
    const v = localStorage.getItem("er.theme");
    return (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : "default";
  } catch {
    return "default";
  }
}

export function initialTheme(): Theme {
  const q = params.get("theme");
  if (q && (THEMES as readonly string[]).includes(q)) return q as Theme;
  return stored();
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "default") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const d = params.get("density");
  const compact = d ? d === "compact" : theme !== "default";
  if (compact) root.dataset.density = "compact";
  else delete root.dataset.density;
  try {
    localStorage.setItem("er.theme", theme);
  } catch {
    /* storage blocked: the theme lasts for this visit */
  }
}

/** The docked guide panel on step / ask / clip screens. */
export function dockOn(theme: Theme): boolean {
  const q = params.get("dock");
  if (q !== null) return q !== "0";
  return theme !== "default";
}
