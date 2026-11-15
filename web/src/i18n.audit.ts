// Translation audit: every UI string key must exist in every UI language, and must not be left in English.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const UI_LANGS = ["es", "ar", "ur", "pl", "bn", "fr", "pt", "ro", "tr", "lt", "zh", "pa", "gu", "fa"] as const;

/** Source files (under src/) that add strings with extendStrings({...}). */
export function stringModules(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\.audit\./.test(name) && name !== "i18n.ts"
        && /extendStrings\(\s*\{/.test(readFileSync(p, "utf8"))) out.push(relative(root, p));
    }
  };
  walk(root);
  return out.sort();
}

/** Keys (or lang.key) whose text is rightly the same as English: names, codes, or a word spelt the same (es "Normal"). */
// Words that are the same in that language (French "Page", Romanian "Calm", Turkish "Form" ...).
export const SAME_OK_KEYS = new Set<string>(["title", "es.normal", "es.xSizeNormal", "es.themeDefault",
  "fr.page", "fr.themeDefault", "fr.camPage", "fr.camOnePage", "fr.camPages", "fr.pagesLabel", "fr.xNGuides", "fr.xOneGuide", "fr.xContact", "fr.gs_guide", "fr.gs_pause", "pt.item", "pt.normal", "pt.themeDefault", "pt.xSizeNormal", "ro.normal", "ro.themeDefault", "ro.themeCalm", "ro.xContact", "ro.xSizeNormal", "tr.roleForm", "tr.normal", "tr.xForm1", "tr.xSizeNormal"]);
// Values that need no translation: names, numbers, symbols and placeholders only.
const SAME_OK_VALUES = /^(EasyRead AI|PDF|OK|NHS|[\d\s.,:;/+\-–—%{}()…·•×#*|<>=!?]*|\{\w+\}([\s/·:-]*\{\w+\})*)$/;

export interface Gap { lang: string; key: string; kind: "missing" | "english" | "rtl-number" }

/** Keys missing or left identical to English in each UI language, and bare numbers in Arabic/Urdu text. */
export function audit(dicts: Readonly<Record<string, Record<string, string>>>, allowSame: Set<string> = SAME_OK_KEYS): Gap[] {
  const en = dicts.en;
  const gaps: Gap[] = [];
  for (const lang of UI_LANGS) {
    const d = dicts[lang] ?? {};
    for (const [key, enVal] of Object.entries(en)) {
      const v = d[key];
      if (v === undefined) gaps.push({ lang, key, kind: "missing" });
      else if (v === enVal && !allowSame.has(key) && !allowSame.has(`${lang}.${key}`) && !SAME_OK_VALUES.test(enVal.trim()) && /[A-Za-z]{3}/.test(enVal)) gaps.push({ lang, key, kind: "english" });
      // A Latin-digit number inside right-to-left text must sit in an isolate (U+2068 ... U+2069), or it can jump sides.
      else if ((lang === "ar" || lang === "ur" || lang === "fa") && /[؀-ۿ]/.test(v) && hasBareNumber(v)) gaps.push({ lang, key, kind: "rtl-number" });
    }
  }
  return gaps;
}

/** Literal keys passed to t()/tf() anywhere under src/ (a key with no English string would show as raw text). */
export function usedKeys(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        for (const m of readFileSync(p, "utf8").matchAll(/\btf?\(\s*[\w.]+\s*,\s*"([A-Za-z_][\w]*)"\s*[,)]/g)) out.set(m[1], relative(root, p));
      }
    }
  };
  walk(root);
  return out;
}

/** True when an amount, phone number or code (2+ digits, or a currency sign) sits outside a Unicode isolate. */
export function hasBareNumber(v: string): boolean {
  let depth = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === "⁨") depth++;
    else if (c === "⁩") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /^(?:[£$€][0-9]|[0-9][0-9.,: ]*[0-9])/.test(v.slice(i))) return true;
  }
  return false;
}
