import { useMemo, useState } from "react";
import type { Guide } from "../types";
import { t, tf } from "../i18n";
import { Counter, T } from "../bidi";
import Icon from "../icons";
import { TitleBar } from "./shared";
import { kindOf } from "./summary";

/* ---------- 9. tell me back ---------- */
export interface Question {
  q: string;
  options: string[];
  correct: number;
  icons: string[];
}
export function buildQuestions(g: Guide, lang = "en"): Question[] {
  const T = (key: string) => t(lang, key);
  const k = kindOf(g);
  const out: Question[] = [];
  const mk = (q: string, correct: string, wrong: string[], pos: number): Question => {
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
    const options = wrong.map(cap);
    options.splice(Math.min(pos, options.length), 0, cap(correct));
    return { q, options, correct: options.indexOf(cap(correct)), icons: ["sun", "bulb", "hand"] };
  };
  const f = g.facts;
  const c = g.content;
  if (k === "medicine" && f?.frequency) out.push(mk(T("qWhen"), f.frequency, [T("dMorning"), T("dNight")].filter((x) => x !== f.frequency), 1));
  if (k === "medicine" && (f?.conflicts?.length ?? 0) > 0)
    out.push(mk(T("qConflict"), T("aPharm"), [T("dBigger"), T("dPick")], 1));
  else if (k === "medicine" && f?.dose) out.push(mk(T("qHowMuch"), f.dose, [T("dAsMuch"), T("dHalf")], 0));
  if (k === "letter" && c?.what_to_do?.[0]) out.push(mk(T("qLetterFirst"), c.what_to_do[0], [T("dIgnoreLetter"), T("dThrow")], 1));
  if (k === "letter" && c?.by_when?.[0]) out.push(mk(tf(lang, "qByWhen", { what: c.by_when[0].what }), c.by_when[0].date, [T("dNoDate"), T("dNextYear")], 2));
  if (k === "form" && c?.fields?.[0]) out.push(mk(tf(lang, "qBox", { label: c.fields[0].label }), c.fields[0].what_to_write, [T("dEmpty"), T("dAnything")], 0));
  if (k === "howto" && g.steps[0]) out.push(mk(T("qHowFirst"), g.steps[0].text, [T("dSkip"), T("dAskElse")], 1));
  const warn = g.steps.find((s) => s.kind === "warning");
  if (warn) out.push(mk(T("qWarn"), warn.text, [T("dNothing"), T("dIgnore")], 2));
  return out.slice(0, 3);
}

export function TellBack({ guide, lang, onCheck, onClose, onBack, backLabel }: { guide: Guide; lang: string; onCheck: (answer: string, correct: boolean) => void; onClose: () => void; onBack?: () => void; backLabel?: string }) {
  const qs = useMemo(() => buildQuestions(guide, lang), [guide, lang]);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const q = qs[qi];
  if (!q) {
    return (
      <div className="screen">
        <TitleBar title={t(lang, "tellBack")} lang={lang} onBack={onBack ?? onClose} backLabel={backLabel} />
        <p className="sub">{t(lang, "askExample")}</p>
        <div className="foot">
          <button className="btn" onClick={onClose}>{t(lang, "tbDone")}</button>
        </div>
      </div>
    );
  }
  const right = pick === q.correct;
  return (
    <div className="screen">
      <TitleBar title={t(lang, "tellBack")} lang={lang} onBack={onBack ?? onClose} backLabel={backLabel} />
      <div className="prog">
        <div className="bars">
          {qs.map((_, i) => (
            <button key={i} className={i <= qi ? "d" : ""} tabIndex={-1} aria-hidden="true" />
          ))}
        </div>
        <div className="of">
          <Counter lang={lang} n={qi + 1} total={qs.length} />
        </div>
      </div>
      <p className="sub">{t(lang, "notATest")}</p>
      <h1 className="qtitle">{q.q}</h1>
      <div className="choices" role="radiogroup" aria-label={q.q}>
        {q.options.map((o, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={pick === i}
            className={"choice" + (checked && i === q.correct ? " right" : pick === i ? " pick" : "")}
            onClick={() => !checked && setPick(i)}
          >
            <span className="pi">
              <Icon name={q.icons[i % q.icons.length]} />
            </span>
            {o}
          </button>
        ))}
      </div>
      {checked && (
        <div className={"check" + (right ? "" : " butter")} aria-live="polite">
          <Icon name={right ? "check" : "alert"} />
          {right ? t(lang, "tbRight") : `${t(lang, "tbWrong")} ${q.options[q.correct]}`}
        </div>
      )}
      <div className="foot">
        {!checked ? (
          <button
            className="btn"
            disabled={pick === null}
            onClick={() => {
              setChecked(true);
              onCheck(q.options[pick!], pick === q.correct);
            }}
          >
            {t(lang, "tbCheck")}
          </button>
        ) : null}
        {!checked ? (
          <button className="btn quiet" onClick={onClose}>
            {t(lang, "skip")}
          </button>
        ) : qi < qs.length - 1 ? (
          <button
            className="btn"
            onClick={() => {
              setQi(qi + 1);
              setPick(null);
              setChecked(false);
            }}
          >
            {t(lang, "tbNext")}
          </button>
        ) : (
          <button className="btn" onClick={onClose}>
            {t(lang, "tbDone")}
          </button>
        )}
      </div>
    </div>
  );
}
