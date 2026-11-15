import { useEffect, useMemo, useRef, useState } from "react";
import { t, tf } from "../i18n";
import Icon from "../icons";
import { XIcon } from "./icons";
import { buildChips, CHIP_ICON, chipKey, continueRow, getProgress, groupOf, groupRows, matches, rowTitle, type ChipKey, type GuideRow } from "./guides";
import "./strings";
import "./extras.css";

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today: the time. This week: the weekday. Earlier: the date. */
export function whenText(lang: string, iso: string | null | number, now = new Date()): string {
  if (iso === null) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const age = startOfDay(now) - startOfDay(d);
  const opts: Intl.DateTimeFormatOptions = age <= 0 ? { hour: "numeric", minute: "2-digit" } : age < 7 * DAY ? { weekday: "short" } : { day: "numeric", month: "short" };
  try {
    return new Intl.DateTimeFormat(lang, opts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

const CHIP_WORD: Record<ChipKey | "all", string> = {
  all: "xAll",
  medicine: "xMedicine",
  howto: "xHowTo",
  letter: "xLetters",
  bill: "xBills",
  form: "xForms",
  other: "xOther",
};
const ONE_WORD: Record<ChipKey, string> = { medicine: "xMedicine1", howto: "xHowTo1", letter: "xLetter1", bill: "xBill1", form: "xForm1", other: "xOther1" };

/* Browser speech recognition, where there is one (Chrome, Safari). Hidden otherwise. */
type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
function recognizer(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function Thumb({ row }: { row: GuideRow }) {
  const src = row.paper ?? row.thumbnail;
  return <span className="x-thumb">{src ? <img src={src} alt="" loading="lazy" /> : <XIcon name="doc" />}</span>;
}

function TypeChip({ lang, row }: { lang: string; row: GuideRow }) {
  const k = chipKey(row);
  return (
    <span className="x-type">
      <XIcon name={CHIP_ICON[k]} />
      {t(lang, ONE_WORD[k])}
    </span>
  );
}

function StatusLine({ lang, row }: { lang: string; row: GuideRow }) {
  const p = getProgress(row.id);
  const when = whenText(lang, row.created_at);
  if (row.status === "failed") return <small className="x-st bad">{t(lang, "paperFailed")}</small>;
  if (row.status !== "ready") return <small className="x-st wait">{t(lang, "paperDrawing")}</small>;
  return (
    <small className="x-st">
      {p?.done ? (
        <b className="done">
          <XIcon name="check" />
          {t(lang, "xDoneWord")}
        </b>
      ) : p ? (
        <b>{tf(lang, "xStepNofM", { n: p.step + 1, m: p.total })}</b>
      ) : row.steps ? (
        <span>{tf(lang, "xNSteps", { n: row.steps })}</span>
      ) : null}
      {when && (
        <>
          {(p || row.steps) && " · "}
          <bdi>{when}</bdi>
        </>
      )}
    </small>
  );
}

type Sheet = { kind: "menu" | "rename" | "delete"; row: GuideRow } | null;

interface Props {
  lang: string;
  rows: GuideRow[] | null; // null while loading
  failed: boolean;
  onBack: () => void;
  onOpen: (id: string, at?: number) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onRetry: () => void;
  onNew: () => void;
}

/** 14a-f My guides: search, type chips, Continue, Today / This week / Earlier, a menu per guide. */
export function MyGuides({ lang, rows, failed, onBack, onOpen, onDelete, onRename, onRetry, onNew }: Props) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<ChipKey | "all">("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);
  const Rec = useMemo(recognizer, []);
  const all = rows ?? [];
  const chips = useMemo(() => buildChips(all), [all]);
  const active = chips.some((c) => c.key === chip) ? chip : "all";
  const shown = all.filter((r) => (active === "all" || chipKey(r) === active) && matches(r, q));
  const groups = groupRows(shown);
  const cont = !q && active === "all" ? continueRow(all) : null;
  const cp = cont ? getProgress(cont.id) : null;
  const empty = !!rows && rows.length === 0;
  useEffect(() => () => recRef.current?.stop(), []);

  function listen() {
    if (!Rec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = lang;
    r.interimResults = true;
    r.onresult = (e) => setQ(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }

  const countText =
    active === "all" ? (all.length === 1 ? t(lang, "xOneGuide") : tf(lang, "xNGuides", { n: all.length })) : `${shown.length} ${t(lang, CHIP_WORD[active]).toLowerCase()}`;

  return (
    <div className="screen x-guides">
      <div className="x-gh">
        <div className="x-gh-top">
          <button className="round" onClick={onBack} aria-label={t(lang, "home")}>
            <Icon name="home" />
          </button>
          <h1>{t(lang, "myGuides")}</h1>
          {!empty && rows && (
            <span className="x-count">
              <bdi>{countText}</bdi>
            </span>
          )}
        </div>
        {!empty && (
          <label className="x-search">
            <XIcon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "xFindGuide")} aria-label={t(lang, "xFindGuide")} />
            {Rec && (
              <button type="button" className={"x-mic" + (listening ? " on" : "")} onClick={listen} aria-label={t(lang, "xSayIt")} aria-pressed={listening}>
                <XIcon name="mic" />
              </button>
            )}
          </label>
        )}
        {chips.length > 0 && (
          <div className="x-chips" role="radiogroup" aria-label={t(lang, "xFilter")}>
            {chips.map((c) => {
              const on = c.key === active;
              return (
                <button key={c.key} role="radio" aria-checked={on} className={"x-chip" + (on ? " on" : "")} onClick={() => setChip(c.key)}>
                  <XIcon name={on ? "check" : CHIP_ICON[c.key]} />
                  {t(lang, CHIP_WORD[c.key])}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
        <div className="x-empty">
          <span className="x-empty-ico">
            <XIcon name="doc" />
          </span>
          <h2>{t(lang, "papersEmptyTitle")}</h2>
          <p>{t(lang, "papersEmptyText")}</p>
        </div>
      )}

      {cont && cp && (
        <section className="x-continue" aria-label={t(lang, "xContinueWhere")}>
          <small>{t(lang, "xContinueWhere")}</small>
          <div className="x-cont-row">
            <Thumb row={cont} />
            <div className="x-cont-meta">
              <b dir="auto">{rowTitle(cont) || t(lang, "yourPaper")}</b>
              <span>
                {tf(lang, "xStepNofM", { n: cp.step + 1, m: cp.total })} · <bdi>{whenText(lang, cp.at)}</bdi>
              </span>
              <span className="x-dots" aria-hidden="true">
                {Array.from({ length: Math.min(cp.total, 12) }, (_, i) => (
                  <i key={i} className={i <= Math.round((cp.step / Math.max(1, cp.total - 1)) * (Math.min(cp.total, 12) - 1)) ? "on" : ""} />
                ))}
              </span>
            </div>
          </div>
          <button className="btn x-cont-btn" onClick={() => onOpen(cont.id, cp.step)}>
            <Icon name="chevRight" />
            {t(lang, "xContinue")}
          </button>
        </section>
      )}

      {rows && !empty && shown.length === 0 && <p className="x-hint">{t(lang, "xNoGuideFound")}</p>}

      {groups.map((g) => (
        <section key={g.key} className="x-group" aria-label={t(lang, g.key)}>
          <h2>{t(lang, g.key)}</h2>
          <ul>
            {g.rows.map((r) => {
              const title = rowTitle(r) || t(lang, "yourPaper");
              return (
                <li key={r.id} className="x-card">
                  <button className="x-card-open" onClick={() => onOpen(r.id)}>
                    <Thumb row={r} />
                    <span className="x-card-meta">
                      <b dir="auto">{title}</b>
                      <TypeChip lang={lang} row={r} />
                      <StatusLine lang={lang} row={r} />
                    </span>
                  </button>
                  <button className="x-more" onClick={() => setSheet({ kind: "menu", row: r })} aria-label={`${t(lang, "xMore")}: ${title}`}>
                    <XIcon name="more" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {rows && rows.length > 0 && (
        <p className="help x-private">
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

      {sheet && (
        <div className="x-scrim" onClick={() => setSheet(null)}>
          <div className="x-sheet" role="dialog" aria-modal="true" aria-label={rowTitle(sheet.row)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && setSheet(null)}>
            <span className="x-grab" aria-hidden="true" />
            {sheet.kind === "menu" && (
              <>
                <h2 className="x-sheet-title" dir="auto">
                  {rowTitle(sheet.row) || t(lang, "yourPaper")}
                </h2>
                <button className="x-menu-item" onClick={() => { setSheet(null); onOpen(sheet.row.id); }}>
                  <Icon name="chevRight" />
                  {t(lang, "xOpen")}
                </button>
                {onRename && (
                  <button className="x-menu-item" onClick={() => { setName(rowTitle(sheet.row)); setSheet({ kind: "rename", row: sheet.row }); }}>
                    <XIcon name="pencil" />
                    {t(lang, "xRename")}
                  </button>
                )}
                <button className="x-menu-item danger" onClick={() => setSheet({ kind: "delete", row: sheet.row })}>
                  <XIcon name="trash" />
                  {t(lang, "xDeleteWord")}
                </button>
                <button className="x-link" onClick={() => setSheet(null)}>
                  {t(lang, "xCancel")}
                </button>
              </>
            )}
            {sheet.kind === "rename" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = name.trim();
                  if (v && onRename) onRename(sheet.row.id, v);
                  setSheet(null);
                }}
              >
                <h2 className="x-sheet-title">{t(lang, "xRename")}</h2>
                <input className="x-input" autoFocus value={name} maxLength={80} dir="auto" onChange={(e) => setName(e.target.value)} aria-label={t(lang, "xNewName")} />
                <button className="btn x-mt" type="submit" disabled={!name.trim()}>
                  <XIcon name="check" />
                  {t(lang, "xSave")}
                </button>
                <button type="button" className="x-link" onClick={() => setSheet(null)}>
                  {t(lang, "xCancel")}
                </button>
              </form>
            )}
            {sheet.kind === "delete" && (
              <div className="x-del-ask">
                <span className="x-del-ico">
                  <XIcon name="trash" />
                </span>
                <h2 className="x-sheet-title">{t(lang, "xDeleteThisAsk")}</h2>
                <p dir="auto">“{rowTitle(sheet.row) || t(lang, "yourPaper")}”</p>
                <p>{t(lang, "xCannotUndo")}</p>
                <button className="btn x-danger-solid x-mt" onClick={() => { const id = sheet.row.id; setSheet(null); onDelete(id); }}>
                  <XIcon name="trash" />
                  {t(lang, "xYesDelete")}
                </button>
                <button className="btn quiet x-mt-s" onClick={() => setSheet(null)}>
                  {t(lang, "xKeep")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Home (01): the two newest guides and See all. */
export function RecentGuides({ lang, rows, onOpen, onAll }: { lang: string; rows: GuideRow[] | null; onOpen: (id: string) => void; onAll: () => void }) {
  if (!rows || rows.length === 0) return null;
  const top = groupRows(rows).flatMap((g) => g.rows).slice(0, 2);
  return (
    <section className="x-recent" aria-label={t(lang, "myGuides")}>
      <div className="x-recent-head">
        <h2>{t(lang, "myGuides")}</h2>
        <button className="x-seeall" onClick={onAll}>
          {t(lang, "xSeeAll")}
          <Icon name="chevRight" />
        </button>
      </div>
      {top.map((r) => (
        <button key={r.id} className="x-recent-row" onClick={() => onOpen(r.id)}>
          <span className="ico">
            <XIcon name={CHIP_ICON[chipKey(r)]} />
          </span>
          <span className="meta">
            <b dir="auto">{rowTitle(r) || t(lang, "yourPaper")}</b>
            <small>
              <bdi>{groupOf(r.created_at) === "today" ? t(lang, "today") : whenText(lang, r.created_at)}</bdi>
              {r.steps ? <> · {tf(lang, "xNSteps", { n: r.steps })}</> : null}
            </small>
          </span>
          <Icon name="chevRight" />
        </button>
      ))}
    </section>
  );
}
