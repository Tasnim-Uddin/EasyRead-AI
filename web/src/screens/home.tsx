import { t } from "../i18n";
import Icon from "../icons";
import type { PaperRow } from "./papers";
import { TopBar } from "./shared";

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
}
export function Home({ lang, onLanguage, onSettings, onCamera, onUpload, onSample, onPapers }: HomeProps) {
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
      <div className="hero">
        <h1>
          {t(lang, "homeTitleA")} {t(lang, "homeTitleB")}
        </h1>
        <p>{t(lang, "homeLead")}</p>
        <div className="scan">
          {/* The camera circle is a big extra tap target for touch; the button below is the one for keyboards and screen readers. */}
          <div className="cam" onClick={onCamera} aria-hidden="true">
            <Icon name="camera" />
          </div>
          <span className="lbl">{t(lang, "scanHint")}</span>
          <button className="btn" onClick={onCamera}>
            <Icon name="camera" />
            {t(lang, "takePhoto")}
          </button>
        </div>
        <button className="btn soft" onClick={onUpload}>
          <Icon name="upload" />
          {t(lang, "upload")}
        </button>
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
