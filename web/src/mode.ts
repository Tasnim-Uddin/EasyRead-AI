// Customer mode (default) vs demo mode. Demo mode shows the sample papers, the tool-call panel and `?fakelive`.
// Turn it on with `?demo=1` (remembered on this device; `?demo=0` turns it off) or the switch at the bottom of Settings.
// Hash routes such as #/sample/... always work and turn demo mode on for that visit, so demo and video links keep working.
const KEY = "er.demo";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveDemo(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: demo mode lasts for this visit */
  }
}

export function initialDemo(): boolean {
  const q = new URLSearchParams(location.search).get("demo");
  if (q !== null) {
    const on = q !== "0" && q !== "false";
    saveDemo(on);
    return on;
  }
  if (/^#\/?(sample|tray|check|reading|error)\b/.test(location.hash)) return true;
  return read();
}

// "My papers": the ids of guides made on this device, newest first. The server only ever lists these ids
// (GET /api/guides?ids=...), so one phone never sees another person's papers. Samples are never added.
const MINE = "er.myGuides";
const MAX_MINE = 200;

export function myGuideIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(MINE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeMine(ids: string[]) {
  try {
    localStorage.setItem(MINE, JSON.stringify(ids.slice(0, MAX_MINE)));
  } catch {
    /* storage blocked: the list lasts for this visit only */
  }
}

export function rememberGuide(id: string) {
  if (!id || id.startsWith("g_sample") || id === "g_demo") return;
  writeMine([id, ...myGuideIds().filter((x) => x !== id)]);
}

export function forgetGuide(id: string) {
  writeMine(myGuideIds().filter((x) => x !== id));
}
