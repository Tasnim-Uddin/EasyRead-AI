import { forwardRef, useRef, useState, useSyncExternalStore } from "react";
import type { Guide } from "../types";
import { t, tf } from "../i18n";
import { isRtl, languageLabel } from "../languages";
import { TitleBar } from "../screens/shared";
import { paperImages } from "../screens/papers";
import { sampleVariant } from "../api";
import { XIcon } from "./icons";
import { sheetData } from "./sheet";
import { download, safeFileName, sheetPdf } from "./pdf";
import { fmtDay } from "./RemindMe";
import { ConflictCard } from "./ConflictCard";
import { openPrivacy } from "./bus";
import "./strings";
import "./extras.css";

/* The sheet choices are shared by the screen and the print copy (PrintSheet), so Print prints what you see. */
let opts = { photo: false, english: false };
const subs = new Set<() => void>();
function setOpts(o: Partial<typeof opts>) {
  opts = { ...opts, ...o };
  subs.forEach((f) => f());
}
export const useSheetOpts = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => opts,
  );

/** The guide to put on the sheet: a sample's English copy when "English" is chosen. */
function sheetGuide(g: Guide, english: boolean): Guide {
  return english ? sampleVariant(g, "en") ?? g : g;
}

function madeOn(lang: string, iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** The one-page summary (26a card). Also rendered for printing and turned into the PDF. */
export const SheetCard = forwardRef<HTMLDivElement, { guide: Guide; lang: string; english: boolean; photo: boolean; print?: boolean }>(function SheetCard(
  { guide, lang, english, photo, print },
  ref,
) {
  const L = english ? "en" : lang;
  const g = sheetGuide(guide, english);
  const s = sheetData(g, english, lang);
  const img = photo ? paperImages(guide)[0] : null;
  return (
    <div ref={ref} className={"x-sheetcard" + (print ? " print" : "")} dir={isRtl(L) ? "rtl" : "ltr"} lang={L}>
      <div className="x-sc-head">
        <span className="x-sc-doc" aria-hidden="true">
          <i />
          <i />
          <i />
          <i className="o" />
        </span>
        <div>
          <h2 dir="auto">{s.title}</h2>
          {s.made && <small>{tf(L, "xMadeOn", { date: madeOn(L, s.made) })}</small>}
        </div>
      </div>
      {(s.amount || s.date) && (
        <div className="x-sc-big">
          {s.amount && (
            <div>
              <small dir="auto">{s.amount.label || t(L, "xAmount")}</small>
              <b>
                <bdi>{s.amount.value}</bdi>
              </b>
            </div>
          )}
          {s.date && (
            <div>
              <small dir="auto">{s.date.label || t(L, "xBy")}</small>
              <b>
                <bdi>{s.date.iso ? fmtDay(L, s.date.iso, true) : s.date.value}</bdi>
              </b>
            </div>
          )}
        </div>
      )}
      <div className="x-sc-k">{t(L, "xWhatToDo")}</div>
      <ol className="x-sc-steps">
        {s.steps.map((x, i) => (
          <li key={i}>
            <span className="n">
              <bdi>{i + 1}</bdi>
            </span>
            <span dir="auto">{x}</span>
          </li>
        ))}
      </ol>
      {s.sender && (
        <p className="x-sc-sender">
          <b>{t(L, "xContact")}:</b> <span dir="auto">{s.sender}</span>
        </p>
      )}
      {img && <img className="x-sc-photo" src={img} alt={t(L, "xPhotoOfPaper")} crossOrigin="anonymous" />}
      <p className="x-sc-foot">{t(L, "xMadeWith")}</p>
    </div>
  );
});

type Busy = null | "share" | "pdf";

/** 26a Save or share. */
export function ShareScreen({ guide, lang, onBack }: { guide: Guide; lang: string; onBack: () => void }) {
  const o = useSheetOpts();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);
  const hasPhoto = paperImages(guide).length > 0;
  const name = safeFileName(sheetData(sheetGuide(guide, o.english), o.english).title);
  const plain = () => {
    const s = sheetData(sheetGuide(guide, o.english), o.english);
    const L = o.english ? "en" : lang;
    return [s.title, s.amount ? `${s.amount.label || t(L, "xAmount")}: ${s.amount.value}` : "", s.date ? `${s.date.label || t(L, "xBy")}: ${s.date.value}` : "", ...s.steps.map((x, i) => `${i + 1}. ${x}`), s.sender ? `${t(L, "xContact")}: ${s.sender}` : ""]
      .filter(Boolean)
      .join("\n");
  };

  async function pdf(): Promise<File | null> {
    if (!ref.current) return null;
    try {
      return await sheetPdf(ref.current, name);
    } catch {
      return null;
    }
  }
  async function share() {
    setBusy("share");
    setNote(null);
    try {
      const file = await pdf();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (file && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: file.name.replace(/\.pdf$/, "") });
      } else if (nav.share) {
        await nav.share({ title: name.replace(/\.pdf$/, ""), text: plain() });
      } else {
        await navigator.clipboard.writeText(plain());
        setNote(t(lang, "xCopied"));
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNote(t(lang, "xShareFailed"));
    } finally {
      setBusy(null);
    }
  }
  async function save() {
    setBusy("pdf");
    setNote(null);
    const file = await pdf();
    if (file) download(file);
    else setNote(t(lang, "xShareFailed"));
    setBusy(null);
  }

  const userLang = languageLabel(lang);
  return (
    <div className="screen x-share">
      <TitleBar title={t(lang, "xSaveOrShare")} lang={lang} onBack={onBack} />
      <div className="x-share-body">
        <SheetCard ref={ref} guide={guide} lang={lang} english={o.english} photo={o.photo && hasPhoto} />
        <ConflictCard guide={guide} lang={lang} />
        {lang !== "en" && (
          <div className="x-opt">
            <h3>{t(lang, "xShareIn")}</h3>
            <div className="x-seg" role="radiogroup" aria-label={t(lang, "xShareIn")}>
              <button role="radio" aria-checked={!o.english} className={!o.english ? "on" : ""} onClick={() => setOpts({ english: false })}>
                {!o.english && <XIcon name="check" />}
                <bdi>{userLang}</bdi>
              </button>
              <button role="radio" aria-checked={o.english} className={o.english ? "on" : ""} onClick={() => setOpts({ english: true })}>
                {o.english && <XIcon name="check" />}
                <bdi lang="en">English</bdi>
              </button>
            </div>
          </div>
        )}
        {hasPhoto && (
          <button className="x-toggle" role="switch" aria-checked={o.photo} onClick={() => setOpts({ photo: !o.photo })}>
            <XIcon name="photo" />
            <span>{t(lang, "xIncludePhoto")}</span>
            <span className={"tg" + (o.photo ? " on" : "")} />
          </button>
        )}
        <div className="x-actions">
          <button onClick={() => void share()} disabled={!!busy}>
            <XIcon name="share" />
            {busy === "share" ? t(lang, "xMaking") : t(lang, "xShare")}
          </button>
          <button onClick={() => window.print()} disabled={!!busy}>
            <XIcon name="print" />
            {t(lang, "xPrint")}
          </button>
          <button onClick={() => void save()} disabled={!!busy}>
            <XIcon name="download" />
            {busy === "pdf" ? t(lang, "xMaking") : t(lang, "xSavePdf")}
          </button>
        </div>
        {note && (
          <p className="x-note" role="status">
            {note}
          </p>
        )}
        <button className="x-foot-link" onClick={openPrivacy}>
          <XIcon name="lock" />
          {t(lang, "xOnlyYou")}
        </button>
      </div>
    </div>
  );
}
