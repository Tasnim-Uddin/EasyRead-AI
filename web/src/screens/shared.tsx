import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LANGUAGES, t } from "../i18n";
import { languageLabel, languageValue, searchLanguages } from "../languages";
import Icon from "../icons";
import type { AnamState } from "../useAnam";

export const AVATAR_VIDEO_ID = "anam-video";
export const MAX_FILES = 8;

/* ---------- the one live avatar video, kept mounted for the whole session ---------- */
export interface LiveInfo {
  live: boolean;
  lang: string;
  onEnd: () => void;
  micMuted: boolean;
  soundOff: boolean;
  onToggleMic: () => void;
  onToggleSound: () => void;
  onSend?: (text: string) => boolean;
  /** Docked guide panel (on by default, `?dock=0` turns it off). */
  dock?: boolean;
  /** The guide's latest spoken line, for the dock caption. */
  caption?: string;
  /** Open the talk screen. */
  onTalk?: () => void;
  /** The avatar connection state, so the dock row can say "Connecting" or that the guide is not switched on. */
  state?: AnamState;
  /** Start the live avatar right here (in the dock), on the step the user is looking at. Never automatic. */
  onStartHere?: () => void;
  /** Guide-led: the guide is wanted (default). Hidden = plain read-aloud. */
  guideOn?: boolean;
  onHide?: () => void;
  onShow?: () => void;
  /** Stop the guide mid-sentence. */
  onPause?: () => void;
  /** i18n key of the dock status chip. */
  status?: string;
  /** Open the question sheet. */
  onAsk?: () => void;
}
export const LiveContext = createContext<LiveInfo | null>(null);
/** Home and Summary shortcuts for every title bar. */
export const NavContext = createContext<{ onHome?: () => void; onSummary?: () => void }>({});
export const useLive = () => {
  const c = useContext(LiveContext);
  return c && c.live ? c : null;
};
export const useDock = () => {
  const c = useContext(LiveContext);
  return c && c.dock ? c : null;
};

/* ---------- shared bars ---------- */
const OTHER = "__other__";
export const isPreset = (lang: string) => LANGUAGES.some((l) => l.code === lang);

/* "Other language…": search a built-in list of common languages, or type any language. */
export function LanguageDialog({ lang, onPick, onClose }: { lang: string; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const found = searchLanguages(q);
  const typed = q.trim();
  const typedValue = typed ? languageValue(typed) : "";
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="langdlg" role="dialog" aria-modal="true" aria-label={t(lang, "otherLanguage")} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card">
        <div className="row">
          <input
            ref={ref}
            type="text"
            value={q}
            maxLength={40}
            placeholder={t(lang, "searchLanguage")}
            aria-label={t(lang, "searchLanguage")}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typedValue && onPick(found.length === 1 ? found[0].code : typedValue)}
          />
          <button className="round" onClick={onClose} aria-label={t(lang, "closeX")}>
            <Icon name="x" />
          </button>
        </div>
        {typed && !found.some((w) => w.code === typedValue) && (
          <button className="chip on" onClick={() => onPick(typedValue)}>
            {t(lang, "useTyped")} “{typed}”
          </button>
        )}
        <ul>
          {found.map((w) => (
            <li key={w.code}>
              <button className={"chip" + (w.code === lang ? " on" : "")} onClick={() => onPick(w.code)}>
                <span dir="auto">{w.native}</span>
                {w.native !== w.en && <small> {w.en}</small>}
              </button>
            </li>
          ))}
        </ul>
        {typed && !found.length && <p className="help">{t(lang, "noMatch")}</p>}
      </div>
    </div>
  );
}

export function LangPill({ lang, onLanguage }: { lang: string; onLanguage: (c: string) => void }) {
  const [other, setOther] = useState(false);
  const current = languageLabel(lang);
  return (
    <>
    <label className="lang">
      <span className="sr">{t(lang, "language")}</span>
      <Icon name="globe" />
      <span className="lang-name">{current}</span>
      <Icon name="chevDown" />
      <select
        value={lang}
        onChange={(e) => {
          if (e.target.value === OTHER) setOther(true);
          else onLanguage(e.target.value);
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
        {!isPreset(lang) && <option value={lang}>{current}</option>}
        <option value={OTHER}>{t(lang, "otherLanguage")}</option>
      </select>
    </label>
    {other && (
      <LanguageDialog
        lang={lang}
        onClose={() => setOther(false)}
        onPick={(c) => {
          setOther(false);
          onLanguage(c);
        }}
      />
    )}
    </>
  );
}

export function TopBar({ lang, onLanguage, onSettings, onBrand, onPapers }: { lang: string; onLanguage: (c: string) => void; onSettings: () => void; onBrand?: () => void; onPapers?: () => void }) {
  const nav = useContext(NavContext);
  const home = onBrand ?? nav.onHome;
  return (
    <div className="top">
      <button className="brand" onClick={home} disabled={!home} aria-label={home ? `EasyRead, ${t(lang, "home")}` : undefined}>
        <i />
        EasyRead
      </button>
      <div className="top-right">
        {home && (
          <button className="round home-btn" onClick={home} aria-label={t(lang, "home")} title={t(lang, "home")}>
            <Icon name="home" />
          </button>
        )}
        <LangPill lang={lang} onLanguage={onLanguage} />
        {onPapers && (
          <button className="papers-btn" onClick={onPapers}>
            <Icon name="history" />
            <span>{t(lang, "myGuides")}</span>
          </button>
        )}
        <button className="round" onClick={onSettings} aria-label={t(lang, "settings")}>
          <Icon name="sliders" />
        </button>
      </div>
    </div>
  );
}

/** Back on the start side, the title centred, an optional control on the end side (mirrors in RTL). */
export function TitleBar({ title, lang, onBack, right, backLabel }: { title: React.ReactNode; lang: string; onBack: () => void; right?: React.ReactNode; backLabel?: string }) {
  const nav = useContext(NavContext);
  return (
    <div className="title-top">
      <button className={"round" + (backLabel ? " back-named" : "")} onClick={onBack} aria-label={backLabel ?? t(lang, "back2")}>
        <Icon name="back" />
        {backLabel && <span>{backLabel}</span>}
      </button>
      <h1>{title}</h1>
      <div className="title-end">
        {right}
        {nav.onSummary && (
          <button className="round" onClick={nav.onSummary} aria-label={t(lang, "summaryNav")} title={t(lang, "summaryNav")}>
            <Icon name="list" />
          </button>
        )}
        {nav.onHome && (
          <button className="round" onClick={nav.onHome} aria-label={t(lang, "home")} title={t(lang, "home")}>
            <Icon name="home" />
          </button>
        )}
      </div>
    </div>
  );
}
