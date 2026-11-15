import { useState } from "react";
import type { Guide } from "../types";
import { isFallback, t } from "../i18n";
import { CountThen } from "../bidi";
import { canSpeak } from "../languages";
import Icon, { GuideFace } from "../icons";
import { roleName } from "./capture";
import { LangPill, TitleBar, EmergencyLink } from "./shared";

export type Kind = "medicine" | "howto" | "letter" | "form";
export function kindOf(g: Guide): Kind {
  const dt = g.doc_type ?? "how_to";
  if (dt === "form") return "form";
  if (dt !== "how_to") return "letter";
  return g.domain === "medicine" || (!g.domain && !!g.facts?.medicine) ? "medicine" : "howto";
}

/* ---------- 4. summary first ---------- */
const FALLBACK_SAFETY: Record<Kind, string> = {
  medicine: "Not sure? Ask your pharmacist. For advice, call 111. In an emergency, call 999.",
  howto: "If something breaks or feels unsafe, stop and ask for help.",
  letter: "Get free advice before you sign or pay. Citizens Advice can help: 0800 144 8848.",
  form: "Get free advice before you sign or pay. Citizens Advice can help: 0800 144 8848.",
};
export const safetyLines = (g: Guide, lang = "en") =>
  g.safety_lines && g.safety_lines.length ? g.safety_lines : [isFallback(lang, "safe_" + kindOf(g)) ? FALLBACK_SAFETY[kindOf(g)] : t(lang, "safe_" + kindOf(g))];

export function summaryText(g: Guide): string {
  const k = kindOf(g);
  const c = g.content;
  if (k === "letter" || k === "form") {
    if (k === "form") return (c?.fields ?? []).map((f) => `${f.label}. ${f.what_to_write}`).join(" ");
    return [c?.what_this_is, ...(c?.what_to_do ?? []), ...(c?.by_when ?? []).map((b) => `${b.date}: ${b.what}`)].filter(Boolean).join(" ");
  }
  const f = g.facts;
  return [f?.medicine ?? f?.title, f?.dose, f?.frequency].filter(Boolean).join(". ") + `. ${g.steps.length} ${t(g.language, "steps")}.`;
}

function DeviceCard({ guide, lang }: { guide: Guide; lang: string }) {
  const [original, setOriginal] = useState(false);
  const src = guide.source;
  if (!src.device_photo_labelled_url) return null;
  const orig = src.device_photo_url;
  const labels = src.device_photo_labels ?? [];
  const title = t(lang, guide.facts?.device_type?.startsWith("inhaler") ? "yourInhaler" : "yourItem");
  const showOrig = original && !!orig;
  return (
    <div className="card device">
      <div className="k">{title}</div>
      <img src={showOrig ? orig! : src.device_photo_labelled_url} alt={`${title}. ${t(lang, "itemCaption")}`} />
      <p dir="auto">{t(lang, "itemCaption")}</p>
      {!showOrig && labels.length > 0 && (
        <ol className="legend" dir="auto">
          {labels.map((x) => (
            <li key={x}>{t(lang, "part_" + x)}</li>
          ))}
        </ol>
      )}
      {orig && (
        <button className="btn soft small" onClick={() => setOriginal(!original)}>
          {t(lang, showOrig ? "showLabelled" : "showOriginal")}
        </button>
      )}
    </div>
  );
}

interface SummaryProps {
  guide: Guide;
  lang: string;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onPapers?: () => void;
  onBack: () => void;
  onStart: () => void;
  onListen: () => void;
  /** The one audio tap: start the live guide, which then explains step 1. */
  onStartGuide?: () => void;
  onSeePaper?: () => void;
}
export function Summary({ guide, lang, onLanguage, onBack, onStart, onListen, onStartGuide, onSeePaper }: SummaryProps) {
  const k = kindOf(guide);
  const f = guide.facts;
  const c = guide.content;
  const docs = guide.source.documents ?? [];
  const sources = docs.length ? docs.map((d) => roleName(lang, d.role)) : [];
  const conflicts = f?.conflicts ?? [];
  const warnings = (f?.warnings ?? []).filter((w) => !w.startsWith("Your label and leaflet say different"));
  const title =
    k === "letter" ? c?.what_this_is : k === "form" ? f?.title ?? t(lang, "boxByBox") : f?.medicine ?? f?.title ?? t(lang, "yourPaper");
  const subline = k === "medicine" ? guide.summary_line || [f?.dose, f?.frequency].filter(Boolean).join(", ") : "";
  const thumb = guide.steps.find((s) => s.image_url)?.image_url;
  return (
    <div className="screen">
      <TitleBar title={t(lang, "yourGuideTitle")} lang={lang} onBack={onBack} right={<LangPill lang={lang} onLanguage={onLanguage} />} />
      <div className="card sage this-is">
        <div className="k">{t(lang, "thisIs")}</div>
        <div className="this-row">
          {thumb && <img className="thumb" src={thumb} alt="" />}
          <div className="big" dir="auto">
            {title}
          </div>
        </div>
        {subline && <p dir="auto">{subline}</p>}
      </div>

      {onSeePaper && (
        <button className="btn quiet see-paper" onClick={onSeePaper}>
          <Icon name="doc" />
          {t(lang, "seePaper")}
        </button>
      )}
      <DeviceCard guide={guide} lang={lang} />

      {conflicts.length > 0 && (
        <div className="card warn" role="alert">
          <div className="warn-head">
            <span className="warn-ico">
              <Icon name="alert" />
            </span>
            <div>
              <b>{t(lang, "conflictTitle")}</b>
              <p>{t(lang, "conflictAsk")}</p>
            </div>
          </div>
          {conflicts.map((x, i) => (
            <div className="quotes" key={i}>
              <div className="quote">
                <b>{t(lang, "labelSays")}</b>
                <span dir="auto">“{x.label}”</span>
              </div>
              <div className="quote">
                <b>{t(lang, "leafletSays")}</b>
                <span dir="auto">“{x.leaflet}”</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {k === "letter" && (c?.what_to_do?.length ?? 0) > 0 && (
        <div className="card">
          <div className="k">{t(lang, "whatToDo")}</div>
          <ol>
            {c!.what_to_do!.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}

      {k === "letter" && ((c?.by_when?.length ?? 0) > 0 || (c?.amounts?.length ?? 0) > 0) && (
        <div className="facts">
          {(c?.by_when ?? []).map((b, i) => (
            <div className="fact butter" key={"d" + i}>
              <div className="k">{t(lang, "byWhen")}</div>
              <div className="v">{b.date}</div>
              <div className="w">{b.what}</div>
            </div>
          ))}
          {(c?.amounts ?? []).map((a, i) => (
            <div className="fact" key={"a" + i}>
              <div className="k">{a.what}</div>
              <div className="v">{a.amount}</div>
            </div>
          ))}
        </div>
      )}

      {k === "form" && (
        <div className="card">
          <div className="k">{t(lang, "boxByBox")}</div>
          <ol>
            {(c?.fields ?? []).map((x, i) => (
              <li key={i}>
                <b>{x.label}:</b> {x.what_to_write}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(k === "medicine" || k === "howto") && (
        <div className="facts">
          <div className="fact">
            <div className="k">{t(lang, "youWillLearn")}</div>
            <div className="v">
              <CountThen lang={lang} k="steps" count={guide.steps.length} />
            </div>
          </div>
          {k === "medicine" && f?.dose && (
            <div className="fact">
              <div className="k">{t(lang, "dosage")}</div>
              <div className="v">{f.dose}</div>
            </div>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="card butter">
          <div className="k">{t(lang, "goodToKnow")}</div>
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {(f?.unreadable?.length ?? 0) > 0 && (
        <p className="banner" role="alert">
          {t(lang, "unreadable")} {f!.unreadable.join("; ")}
        </p>
      )}

      {sources.length > 0 && (k === "medicine" || k === "howto") && (
        <div className="card">
          <div className="k">{t(lang, "fromPapers")}</div>
          <div className="src">
            {sources.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {guide.source.is_sample && k === "medicine" && <p className="safe">{t(lang, "sampleNote")}</p>}
      <p className="safe" dir="auto">
        {safetyLines(guide, lang).map((l, i) => (
          <span key={i}>
            {l}{" "}
          </span>
        ))}
      </p>

      <div className="foot sticky">
        {onStartGuide && (
          <button className="btn start-guide" onClick={onStartGuide}>
            <GuideFace />
            {t(lang, "startWithGuide")}
          </button>
        )}
        <div className="pair">
          {canSpeak(lang) && (
            <button className="btn soft" onClick={onListen}>
              <Icon name="volume" />
              {t(lang, "listen")}
            </button>
          )}
          <button className="btn" onClick={onStart}>
            {t(lang, k === "letter" || k === "form" ? "showSteps" : "startStep")}
            <Icon name="chevRight" />
          </button>
        </div>
        {kindOf(guide) === "medicine" && <EmergencyLink lang={lang} />}
      </div>
    </div>
  );
}
