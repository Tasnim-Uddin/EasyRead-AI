import { useContext, useMemo, useState } from "react";
import type { Guide } from "../types";
import { t, tf } from "../i18n";
import { Num } from "../bidi";
import { languageLabel } from "../languages";
import Icon, { GuideFace } from "../icons";
import { NavContext } from "./shared";
import { buildQuestions } from "../extras/questions";
import { XIcon } from "../extras/icons";
import { CloseUpPic, hasCloseUp } from "../extras/closeup";
import "../extras/strings";
import "../extras/extras.css";

export { buildQuestions, type Question } from "../extras/questions";

/** The step that holds the answer, shown again after "Not quite": its close-up or picture, and its words. */
function StepAgain({ guide, index, lang, onClose }: { guide: Guide; index: number; lang: string; onClose: () => void }) {
  const s = guide.steps[index];
  if (!s) return null;
  const cu = hasCloseUp(s.visual?.id);
  return (
    <div className="x-again" role="region" aria-label={tf(lang, "stepN", { n: index + 1 })}>
      <small>{tf(lang, "stepN", { n: index + 1 })}</small>
      {cu ? (
        <div className="x-again-cu">
          <CloseUpPic id={s.visual?.id} playing />
        </div>
      ) : s.image_url ? (
        <img src={s.image_url} alt="" />
      ) : null}
      <p dir="auto">{s.text}</p>
      <button className="btn soft" onClick={onClose}>
        <XIcon name="check" />
        {t(lang, "xOkGotIt")}
      </button>
    </div>
  );
}

/* ---------- 24a-d Check I've got it ---------- */
export function TellBack({
  guide,
  lang,
  onCheck,
  onClose,
  onBack,
  onPapers,
}: {
  guide: Guide;
  lang: string;
  onCheck: (answer: string, correct: boolean) => void;
  /** Done (and the X): leave the check. */
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  onPapers?: () => void;
}) {
  const qs = useMemo(() => buildQuestions(guide, lang), [guide, lang]);
  const nav = useContext(NavContext);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [again, setAgain] = useState(false);
  const q = qs[qi];
  const finished = !q || results.length === qs.length && pick === null;
  const home = nav.onHome ?? onBack ?? onClose;

  if (finished) {
    const right = results.filter(Boolean).length;
    return (
      <div className="screen x-check x-check-end">
        <div className="x-check-top">
          <button className="round" onClick={home} aria-label={t(lang, "home")}>
            <Icon name="home" />
          </button>
        </div>
        <div className="x-got">
          <span className="x-got-face">
            <GuideFace />
            <i>
              <XIcon name="check" />
            </i>
          </span>
          <h1>{t(lang, qs.length && right < qs.length ? "xNearly" : "xGotIt")}</h1>
          {qs.length > 0 && <p>{tf(lang, "xGotNofM", { n: right, m: qs.length })}</p>}
        </div>
        <div className="x-bubble">
          <small>
            {t(lang, "xYourGuide")} · <bdi>{languageLabel(lang)}</bdi>
          </small>
          <p>{t(lang, qs.length && right < qs.length ? "xNearlyText" : "xGotItText")}</p>
        </div>
        {qs.length > 0 && (
          <div className="x-qdots">
            {qs.map((_, i) => (
              <span key={i} className={results[i] ? "ok" : "no"}>
                <i>
                  <XIcon name={results[i] ? "check" : "x"} />
                </i>
                <small>
                  Q<Num>{i + 1}</Num>
                </small>
              </span>
            ))}
          </div>
        )}
        <div className="foot">
          <button className="btn" onClick={onClose}>
            <XIcon name="check" />
            {t(lang, "xDone")}
          </button>
          {onPapers && (
            <button className="btn quiet" onClick={onPapers}>
              <XIcon name="doc" />
              {t(lang, "myGuides")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const answered = pick !== null;
  const right = pick === q.correct;
  function choose(i: number) {
    if (answered) return;
    setPick(i);
    const ok = i === q.correct;
    setResults((r) => [...r.slice(0, qi), ok]);
    onCheck(q.options[i], ok);
  }
  function next() {
    setPick(null);
    setAgain(false);
    if (qi < qs.length - 1) setQi(qi + 1);
  }

  return (
    <div className="screen x-check">
      <div className="x-check-top">
        <button className="round" onClick={home} aria-label={t(lang, "home")}>
          <Icon name="home" />
        </button>
        <h1>
          {t(lang, "xCheck")} · <Num>{qi + 1}</Num> {t(lang, "of")} <Num>{qs.length}</Num>
        </h1>
        <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="x-bars" aria-hidden="true">
        {qs.map((_, i) => (
          <i key={i} className={i <= qi ? "on" : ""} />
        ))}
      </div>
      <div className="x-ask-face">
        <GuideFace />
      </div>
      <div className="x-bubble" aria-live="polite">
        <small>
          {t(lang, answered ? "xGuideTalking" : "xGuideAsking")} · <bdi>{languageLabel(lang)}</bdi>
        </small>
        <p dir="auto">{!answered ? q.q : right ? `${t(lang, "tbRight")} ${q.options[q.correct]}` : t(lang, "xNotQuite")}</p>
      </div>
      <h3 className="x-q">{t(lang, answered ? "xYouPicked" : "xTapPicture")}</h3>
      <div className="x-answers" role="radiogroup" aria-label={q.q}>
        {q.options.map((o, i) => {
          const cls = !answered ? "" : i === q.correct ? " right" : i === pick ? " wrong" : " dim";
          return (
            <button key={i} role="radio" aria-checked={pick === i} className={"x-answer" + cls} onClick={() => choose(i)} disabled={answered && i !== pick && i !== q.correct}>
              <span className={"pic" + (hasCloseUp(q.visuals[i]) ? " cu" : "")}>
                {hasCloseUp(q.visuals[i]) ? <CloseUpPic id={q.visuals[i]} playing={!answered || i === q.correct} /> : <XIcon name={q.icons[i] ?? "doc"} />}
              </span>
              <span className="txt">
                <span dir="auto">{o}</span>
                {answered && i === q.correct && (
                  <em className="ok">
                    <XIcon name="check" />
                    {t(lang, i === pick ? "xRight" : "xRightAnswer")}
                  </em>
                )}
                {answered && i === pick && i !== q.correct && (
                  <em className="no">
                    <XIcon name="x" />
                    {t(lang, "xNotThisOne")}
                  </em>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {again && q.step !== null && <StepAgain guide={guide} index={q.step} lang={lang} onClose={() => setAgain(false)} />}
      <div className="foot">
        {answered && !right && q.step !== null && !again && (
          <button className="btn sage" onClick={() => setAgain(true)}>
            <XIcon name="eye" />
            {t(lang, "xShowStepAgain")}
          </button>
        )}
        {answered && (
          <button className="btn" onClick={next}>
            <Icon name="chevRight" />
            {t(lang, qi < qs.length - 1 ? "xNextQuestion" : "xSeeResult")}
          </button>
        )}
        {!answered && (
          <button className="btn quiet" onClick={onClose}>
            {t(lang, "skip")}
          </button>
        )}
      </div>
    </div>
  );
}
