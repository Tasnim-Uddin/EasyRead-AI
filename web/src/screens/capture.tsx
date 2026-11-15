import { useEffect, useState } from "react";
import type { GuideStatus } from "../types";
import { t } from "../i18n";
import Icon from "../icons";
import { MAX_FILES, TopBar, TitleBar } from "./shared";

export const ROLES = ["auto", "label", "leaflet", "device_photo", "letter", "form", "other"] as const;
export type Role = (typeof ROLES)[number];
export interface TrayItem {
  id: number;
  file: File;
  role: Role;
  url: string | null;
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
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
      <h1 className="ttl">{t(lang, "yourPapers")}</h1>
      <p className="sub">
        {n} {t(lang, n === 1 ? "item" : "items")} {t(lang, "itemsReady")}.
      </p>
      <ul className="tray">
        {items.map((it, i) => (
          <li className="item" key={it.id}>
            <div className="th">{it.url ? <img src={it.url} alt="" /> : <Icon name="doc" />}</div>
            <div className="meta">
              <b>
                {t(lang, "page")} {i + 1}
              </b>
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
            </div>
            <div className="ctrls">
              <button onClick={() => onMove(it.id, -1)} disabled={i === 0} aria-label={t(lang, "moveUp")}>
                <Icon name="up" />
              </button>
              <button onClick={() => onMove(it.id, 1)} disabled={i === n - 1} aria-label={t(lang, "moveDown")}>
                <Icon name="down" />
              </button>
            </div>
            <button className="round" onClick={() => onRemove(it.id)} aria-label={`${t(lang, "remove")} ${it.file.name}`}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
        <li>
          <button className="add" onClick={onAdd} disabled={n >= MAX_FILES}>
            <Icon name="plus" />
            {t(lang, "addAnother")}
          </button>
        </li>
      </ul>
      {tooMany ? (
        <p className="banner" role="alert">
          {t(lang, "maxFiles")}
        </p>
      ) : (
        n > 1 && (
          <p className="hint">
            <Icon name="up" />
            {t(lang, "reorderHint")}
          </p>
        )
      )}
      <div className="foot">
        <button className="btn" onClick={onMake} disabled={n === 0 || busy}>
          {t(lang, "makeGuide")}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 3. reading ---------- */
/** Each stage fills its own part of the one bar; [floor, cap] in percent. */
const READING_STAGES: Record<string, [number, number, string]> = {
  uploading: [2, 12, "rowRead"],
  extracting: [12, 40, "rowRead"],
  writing: [40, 70, "rowSimple"],
  illustrating: [70, 96, "gettingReady"],
  ready: [100, 100, "gettingReady"],
  failed: [100, 100, "gettingReady"],
};
export function Reading({ lang, status, onCancel, onRetry }: { lang: string; status: GuideStatus | "uploading"; onCancel?: () => void; onRetry?: () => void }) {
  const [floor, cap, line] = READING_STAGES[status] ?? READING_STAGES.uploading;
  const [slow, setSlow] = useState(false);
  const [pct, setPct] = useState(floor);
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
  return (
    <div className="screen" role="status" aria-live="polite">
      <div className="top">
        <div className="brand">
          <i />
          EasyRead
        </div>
      </div>
      <div className="center">
        <div className="paper">
          <div className="sheet b" />
          <div className="sheet" />
          <div className="sun" />
          {[60, 88, 116, 144, 172].map((top, i) => (
            <div key={top} className={"ln" + (i < 2 ? " on" : "")} style={{ top, width: [92, 110, 80, 104, 60][i] }} />
          ))}
        </div>
        <div className="load-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t(lang, line)}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <h2 className="load-line" key={line}>
          {t(lang, line)}…
        </h2>
        <p>{t(lang, "readingHint")}</p>
        {slow && <p role="alert">{t(lang, "readingSlow")}</p>}
      </div>
      <div className="foot">
        {slow && onRetry && (
          <button className="btn" onClick={onRetry}>
            {t(lang, "retry")}
          </button>
        )}
        {onCancel && (
          <button className="btn quiet" onClick={onCancel}>
            {t(lang, "cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 10. couldn't read it ---------- */
export function ErrorScreen({ lang, title, detail, canRetry, onRetry, onNewPhoto, onUpload, onBack, onSample }: { lang: string; title: string; detail: string | null; canRetry: boolean; onRetry: () => void; onNewPhoto: () => void; onUpload: () => void; onBack: () => void; onSample?: () => void }) {
  return (
    <div className="screen" role="alert">
      <TitleBar title="" lang={lang} onBack={onBack} />
      <div className="center">
        <div className="sorry">
          <Icon name="camera" />
        </div>
        <h2>{title}</h2>
        <p>{t(lang, "tryAgain")}</p>
        {detail && <div className="detail">{detail}</div>}
        <div className="tips">
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
      <div className="foot">
        {onSample && (
          <button className="btn" onClick={onSample}>
            {t(lang, "sampleInhaler")}
          </button>
        )}
        {canRetry && !onSample && (
          <button className="btn" onClick={onRetry}>
            {t(lang, "retry")}
          </button>
        )}
        <button className={"btn" + (canRetry ? " soft" : "")} onClick={onNewPhoto}>
          {t(lang, "takeNew")}
        </button>
        <button className="btn soft" onClick={onUpload}>
          {t(lang, "uploadInstead")}
        </button>
      </div>
    </div>
  );
}
