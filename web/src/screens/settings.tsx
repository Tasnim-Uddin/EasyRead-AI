import { useState } from "react";
import type { ToolLogEntry } from "../types";
import { LANGUAGES, t } from "../i18n";
import { Counted } from "../bidi";
import { isRtl, languageLabel } from "../languages";
import { THEMES, THEME_KEY, type Theme } from "../look";
import { isPreset, LanguageDialog, TitleBar } from "./shared";
import { TextSizeControl } from "../extras/TextSize";
import { openLanguagePicker, openPrivacy } from "../extras/bus";
import { XIcon } from "../extras/icons";
import "../extras/strings";

/* ---------- 11. settings ---------- */
interface SettingsProps {
  lang: string;
  scale: number;
  rate: number;
  voice: boolean;
  onScale: (v: number) => void;
  onRate: (v: number) => void;
  onVoice: (v: boolean) => void;
  theme?: Theme;
  onTheme?: (t: Theme) => void;
  onLanguage: (c: string) => void;
  onBack: () => void;
  demo?: boolean;
  onDemo?: (on: boolean) => void;
}
export function Settings({ lang, scale, rate, voice, theme, onScale, onRate, onVoice, onTheme, onLanguage, onBack, demo, onDemo }: SettingsProps) {
  const [other, setOther] = useState(false);
  return (
    <div className="screen">
      <TitleBar title={t(lang, "settings")} lang={lang} onBack={onBack} />
      <div className="set">
        <div className="sec">
          <h3>{t(lang, "textSize")}</h3>
          <TextSizeControl lang={lang} scale={scale} onScale={onScale} />
        </div>
        <div className="sec">
          <h3>
            {t(lang, "voiceSpeed")}
            <em>{rate < 0.9 ? t(lang, "slow") : rate > 1.05 ? t(lang, "quick") : t(lang, "normal")}</em>
          </h3>
          <input className="range" type="range" min={0.6} max={1.2} step={0.1} value={rate} onChange={(e) => onRate(Number(e.target.value))} aria-label={t(lang, "voiceSpeed")} />
          <div className="sz">
            <span>{t(lang, "slow")}</span>
            <span>{t(lang, "quick")}</span>
          </div>
        </div>
        <div className="sec">
          <h3>{t(lang, "language")}</h3>
          <div className="langs">
            {LANGUAGES.map((l) => (
              <button key={l.code} className={"chip" + (l.code === lang ? " on" : "")} aria-pressed={l.code === lang} onClick={() => onLanguage(l.code)}>
                {l.label}
              </button>
            ))}
            {!isPreset(lang) && (
              <button className="chip on" aria-pressed="true">
                {languageLabel(lang)}
              </button>
            )}
            <button className="chip" onClick={() => setOther(true)}>
              {t(lang, "otherLanguage")}
            </button>
          </div>
          <button className="x-set-link" onClick={openLanguagePicker}>
            <XIcon name="globe" />
            <span>{t(lang, "xChooseLanguage")}</span>
            <XIcon name="chevRight" />
          </button>
          {other && <LanguageDialog lang={lang} onClose={() => setOther(false)} onPick={(c) => { setOther(false); onLanguage(c); }} />}
          {isRtl(lang) && (
            <div className="rtlnote">
              <span>{languageLabel(lang)}</span>
              <small>{t(lang, "rtlNote")}</small>
            </div>
          )}
        </div>
        {onTheme && (
          <div className="sec">
            <h3>{t(lang, "looks")}</h3>
            <div className="langs">
              {THEMES.map((th) => (
                <button key={th} className={"chip" + (th === theme ? " on" : "")} aria-pressed={th === theme} onClick={() => onTheme(th)}>
                  {t(lang, THEME_KEY[th])}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="sec">
          <button className="x-set-link" onClick={openPrivacy}>
            <XIcon name="lock" />
            <span>{t(lang, "xPrivacyLink")}</span>
            <XIcon name="chevRight" />
          </button>
        </div>
        <button className="sec toggle" role="switch" aria-checked={voice} onClick={() => onVoice(!voice)}>
          <h3>{t(lang, "readAuto")}</h3>
          <span className={"tg" + (voice ? " on" : "")} />
        </button>
        {onDemo && (
          <button className="sec toggle demo-switch" role="switch" aria-checked={!!demo} onClick={() => onDemo(!demo)}>
            <span>
              <b>{t(lang, "demoMode")}</b>
              <small>{t(lang, "demoModeNote")}</small>
            </span>
            <span className={"tg" + (demo ? " on" : "")} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- dev panel + print ---------- */
export function DevPanel({ log, lang }: { log: ToolLogEntry[]; lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="devtoggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Counted lang={lang} k="devToggle" count={log.length} />
      </button>
      {open && (
        <div className="devpanel">
          <ol>
            {log.map((e, i) => (
              <li key={i}>
                <span className="tagd">{e.source}</span>
                <code dir="ltr">{e.tool}</code>({JSON.stringify(e.args)}) <bdi>{e.ms} ms</bdi>
                {e.say && <div className="say">{e.say}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
