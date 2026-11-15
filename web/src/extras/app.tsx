// The extras' hook into App.tsx: extra screens, the Remind me sheet, and the small bits of state they need.
import { useEffect, useRef } from "react";
import type { Guide } from "../types";
import { SAMPLES, type GuideSummary } from "../api";
import { paperImages } from "../screens/papers";
import { on } from "./bus";
import { Welcome, LanguagePicker, markWelcomed, needsWelcome } from "./FirstRun";
import { ShareScreen } from "./Share";
import { PrivacyScreen } from "./Privacy";
import { RemindMeHost } from "./RemindMe";
import { rememberMeta, setMetaTitle, withMeta, type GuideRow } from "./guides";
import { guideTitle } from "./sheet";
import { renameGuide } from "./api";
import { loadScriptFont } from "./rtl";

import { saveProgress } from "./guides";

export { needsWelcome, saveProgress };

export type Extra = "welcome" | "language" | "share" | "privacy";

/** Called whenever the open guide changes: keeps the type, step count and own photo for My guides. */
export function extrasOnGuide(g: Guide | null) {
  if (!g || g.id.startsWith("g_sample") || g.id === "g_demo" || g.status !== "ready") return;
  rememberMeta(g, paperImages(g)[0] ?? null);
}

/** Sample guides as My guides rows (demo mode, so the list can be shown without making real guides). */
function sampleRows(): GuideRow[] {
  return ["council", "inhaler", "flatpack"].map((n) => {
    const g = SAMPLES[n];
    return {
      id: g.id,
      title: guideTitle(g),
      language: g.language,
      doc_type: g.doc_type ?? "how_to",
      domain: g.domain ?? (g.facts?.medicine ? "medicine" : null),
      created_at: g.created_at,
      status: g.status,
      thumbnail: g.steps.find((s) => s.image_url)?.image_url ?? null,
      paper: paperImages(g)[0] ?? null,
      steps: g.steps.length,
    };
  });
}

/** Server rows + this device's cached extras; in demo mode the samples join the list. */
export function guideRows(rows: GuideSummary[], demo: boolean): GuideRow[] {
  const mine = rows.map((r) => withMeta(r as GuideRow));
  return demo ? [...mine, ...sampleRows().map(withMeta)] : mine;
}

/** Rename: the server keeps it when it can (PATCH), this phone always does. */
export function renameRow(rows: GuideRow[] | null, id: string, title: string): GuideRow[] | null {
  setMetaTitle(id, title);
  if (!id.startsWith("g_sample")) void renameGuide(id, title);
  return rows?.map((r) => (r.id === id ? { ...r, title_override: title } : r)) ?? rows;
}

interface HostProps {
  screen: string;
  lang: string;
  guide: Guide | null;
  go: (s: string, replace?: boolean) => void;
  back: () => void;
  onLanguage: (code: string) => void;
  onShareGuide: (g: Guide) => void;
  myCount: number;
  onDeleteThis?: () => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

export function ExtrasHost({ screen, lang, guide, go, back, onLanguage, onShareGuide, myCount, onDeleteThis, onDeleteAll }: HostProps) {
  const fromWelcome = useRef(false);
  const goRef = useRef(go);
  goRef.current = go;
  const shareRef = useRef(onShareGuide);
  shareRef.current = onShareGuide;
  useEffect(() => loadScriptFont(lang), [lang]);
  useEffect(() => {
    const offs = [
      on("share", ({ guide: g }) => {
        shareRef.current(g);
        goRef.current("share");
      }),
      on("language", () => goRef.current("language")),
      on("privacy", () => goRef.current("privacy")),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  return (
    <>
      {screen === "welcome" && (
        <Welcome
          lang={lang}
          onChoose={() => {
            fromWelcome.current = true;
            go("language");
          }}
        />
      )}
      {screen === "language" && (
        <LanguagePicker
          lang={lang}
          onBack={back}
          onPick={(c) => {
            markWelcomed();
            onLanguage(c);
            if (fromWelcome.current) {
              fromWelcome.current = false;
              go("home", true);
            } else back();
          }}
        />
      )}
      {screen === "share" && guide && <ShareScreen guide={guide} lang={lang} onBack={back} />}
      {screen === "privacy" && <PrivacyScreen lang={lang} onBack={back} onDeleteThis={onDeleteThis} onDeleteAll={onDeleteAll} count={myCount} />}
      <RemindMeHost lang={lang} />
    </>
  );
}
