import { t } from "../i18n";
import Icon from "../icons";
import type { PaperRow } from "./papers";
import { RecentGuides } from "../extras/MyGuides";
import { TopBar } from "./shared";
import "./homeStrings";
import "./home.css";

/* ---------- 1. home ---------- */
interface HomeProps {
  lang: string;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onCamera: () => void;
  onUpload: () => void;
  /** Demo mode only: customers never see the sample chips. */
  onSample?: (name: string) => void;
  onPapers: () => void;
  hasPapers: boolean;
  /** The newest paper made on this phone (from My guides), shown as "Last paper". */
  lastPaper?: PaperRow | null;
  onOpenPaper?: (id: string) => void;
  /** My guides on this phone (newest two shown, with See all). */
  recent?: PaperRow[] | null;
}
export function Home({ lang, onLanguage, onSettings, onCamera, onUpload, onSample, onPapers, recent, onOpenPaper }: HomeProps) {
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
      <div className="hero home">
        <section className="home-intro">
          <div className="who">
            <img src="/guide-face.jpg" alt="" aria-hidden="true" width={80} height={80} />
            <div className="bubble">{t(lang, "hHi")}</div>
          </div>
          <h1>{t(lang, "hTitle")}</h1>
          <p>{t(lang, "hLead")}</p>
        </section>
        <div className="home-cta">
          <button className="btn" onClick={onCamera}>
            <Icon name="camera" />
            {t(lang, "hTake")}
          </button>
          <button className="btn outline" onClick={onUpload}>
            <Icon name="upload" />
            {t(lang, "hChoose")}
          </button>
        </div>
        <RecentGuides lang={lang} rows={recent ?? null} onOpen={(id) => onOpenPaper?.(id)} onAll={onPapers} />
        {/* History lives behind the labelled "My guides" button in the top bar, never on the main page. */}
        <p className="help">
          <Icon name="lock" />
          {t(lang, "privateHere")}
        </p>
        {onSample && (
          <div className="samples">
            <span style={{ flexBasis: "100%", textAlign: "center" }}>{t(lang, "trySample")}</span>
            <button onClick={() => onSample("inhaler")}>{t(lang, "sampleInhaler")}</button>
            <button onClick={() => onSample("council")}>{t(lang, "sampleLetter")}</button>
            <button onClick={() => onSample("flatpack")}>{t(lang, "sampleFlatpack")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
