import { useEffect, useMemo, useState } from "react";
import type { Guide, GuideStatus } from "../types";
import { t } from "../i18n";
import { languageLabel } from "../languages";
import Icon from "../icons";
import { TitleBar } from "./shared";

/** The pictures of the user's own paper: uploads from the server, or the sample's input images. */
const SAMPLE_INPUTS: Record<string, string[]> = {
  inhaler: ["/samples/inhaler_label.png", "/samples/inhaler_leaflet.png", "/samples/inhaler_device.png"],
  council_letter: ["/samples/council_letter.png"],
  flatpack: ["/samples/flatpack.png"],
};
export function paperImages(g: Guide): string[] {
  const src = g.source;
  const urls = [...(src.documents ?? []).map((d) => d.image_url), ...(src.image_urls ?? []), src.device_photo_url ?? null].filter(
    (u): u is string => !!u,
  );
  if (urls.length) return Array.from(new Set(urls));
  const m = g.id.match(/^g_sample_(inhaler|council_letter|flatpack)/);
  return m ? SAMPLE_INPUTS[m[1]] : [];
}
export function PaperViewer({ lang, urls, onClose }: { lang: string; urls: string[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="paper-viewer" role="dialog" aria-modal="true" aria-label={t(lang, "seePaper")}>
      <div className="pv-head">
        <b>{t(lang, "seePaper")}</b>
        <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="pv-body">
        {urls.map((u) => (
          <img key={u} src={u} alt="" />
        ))}
      </div>
    </div>
  );
}

/* ---------- 12. my guides (this device's guides only) ---------- */
function paperStatus(st: GuideStatus): { key: string; cls: string } {
  if (st === "ready") return { key: "paperReady", cls: "ok" };
  if (st === "failed") return { key: "paperFailed", cls: "bad" };
  return { key: "paperDrawing", cls: "wait" };
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today: the time. This week: the weekday. Earlier: the date. */
function paperDate(lang: string, iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const age = startOfDay(now) - startOfDay(d);
  const opts: Intl.DateTimeFormatOptions =
    age <= 0 ? { hour: "numeric", minute: "2-digit" } : age < 7 * DAY ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" };
  try {
    return new Intl.DateTimeFormat(lang, opts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** "today" | "thisWeek" | "earlier" (the i18n keys of the group headings). */
export function paperGroup(iso: string | null, now = new Date()): "today" | "thisWeek" | "earlier" {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "earlier";
  const age = startOfDay(now) - startOfDay(d);
  return age <= 0 ? "today" : age < 7 * DAY ? "thisWeek" : "earlier";
}

export interface PaperRow {
  id: string;
  title: string;
  language: string;
  created_at: string | null;
  status: GuideStatus;
  thumbnail: string | null;
}

/** One paper: thumbnail, title, language and date. The trash button only shows on My guides. */
function PaperCard({ lang, row, onOpen, onDelete }: { lang: string; row: PaperRow; onOpen: (id: string) => void; onDelete?: () => void }) {
  const st = paperStatus(row.status);
  const title = row.title || t(lang, "yourPaper");
  return (
    <div className="paper-card">
      <button className="open" onClick={() => onOpen(row.id)}>
        <span className="th">{row.thumbnail ? <img src={row.thumbnail} alt="" /> : <Icon name="file" />}</span>
        <span className="meta">
          <b dir="auto">{title}</b>
          <small>
            <Icon name="globe" />
            <bdi>{languageLabel(row.language)}</bdi>
            {row.created_at && (
              <>
                {" · "}
                <bdi>{paperDate(lang, row.created_at)}</bdi>
              </>
            )}
          </small>
          {row.status !== "ready" && <span className={"pstat " + st.cls}>{t(lang, st.key)}</span>}
        </span>
        {!onDelete && (
          <span className="chev">
            <Icon name="chevRight" />
          </span>
        )}
      </button>
      {onDelete && (
        <button className="icon-btn ghost" onClick={onDelete} aria-label={`${t(lang, "deletePaper")}: ${title}`}>
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}

interface PapersProps {
  lang: string;
  rows: PaperRow[] | null; // null while loading
  failed: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
  onNew: () => void;
}
export function MyPapers({ lang, rows, failed, onBack, onOpen, onDelete, onRetry, onNew }: PapersProps) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const groups = useMemo(() => {
    const out: { key: string; rows: PaperRow[] }[] = [];
    for (const r of rows ?? []) {
      const key = paperGroup(r.created_at);
      const g = out.find((x) => x.key === key);
      if (g) g.rows.push(r);
      else out.push({ key, rows: [r] });
    }
    return out;
  }, [rows]);
  const empty = !!rows && rows.length === 0;
  return (
    <div className="screen papers">
      <TitleBar title={t(lang, "myGuides")} lang={lang} onBack={onBack} />
      {!empty && <p className="sub">{t(lang, "papersTap")}</p>}
      {failed && (
        <div className="banner" role="alert">
          <p>{t(lang, "papersLoadFailed")}</p>
          <button className="btn soft" onClick={onRetry}>
            {t(lang, "papersRetry")}
          </button>
        </div>
      )}
      {rows === null && !failed && (
        <p className="sub" role="status">
          {t(lang, "papersLoading")}…
        </p>
      )}
      {empty && (
        <div className="papers-empty">
          <span className="empty-ico">
            <Icon name="file" />
          </span>
          <h2>{t(lang, "papersEmptyTitle")}</h2>
          <p>{t(lang, "papersEmptyText")}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} className="pgroup" aria-label={t(lang, g.key)}>
          <h2 className="group">{t(lang, g.key)}</h2>
          <ul>
            {g.rows.map((r) => {
              const title = r.title || t(lang, "yourPaper");
              return (
                <li key={r.id}>
                  {confirm === r.id ? (
                    <div className="paper-card confirm" role="group" aria-label={t(lang, "deleteAsk")}>
                      <b>{t(lang, "deleteAsk")}</b>
                      <small dir="auto">{title}</small>
                      <div className="pair">
                        <button className="btn soft" onClick={() => setConfirm(null)}>
                          {t(lang, "deleteKeep")}
                        </button>
                        <button className="btn danger" onClick={() => { setConfirm(null); onDelete(r.id); }}>
                          <Icon name="trash" />
                          {t(lang, "deleteYes")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PaperCard lang={lang} row={r} onOpen={onOpen} onDelete={() => setConfirm(r.id)} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {rows && rows.length > 0 && (
        <p className="help">
          <Icon name="lock" />
          {t(lang, "papersPrivate")}
        </p>
      )}
      <div className="foot sticky">
        <button className="btn" onClick={onNew}>
          <Icon name="camera" />
          {t(lang, empty ? "takePhoto" : "newPaper")}
        </button>
      </div>
    </div>
  );
}
