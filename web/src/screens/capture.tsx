import { useEffect, useState } from "react";
import type { GuideStatus } from "../types";
import { t, tf } from "../i18n";
import Icon from "../icons";
import { MAX_FILES, TopBar, TitleBar } from "./shared";
import { CIcon } from "../camera/icons";
import "../camera/capture.css";
import "../camera/strings";

export const ROLES = ["auto", "label", "leaflet", "device_photo", "letter", "form", "other"] as const;
export type Role = (typeof ROLES)[number];
export interface TrayItem {
  id: number;
  file: File;
  role: Role;
  url: string | null;
  /** The paper's corners chosen on the crop screen (normalised); the server flattens the photo with them. */
  quad?: [number, number][] | null;
}

const ROLE_KEY: Record<string, string> = {
  auto: "roleAuto",
  label: "roleLabel",
  leaflet: "roleLeaflet",
  device_photo: "roleDevice",
  letter: "roleLetter",
  form: "roleForm",
  other: "roleOther",
};
export const roleName = (lang: string, role: string) => t(lang, ROLE_KEY[role] ?? "roleOther");

/* ---------- 2a. check photo ---------- */
export function CheckPhoto({ lang, url, name, onRetake, onUse, onBack }: { lang: string; url: string | null; name: string; onRetake: () => void; onUse: () => void; onBack: () => void }) {
  return (
    <div className="screen">
      <TitleBar title={t(lang, "checkPhoto")} lang={lang} onBack={onBack} />
      <div className="photo">
        {url ? <img src={url} alt="" /> : <Icon name="doc" size={72} style={{ color: "#fff" }} />}
        <div className="frame" />
      </div>
      <h2 className="ttl" style={{ fontSize: 26, paddingTop: 16 }}>
        {t(lang, "canRead")}
      </h2>
      <p className="sub" style={{ paddingTop: 4, fontSize: 18 }}>
        {url ? t(lang, "canReadHint") : name}
      </p>
      <div className="row2" style={{ marginTop: "auto", paddingBottom: 28 }}>
        <button className="btn soft" style={{ flex: "0 0 38%" }} onClick={onRetake}>
          {t(lang, "retake")}
        </button>
        <button className="btn" onClick={onUse}>
          {t(lang, "useThis")}
        </button>
      </div>
    </div>
  );
}

/* ---------- 2b. page tray ---------- */
interface TrayProps {
  lang: string;
  items: TrayItem[];
  busy: boolean;
  tooMany: boolean;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onPapers?: () => void;
  onAdd: () => void;
  onRole: (id: number, r: Role) => void;
  onRemove: (id: number) => void;
  onMove: (id: number, d: -1 | 1) => void;
  onMake: () => void;
}
export function Tray({ lang, items, busy, tooMany, onLanguage, onSettings, onPapers, onAdd, onRole, onRemove, onMove, onMake }: TrayProps) {
  const n = items.length;
  // The paper kind only matters when there is more than one paper (it is "auto" otherwise).
  const showRoles = n > 1;
  return (
    <div className="screen cap-tray v4">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
      <h1 className="ttl">{t(lang, "yourPapers")}</h1>
      <p className="sub">{n === 1 ? t(lang, "camOnePage") : tf(lang, "camPages", { n })}</p>
      <ul className="tray">
        {items.map((it, i) => (
          <li className="item" key={it.id}>
            <div className="th">{it.url ? <img src={it.url} alt="" /> : <CIcon name="file" />}</div>
            <div className="meta">
              <b>
                {t(lang, "page")} {i + 1}
              </b>
              {showRoles && (
                <label className="tag">
                  <span className="sr">{t(lang, "paperKind")}</span>
                  {roleName(lang, it.role)}
                  <i />
                  <select value={it.role} onChange={(e) => onRole(it.id, e.target.value as Role)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleName(lang, r)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {n > 1 && (
              <div className="ctrls">
                <button onClick={() => onMove(it.id, -1)} disabled={i === 0} aria-label={t(lang, "moveUp")}>
                  <Icon name="up" />
                </button>
                <button onClick={() => onMove(it.id, 1)} disabled={i === n - 1} aria-label={t(lang, "moveDown")}>
                  <Icon name="down" />
                </button>
              </div>
            )}
            <button className="rm" onClick={() => onRemove(it.id)} aria-label={`${t(lang, "remove")} ${t(lang, "page")} ${i + 1}`}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
      <button className="tray-add" onClick={onAdd} disabled={n >= MAX_FILES}>
        <CIcon name="plus" />
        {t(lang, "addAnother")}
      </button>
      {tooMany && (
        <p className="banner" role="alert">
          {t(lang, "maxFiles")}
        </p>
      )}
      <div className="foot sticky">
        <button className="btn" onClick={onMake} disabled={n === 0 || busy}>
          {t(lang, "makeGuide")}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 3. making your guide (Figma 04a-c, 21a stop?, 21b went wrong) ---------- */
/** Each stage fills its own part of the one bar; [floor, cap] in percent, and the one status line. */
const READING_STAGES: Record<string, [number, number, string]> = {
  uploading: [2, 12, "rowRead"],
  extracting: [12, 40, "rowRead"],
  writing: [40, 70, "rowSimple"],
  illustrating: [70, 96, "gettingReady"],
  ready: [100, 100, "gettingReady"],
  failed: [60, 60, "gettingReady"],
};
export function Reading({ lang, status, onCancel, onRetry, onHome }: { lang: string; status: GuideStatus | "uploading"; onCancel?: () => void; onRetry?: () => void; onHome?: () => void }) {
  const [floor, cap, line] = READING_STAGES[status] ?? READING_STAGES.uploading;
  const [slow, setSlow] = useState(false);
  const [pct, setPct] = useState(floor);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 90000);
    return () => clearTimeout(timer);
  }, [status]);
  // One smooth bar: it jumps to the stage's start, then creeps towards the stage's end (never past it) until the next stage.
  useEffect(() => {
    setPct((p) => Math.max(p, floor));
    if (cap <= floor) return;
    const timer = setInterval(() => setPct((p) => Math.min(cap, p + Math.max(0.15, (cap - p) * 0.05))), 400);
    return () => clearInterval(timer);
  }, [floor, cap]);
  if (status === "failed")
    return (
      <div className="screen make-screen" role="alert">
        <div className="make-center">
          <div className="make-face">
            <img src="/guide-cartoon.jpg" alt="" />
            <span className="bad">
              <CIcon name="alert" />
            </span>
          </div>
          <h1>{t(lang, "wrongTitle")}</h1>
          <div className="make-bar bad" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="make-line">{t(lang, "wrongLine")}</p>
          <p className="make-hint">{t(lang, "wrongHint")}</p>
        </div>
        <div className="cap-foot">
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              <CIcon name="retry" />
              {t(lang, "retry")}
            </button>
          )}
          <button className="btn cap-ghost" onClick={onHome ?? onCancel}>
            <CIcon name="home" />
            {t(lang, "backHome")}
          </button>
        </div>
      </div>
    );
  return (
    <div className="screen make-screen" role="status" aria-live="polite">
      <div className="make-center">
        <div className="make-face">
          <img src="/guide-cartoon.jpg" alt="" />
        </div>
        <h1>{t(lang, "makingGuide")}</h1>
        <div className="make-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t(lang, line)}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="make-line" key={line}>
          {t(lang, line)}…
        </p>
        <p className="make-hint">{t(lang, "readingHint")}</p>
        {slow && (
          <p role="alert" className="make-hint">
            {t(lang, "readingSlow")}
          </p>
        )}
        <p className="make-card">{t(lang, "talkThrough")}</p>
      </div>
      <div className="cap-foot">
        {slow && onRetry && (
          <button className="btn" onClick={onRetry}>
            {t(lang, "retry")}
          </button>
        )}
        {onCancel && (
          <button className="cap-link" onClick={() => setAsking(true)}>
            {t(lang, "cancel")}
          </button>
        )}
      </div>
      {asking && onCancel && (
        <div className="stop-scrim" onClick={() => setAsking(false)}>
          <div className="stop-card" role="alertdialog" aria-modal="true" aria-labelledby="stop-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="stop-title">{t(lang, "stopTitle")}</h2>
            <p>{t(lang, "stopBody")}</p>
            <button className="btn" autoFocus onClick={() => setAsking(false)}>
              {t(lang, "keepGoing")}
            </button>
            <button className="btn cap-stop" onClick={onCancel}>
              {t(lang, "yesStop")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 10. couldn't read it / went wrong (Figma 21b) ---------- */
export function ErrorScreen({ lang, title, detail, canRetry, onRetry, onNewPhoto, onUpload, onBack, onSample }: { lang: string; title: string; detail: string | null; canRetry: boolean; onRetry: () => void; onNewPhoto: () => void; onUpload: () => void; onBack: () => void; onSample?: () => void }) {
  return (
    <div className="screen make-screen" role="alert">
      <div className="make-center">
        <div className="make-face">
          <img src="/guide-cartoon.jpg" alt="" />
          <span className="bad">
            <CIcon name="alert" />
          </span>
        </div>
        <h1>{title}</h1>
        <p className="make-hint">{detail ?? t(lang, "tryAgain")}</p>
        <div className="tips make-tips">
          <div>
            <Icon name="sun" />
            {t(lang, "tipLight")}
          </div>
          <div>
            <Icon name="frame" />
            {t(lang, "tipWhole")}
          </div>
          <div>
            <Icon name="flat" />
            {t(lang, "tipFlat")}
          </div>
        </div>
      </div>
      <div className="cap-foot">
        {onSample && (
          <button className="btn" onClick={onSample}>
            {t(lang, "sampleInhaler")}
          </button>
        )}
        {canRetry && !onSample && (
          <button className="btn" onClick={onRetry}>
            <CIcon name="retry" />
            {t(lang, "retry")}
          </button>
        )}
        <button className={"btn" + (canRetry || onSample ? " cap-ghost" : "")} onClick={onNewPhoto}>
          <CIcon name="camera" />
          {t(lang, "takeNew")}
        </button>
        <button className="btn cap-ghost" onClick={onUpload}>
          <CIcon name="image" />
          {t(lang, "choosePhoto")}
        </button>
        <button className="cap-link" onClick={onBack}>
          {t(lang, "backHome")}
        </button>
      </div>
    </div>
  );
}
