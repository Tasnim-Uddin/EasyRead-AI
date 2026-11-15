import { useEffect, useMemo, useState } from "react";
import type { Guide } from "../types";
import { t, tf } from "../i18n";
import { XIcon } from "./icons";
import { buildIcs, datesFor, dayDate, eventDetails, googleCalendarLink, minusDays, openIcs } from "./ics";
import { on, openShare } from "./bus";
import "./strings";
import "./extras.css";

export function fmtDay(lang: string, date: string, long = false): string {
  try {
    return new Intl.DateTimeFormat(lang, long ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" }).format(dayDate(date));
  } catch {
    return date;
  }
}
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Remind me (25a) and Reminder ready (25b), as a bottom sheet. */
export function RemindMe({ guide, lang, dateIndex = 0, onClose }: { guide: Guide; lang: string; dateIndex?: number; onClose: () => void }) {
  const dates = useMemo(() => datesFor(guide), [guide]);
  // dateIndex points into guide.dates; datesFor drops passed dates, so find the same entry by identity.
  const raw = guide.dates?.[dateIndex];
  const d = (raw && dates.find((x) => x === raw)) ?? dates[dateIndex] ?? dates[0];
  const today = todayIso();
  const choices = useMemo(() => {
    if (!d) return [];
    const c = [1, 3].filter((n) => minusDays(d.date, n) >= today);
    return c.length ? c : [0];
  }, [d, today]);
  const [pick, setPick] = useState(choices[0] ?? 1);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!d) return null;
  const what = d.what || d.what_en;
  const details = eventDetails(guide, lang, t(lang, "xContact"));
  const remindOn = minusDays(d.date, pick);
  const google = googleCalendarLink({ what, date: d.date, time: d.time, details });

  function add() {
    openIcs(buildIcs({ uid: `${guide.id}-${d.date}-${pick}@easyread`, what, date: d.date, time: d.time, description: details, alarmsDaysBefore: [pick] }), "easyread-reminder.ics");
    setDone(true);
  }
  const label = (n: number) => t(lang, n === 0 ? "xOnTheDay" : n === 1 ? "xDayBefore" : "x3DaysBefore");

  return (
    <div className="x-scrim" onClick={onClose}>
      <div className="x-sheet" role="dialog" aria-modal="true" aria-label={t(lang, "xRemindMe")} onClick={(e) => e.stopPropagation()}>
        <span className="x-grab" aria-hidden="true" />
        {!done ? (
          <>
            <div className="x-sheet-head">
              <span className="x-ico-round">
                <XIcon name="bell" />
              </span>
              <h2>{t(lang, "xRemindMe")}</h2>
              <button className="round x-close" onClick={onClose} aria-label={t(lang, "close")}>
                <XIcon name="x" />
              </button>
            </div>
            <div className="x-date-card">
              <span className="x-cal">
                <XIcon name="calendar" />
              </span>
              <div>
                <b dir="auto">{what}</b>
                <small>
                  {t(lang, "xBy")} <bdi>{fmtDay(lang, d.date, true)}</bdi>
                  {d.time && (
                    <>
                      {" · "}
                      <bdi>{d.time}</bdi>
                    </>
                  )}
                </small>
              </div>
            </div>
            <h3 className="x-q">{t(lang, "xWhenRemind")}</h3>
            <div className="x-radios" role="radiogroup" aria-label={t(lang, "xWhenRemind")}>
              {choices.map((n) => (
                <button key={n} role="radio" aria-checked={pick === n} className={"x-radio" + (pick === n ? " on" : "")} onClick={() => setPick(n)}>
                  <span className="x-dot" aria-hidden="true">
                    {pick === n && <XIcon name="check" />}
                  </span>
                  <span className="x-txt">
                    <b>{label(n)}</b>
                    <small>
                      <bdi>{fmtDay(lang, minusDays(d.date, n))}</bdi>
                    </small>
                  </span>
                  {pick === n && <span className="x-chosen">{t(lang, "xChosen")}</span>}
                </button>
              ))}
            </div>
            <button className="btn x-mt" onClick={add}>
              <XIcon name="calendar" />
              {t(lang, "xAddCalendar")}
            </button>
            <a className="btn quiet x-mt-s" href={google} target="_blank" rel="noopener noreferrer" onClick={() => setDone(true)}>
              {t(lang, "xGoogleCal")}
            </a>
            <button className="x-link" onClick={onClose}>
              {t(lang, "xNotNow")}
            </button>
          </>
        ) : (
          <div className="x-done" aria-live="polite">
            <span className="x-done-ico">
              <XIcon name="bell" />
              <i>
                <XIcon name="check" />
              </i>
            </span>
            <h2>{t(lang, "xReminderSet")}</h2>
            <p>{tf(lang, "xWillRemind", { day: fmtDay(lang, remindOn) })}</p>
            <span className="x-pill-sage">
              <XIcon name="calendar" />
              {t(lang, "xAddedCalendar")}
            </span>
            <button className="btn x-mt" onClick={onClose}>
              <XIcon name="check" />
              {t(lang, "xOk")}
            </button>
            <button
              className="btn quiet x-mt-s"
              onClick={() => {
                onClose();
                openShare(guide);
              }}
            >
              <XIcon name="share" />
              {t(lang, "xSaveShareGuide")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mount once (App): shows the Remind me sheet whenever openRemindMe(guide, i) is called. */
export function RemindMeHost({ lang }: { lang: string }) {
  const [open, setOpen] = useState<{ guide: Guide; dateIndex: number } | null>(null);
  useEffect(() => on("remind", setOpen), []);
  if (!open) return null;
  return <RemindMe guide={open.guide} lang={lang} dateIndex={open.dateIndex} onClose={() => setOpen(null)} />;
}

/** True when the guide has a date the user can be reminded about. */
export const hasDates = (g: Guide) => datesFor(g).length > 0;
