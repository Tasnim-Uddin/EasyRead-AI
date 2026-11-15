import { useState } from "react";
import { t } from "../i18n";
import { TitleBar } from "../screens/shared";
import { XIcon } from "./icons";
import "./strings";
import "./extras.css";

const LINES: [string, string][] = [
  ["phoneSmall", "xPriv1"],
  ["eye", "xPriv2"],
  ["sendPlane", "xPriv3"],
  ["clock", "xPriv4"],
];

/** 31a/31b Your papers are private: what really happens, and delete. */
export function PrivacyScreen({
  lang,
  onBack,
  onDeleteThis,
  onDeleteAll,
  count,
}: {
  lang: string;
  onBack: () => void;
  /** Present when a guide is open. */
  onDeleteThis?: () => Promise<void> | void;
  onDeleteAll: () => Promise<void> | void;
  count: number;
}) {
  const [ask, setAsk] = useState<null | "this" | "all">(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | string>(null);
  async function run() {
    setBusy(true);
    try {
      if (ask === "this") await onDeleteThis?.();
      else await onDeleteAll();
      setDone(t(lang, ask === "this" ? "xDeletedOne" : "xDeletedAll"));
    } catch {
      setDone(t(lang, "xDeleteFailed"));
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }
  return (
    <div className="screen x-privacy">
      <TitleBar title={t(lang, "xYourPapers")} lang={lang} onBack={onBack} />
      <span className="x-lock" aria-hidden="true">
        <XIcon name="lock" />
      </span>
      <h2 className="x-priv-title">{t(lang, "xPrivateTitle")}</h2>
      <ul className="x-priv-list">
        {LINES.map(([icon, key]) => (
          <li key={key}>
            <span className="ico">
              <XIcon name={icon} />
            </span>
            <span>{t(lang, key)}</span>
          </li>
        ))}
      </ul>
      <h3 className="x-q">{t(lang, "xDelete")}</h3>
      {done && (
        <p className="x-note" role="status">
          {done}
        </p>
      )}
      {ask ? (
        <div className="x-confirm" role="alertdialog" aria-label={t(lang, ask === "this" ? "xDeleteThisAsk" : "xDeleteAllAsk")}>
          <b>{t(lang, ask === "this" ? "xDeleteThisAsk" : "xDeleteAllAsk")}</b>
          <p>{t(lang, "xCannotUndo")}</p>
          <div className="x-row">
            <button className="btn quiet" onClick={() => setAsk(null)} disabled={busy}>
              {t(lang, "xKeep")}
            </button>
            <button className="btn x-danger-solid" onClick={() => void run()} disabled={busy}>
              <XIcon name="trash" />
              {t(lang, "xYesDelete")}
            </button>
          </div>
        </div>
      ) : (
        <div className="x-del">
          {onDeleteThis && (
            <button className="btn quiet x-danger-line" onClick={() => setAsk("this")}>
              <XIcon name="trash" />
              {t(lang, "xDeleteThis")}
            </button>
          )}
          <button className="btn x-danger" onClick={() => setAsk("all")} disabled={count === 0}>
            <XIcon name="trash" />
            {t(lang, "xDeleteAll")}
          </button>
        </div>
      )}
    </div>
  );
}
