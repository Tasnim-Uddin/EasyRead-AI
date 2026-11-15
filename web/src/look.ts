// Look options: `?theme=default|calm|fresh|warm-modern`, `?density=compact|regular`, `?dock=1|0`.
// "default" is the v2 design (Figma "v2 redesign", Direction C "Original, next level"); the old "classic"
// look was removed from the choices (a phone that had it stored falls back to Original). The theme is remembered (localStorage). The guide dock is on unless the URL says `?dock=0`.
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
  // The v2 sizes are the regular scale now; `?density=compact` is an extra, smaller option.
  if (params.get("density") === "compact") root.dataset.density = "compact";
  else delete root.dataset.density;
  try {
    localStorage.setItem("er.theme", theme);
  } catch {
    /* storage blocked: the theme lasts for this visit */
  }
}

/** The guide dock on step / ask / clip screens: on by default, `?dock=0` turns it off. */
export function dockOn(): boolean {
  const q = params.get("dock");
  return q === null ? true : q !== "0";
}
