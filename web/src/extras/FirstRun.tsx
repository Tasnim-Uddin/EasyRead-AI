import { useMemo, useState } from "react";
import { LANGUAGES, t, tf } from "../i18n";
import { findWorld, isRtl, searchLanguages, WORLD, type World } from "../languages";
import { GuideFace } from "../icons";
import { TitleBar } from "../screens/shared";
import { XIcon } from "./icons";
import "./strings";
import "./extras.css";

const FLAG = "er.welcomed";
/** First visit on this device (no ?lang link, no #/ route): show the welcome. */
export function needsWelcome(): boolean {
  if (/[?&]lang=/.test(location.search) || location.hash.replace(/^#\/?/, "")) return false;
  try {
    return localStorage.getItem(FLAG) !== "1" && localStorage.getItem("er.lang") === null;
  } catch {
    return false;
  }
}
export function markWelcomed() {
  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* storage blocked */
  }
}

/** 15b: the guide says hello and asks for a language first. */
export function Welcome({ lang, onChoose }: { lang: string; onChoose: () => void }) {
  return (
    <div className="screen x-welcome">
      <div className="x-welcome-ill">
        <GuideFace large />
      </div>
      <div className="x-bubble">
        <small>{t(lang, "xYourGuide")}</small>
        <p>{t(lang, "xWelcome")}</p>
      </div>
      <div className="foot">
        <button className="btn" onClick={onChoose}>
          <XIcon name="globe" />
          {t(lang, "xChooseMyLanguage")}
        </button>
        <p className="x-hint">{t(lang, "xChangeAnyTime")}</p>
      </div>
    </div>
  );
}

/** The six languages the app speaks first, then every other language we know. */
export function pickerList(q: string): World[] {
  const ui = LANGUAGES.map((l) => findWorld(l.code)).filter((w): w is World => !!w);
  const rest = WORLD.filter((w) => !ui.some((u) => u.code === w.code));
  const all = [...ui, ...rest];
  if (!q.trim()) return all;
  const found = new Set(searchLanguages(q).map((w) => w.code));
  return all.filter((w) => found.has(w.code));
}

/** 15a: each language in its own script with its English name; search; one tick. */
export function LanguagePicker({ lang, onBack, onPick }: { lang: string; onBack: () => void; onPick: (code: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(lang);
  const list = useMemo(() => pickerList(q), [q]);
  const chosen = findWorld(sel);
  // The screen speaks the language being picked, so a person who cannot read the current one still can.
  const L = LANGUAGES.some((l) => l.code === sel) ? sel : lang;
  return (
    <div className="screen x-langpick" dir={isRtl(L) ? "rtl" : "ltr"} lang={L}>
      <TitleBar title={t(L, "xChooseLanguage")} lang={L} onBack={onBack} />
      <label className="x-search">
        <XIcon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(L, "xFindLanguage")} aria-label={t(L, "xFindLanguage")} />
      </label>
      <ul className="x-langs">
        {list.map((w) => {
          const on = w.code === sel;
          return (
            <li key={w.code}>
              <button className={"x-lang" + (on ? " on" : "")} aria-pressed={on} onClick={() => setSel(w.code)} lang={w.code}>
                <span className="names" dir={isRtl(w.code) ? "rtl" : "ltr"}>
                  <b>{w.native}</b>
                  {w.native !== w.en && <small lang="en">{w.en}</small>}
                </span>
                {on && (
                  <span className="x-chosen dark">
                    <XIcon name="check" />
                    {t(L, "xChosen")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {!list.length && <li className="x-hint">{t(L, "noMatch")}</li>}
      </ul>
      <div className="foot sticky">
        <button className="btn" onClick={() => onPick(sel)}>
          <XIcon name="check" />
          {tf(L, "xUseLang", { lang: chosen?.native ?? sel })}
        </button>
      </div>
    </div>
  );
}
