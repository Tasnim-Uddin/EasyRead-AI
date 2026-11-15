import type { Guide } from "../types";
import { t, tf } from "../i18n";
import { roleName } from "../screens/capture";
import { XIcon } from "./icons";
import "./strings";
import "./extras.css";

/** The two quotes that disagree, with which paper each came from. Empty when the papers agree. */
export function conflictsOf(guide: Guide, lang: string) {
  const docs = guide.source.documents ?? [];
  const nameA = docs[0] ? roleName(lang, docs[0].role) : t(lang, "xYourPaper");
  const nameB = docs[1] ? roleName(lang, docs[1].role) : t(lang, "xYourOtherPaper");
  return (guide.facts?.conflicts ?? []).map((c) => ({ a: c.label, b: c.leaflet, nameA, nameB }));
}

/** 27a "Your two papers say different things": both quotes side by side. Show before the affected step and on the summary. */
export function ConflictCard({ guide, lang, onOk, onAsk }: { guide: Guide; lang: string; onOk?: () => void; onAsk?: () => void }) {
  const list = conflictsOf(guide, lang);
  if (!list.length) return null;
  return (
    <section className="x-conflict" role="alert" aria-label={t(lang, "xConflictTitle")}>
      <span className="x-check-this">
        <XIcon name="alert" />
        {t(lang, "xCheckThis")}
      </span>
      <h2>{t(lang, "xConflictTitle")}</h2>
      {list.map((c, i) => (
        <div className="x-quotes" key={i}>
          <div className="x-quote">
            <small>{tf(lang, "xPaperN", { n: 1 })}</small>
            <b dir="auto">{c.nameA}</b>
            <div className="says">
              <small>{t(lang, "xSays")}</small>
              <span dir="auto">“{c.a}”</span>
            </div>
          </div>
          <span className="x-neq" aria-hidden="true">
            <XIcon name="noteq" />
          </span>
          <div className="x-quote">
            <small>{tf(lang, "xPaperN", { n: 2 })}</small>
            <b dir="auto">{c.nameB}</b>
            <div className="says">
              <small>{t(lang, "xSays")}</small>
              <span dir="auto">“{c.b}”</span>
            </div>
          </div>
        </div>
      ))}
      <p className="x-conflict-note">{t(lang, "xConflictNote")}</p>
      {(onOk || onAsk) && (
        <div className="x-row">
          {onAsk && (
            <button className="btn sage" onClick={onAsk}>
              <XIcon name="mic" />
              {t(lang, "xAsk")}
            </button>
          )}
          {onOk && (
            <button className="btn" onClick={onOk}>
              <XIcon name="check" />
              {t(lang, "xOkGotIt")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
