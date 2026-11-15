import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { DICTS } from "./i18n";
import { audit, hasBareNumber, stringModules, usedKeys } from "./i18n.audit";

const SRC = dirname(fileURLToPath(import.meta.url));

describe("translation audit", () => {
  it("finds the modules that add strings", () => {
    expect(stringModules(SRC).length).toBeGreaterThanOrEqual(4);
  });

  it("every UI string is translated in es, ar, ur, pl and bn", async () => {
    for (const m of stringModules(SRC)) await import(/* @vite-ignore */ "./" + m.replace(/\\/g, "/"));
    const gaps = audit(DICTS);
    expect(gaps.map((g) => `${g.lang}.${g.key} (${g.kind})`).join("\n")).toBe("");
  });

  it("every key the screens ask for has an English string", async () => {
    for (const m of stringModules(SRC)) await import(/* @vite-ignore */ "./" + m.replace(/\\/g, "/"));
    const missing = [...usedKeys(SRC)].filter(([k]) => DICTS.en[k] === undefined).map(([k, f]) => `${k} (${f})`);
    expect(missing.join("\n")).toBe("");
  });

  it("spots bare amounts and phone numbers in right-to-left text", () => {
    expect(hasBareNumber("اتصل بـ 0800 144 8848")).toBe(true);
    expect(hasBareNumber("اتصل بـ ⁨0800 144 8848⁩")).toBe(false);
    expect(hasBareNumber("ادفع £12")).toBe(true);
    expect(hasBareNumber("الخطوة {n}")).toBe(false);
  });

  it("no UI string tells people to call a fixed service or a named health worker", () => {
    const bad = /pharmac|farmac|\bGP\b|\b111\b|\b999\b|citizens advice|doctor|médico|lekarz|صيدلي|فارماس|ফার্মাসিস্ট/i;
    const hits: string[] = [];
    for (const [lang, d] of Object.entries(DICTS)) for (const [k, v] of Object.entries(d)) if (bad.test(v)) hits.push(`${lang}.${k}`);
    expect(hits.join("\n")).toBe("");
  });
});
