import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Guide, Highlight, Step } from "../types";
import { t, tf } from "../i18n";
import { findWorld, languageLabel } from "../languages";
import Icon from "../icons";
import * as api from "../api";
import { speak, stopSpeaking } from "../speech";
import { CloseUp, hasCloseUp } from "../closeups";
import type { useAnam } from "../useAnam";
import { prefersReducedMotion } from "../motion";
import { avatarBig, initialStage, stageReducer, tailCaption, whoToAsk, type Phase, type StageEvent } from "./machine";
import { SHOW_CHECK } from "./config";
import "./micStrings";
import { chooseVisual, conflictStepIndex, dateIndexFor, maxScaleFor, planHighlight, primaryHighlight, type StepVisual } from "./visual";
import { openRemindMe, openShare } from "../extras/bus";
import { ConflictCard } from "../extras/ConflictCard";
import { TextSizeSheet } from "../extras/TextSize";
import { hasDates } from "../extras/RemindMe";
import "./strings";
import "./stage.css";

export type AnamApi = ReturnType<typeof useAnam>;

export interface AskInfo {
  seq: number;
  grounded: boolean;
  askWho: string | null;
}

export interface GuideStageProps {
  guide: Guide;
  index: number;
  lang: string;
  anam: AnamApi;
  /** The live session is up (or faked for screenshots). */
  live: boolean;
  readMode: boolean;
  /** Read mode was switched on because the guide could not connect (19a). */
  cantConnect: boolean;
  /** Sound for read-aloud answers when the guide is not live (Settings voice). */
  voice: boolean;
  /** Set by the app whenever the avatar's answer_from_document tool returns. */
  askInfo: AskInfo | null;
  /** +1 each time the avatar moves the steps with a tool (even to the same step, e.g. show_step 0 from the intro). */
  moveSeq?: number;
  startPhase?: Phase;
  onIndex: (i: number) => void;
  onReadMode: (on: boolean) => void;
  onTryAgain: () => void;
  onHome: () => void;
  onPapers: () => void;
  onCheck: () => void;
  /** Text size (Aa in the guide controls). */
  scale?: number;
  onScale?: (v: number) => void;
}

/** What the guide is told after each step: say it, then stop (no "Ready to move on?" check-in). */
const THEN_WAIT = `Then stop talking and wait. Do not ask if they are ready or if they have questions: the screen shows Back, Next, Speak and Type.`;

function stepTitle(s: Step | undefined) {
  return s?.text ?? "";
}
function stepBody(s: Step | undefined) {
  if (!s?.say) return "";
  return s.say.trim() === s.text.trim() ? "" : s.say;
}

/* ---------------------------------------------------------------- icons not in the shared set */
function KbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="gs-ico" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h.01M18 14h.01M9 14h6" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="gs-ico" aria-hidden="true">
      <path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1z" />
      <path d="M12 6.5V20" />
    </svg>
  );
}
function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="gs-ico" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 8.5a5 5 0 010 7" />
    </svg>
  );
}
function SlowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="gs-ico" aria-hidden="true">
      <path d="M4 16a8 8 0 0116 0" />
      <path d="M12 16l-3.5-4.5" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="gs-ico" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0011.2 4.5M18.5 11v0M12 17.5V21M8.5 21h7" />
      <path d="M3.5 3.5l17 17" />
    </svg>
  );
}
function Chev({ back }: { back?: boolean }) {
  return <Icon name={back ? "back" : "chevRight"} className="gs-chev" />;
}

function Talking({ on, small }: { on: boolean; small?: boolean }) {
  return (
    <span className={"gs-talk" + (on ? " on" : "") + (small ? " sm" : "")} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Toggle({ on, label, icon, onClick, disabled }: { on: boolean; label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="gs-toggle" role="switch" aria-checked={on} onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
      <span className={"gs-sw" + (on ? " on" : "")} />
    </button>
  );
}

/* ---------------------------------------------------------------- the step visual */
type CalloutT = { value: string; sub?: string };
/** The big number/date card. When the step has a date, tapping it opens Remind me. */
const CalloutCard = forwardRef<HTMLElement, { c: CalloutT; on: boolean; onRemind?: () => void }>(function CalloutCard({ c, on, onRemind }, ref) {
  const inner = (
    <>
      <b>{c.value}</b>
      {c.sub && <span>{c.sub}</span>}
    </>
  );
  return onRemind ? (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" className={"gs-callout tap" + (on ? " on" : "")} dir="auto" onClick={onRemind}>
      {inner}
    </button>
  ) : (
    <div ref={ref as React.Ref<HTMLDivElement>} className={"gs-callout" + (on ? " on" : "")} dir="auto">
      {inner}
    </div>
  );
});
/** The guide's circle sits in the stage's top corner in guide mode (88px + 12px margin). */
const CIRCLE_RESERVE = 108;
/** The Remind me chip at the bottom (44px + 12px margin). */
const REMIND_RESERVE = 64;
function HighlightPhoto({ url, highlights, callout, playing, circle, onRemind }: { url: string; highlights: Highlight[]; callout: { value: string; sub?: string } | null; playing: boolean; circle: boolean; onRemind?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const card = useRef<HTMLElement>(null);
  const markerId = "gs-head-" + useId().replace(/:/g, "");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [natW, setNatW] = useState(0);
  const [cardRect, setCardRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // A photo already in the cache may finish loading before the handler is attached.
  const onImg = useCallback(() => {
    const im = img.current;
    if (im && im.complete && im.naturalWidth > 0) {
      setAspect(im.naturalWidth / Math.max(1, im.naturalHeight));
      setNatW(im.naturalWidth);
    }
  }, []);
  useLayoutEffect(onImg, [url, onImg]);
  useLayoutEffect(() => {
    const c = card.current;
    setCardRect(c ? { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight } : null);
  }, [callout?.value, callout?.sub, size?.w, size?.h]);
  useEffect(() => {
    if (!aspect) return;
    const tm = setTimeout(() => setZoomed(true), prefersReducedMotion() ? 0 : 250);
    return () => clearTimeout(tm);
  }, [aspect]);
  const primary = useMemo(() => primaryHighlight(highlights, callout), [highlights, callout]);
  const plan =
    size && aspect && size.w > 0 && size.h > 0
      ? planHighlight({
          highlights,
          primary,
          cw: size.w,
          ch: size.h,
          imgAspect: aspect,
          reserveTop: Math.max(circle ? CIRCLE_RESERVE : 0, cardRect ? cardRect.y + cardRect.h + 8 : 0),
          reserveBottom: onRemind ? REMIND_RESERVE : 0,
          callout: callout ? cardRect : null,
          maxScale: maxScaleFor(natW, size.w),
        })
      : null;
  const tr = plan && zoomed ? `translate(${plan.tx}px, ${plan.ty}px) scale(${plan.scale})` : "none";
  const show = !!plan && zoomed;
  return (
    <div className="gs-photo" ref={box}>
      <div className="gs-photo-in" style={{ width: plan ? plan.iw : "100%", height: plan ? plan.ih : undefined, transform: tr }}>
        <img ref={img} src={url} alt="" onLoad={onImg} />
      </div>
      {plan && (
        <svg className={"gs-mark" + (show ? " on" : "")} width={size!.w} height={size!.h} aria-hidden="true">
          <defs>
            <marker id={markerId} markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" refX="15" refY="9" orient="auto">
              <path d="M0,0 L18,9 L0,18 z" fill="var(--warn-accent)" stroke="none" />
            </marker>
          </defs>
          {plan.polys.map((q, i) => (
            <polygon key={i} className={"gs-box" + (i === plan.primary ? " main" : "")} points={q.map(([x, y]) => `${x},${y}`).join(" ")} />
          ))}
          {plan.arrow && <line className="gs-arrow-line" x1={plan.arrow.x1} y1={plan.arrow.y1} x2={plan.arrow.x2} y2={plan.arrow.y2} markerEnd={`url(#${markerId})`} />}
        </svg>
      )}
      {callout && <CalloutCard ref={card} c={callout} on={zoomed} onRemind={onRemind} />}
      {!playing && <span className="sr">paused</span>}
    </div>
  );
}

const KIND_ICON: Record<string, string> = { what: "doc", when: "sun", how: "hand", warning: "alert", get_help: "alert" };

function StepVisualView({ v, step, playing, circle = false, onRemind }: { v: StepVisual; step: Step; playing: boolean; circle?: boolean; onRemind?: () => void }) {
  if (v.kind === "closeup")
    return (
      <div className="gs-closeup">
        <CloseUp id={v.id} playing={playing} />
        {v.callout && <CalloutCard c={v.callout} on onRemind={onRemind} />}
      </div>
    );
  if (v.kind === "highlight") return <HighlightPhoto url={v.url} highlights={v.highlights} callout={v.callout} playing={playing} circle={circle} onRemind={onRemind} />;
  // A still picture drifts gently (Ken Burns) so nothing on the stage is dead still; paused with the guide.
  if (v.kind === "image") return <img className={"gs-img gs-kb" + (playing ? "" : " still")} src={v.url} alt="" />;
  return (
    <div className={"gs-textonly" + (step.kind === "warning" || step.kind === "get_help" ? " warn" : "")}>
      <Icon name={KIND_ICON[step.kind] ?? "doc"} />
    </div>
  );
}

function RemindChip({ lang, onClick }: { lang: string; onClick: () => void }) {
  return (
    <button type="button" className="gs-remind" onClick={onClick}>
      <Icon name="sun" />
      {t(lang, "gs_remind")}
    </button>
  );
}

/* ---------------------------------------------------------------- sheets */
function AllSteps({ guide, index, lang, onPick, onClose }: { guide: Guide; index: number; lang: string; onPick: (i: number) => void; onClose: () => void }) {
  const total = guide.steps.length;
  return (
    <div className="gs-sheet-wrap" role="dialog" aria-modal="true" aria-label={t(lang, "gs_allSteps")} onClick={onClose}>
      <div className="gs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gs-grab" />
        <div className="gs-sheet-head">
          <div>
            <h2>{t(lang, "gs_allSteps")}</h2>
            <p>{tf(lang, "gs_youAreOn", { n: index + 1, m: total })}</p>
          </div>
          <button className="gs-round" onClick={onClose} aria-label={t(lang, "gs_close")}>
            <Icon name="x" />
          </button>
        </div>
        <ol className="gs-steplist">
          {guide.steps.map((s, i) => (
            <li key={s.index}>
              <button className={i === index ? "now" : i < index ? "done" : ""} onClick={() => onPick(i)} aria-current={i === index ? "step" : undefined}>
                <span className="n">{i < index ? <Icon name="check" /> : i + 1}</span>
                <span className="tx" dir="auto">{s.text}</span>
                {i < index && <small className="gs-tag d">{t(lang, "gs_doneTag")}</small>}
                {i === index && <small className="gs-tag n">{t(lang, "gs_nowTag")}</small>}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Controls({ lang, slow, paused, onAgain, onSlow, onPause, onTextSize, onClose }: { lang: string; slow: boolean; paused: boolean; onAgain: () => void; onSlow: () => void; onPause: () => void; onTextSize?: () => void; onClose: () => void }) {
  return (
    <div className="gs-sheet-wrap" role="dialog" aria-modal="true" aria-label={t(lang, "gs_controls")} onClick={onClose}>
      <div className="gs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gs-grab" />
        <div className="gs-sheet-head">
          <h2>{t(lang, "gs_controls")}</h2>
          {onTextSize && (
            <button className="gs-aa" onClick={onTextSize} aria-label={t(lang, "gs_textSize")}>
              Aa
            </button>
          )}
        </div>
        <div className="gs-ctl">
          <button onClick={onAgain}>
            <Icon name="history" />
            <span>{t(lang, "gs_sayAgain")}</span>
          </button>
          <button onClick={onSlow}>
            <SlowIcon />
            <span>{t(lang, "gs_slower")}</span>
            <small>{t(lang, slow ? "gs_nowSlower" : "gs_nowNormal")}</small>
          </button>
          <button onClick={onPause}>
            <Icon name={paused ? "play" : "pause"} />
            <span>{t(lang, paused ? "gs_carryOn" : "gs_pause")}</span>
          </button>
        </div>
        <button className="gs-btn ghost" onClick={onClose}>
          <Icon name="x" />
          {t(lang, "gs_close")}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- browser speech recognition (no avatar) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;
function recognizer(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ---------------------------------------------------------------- the stage */
export function GuideStage(p: GuideStageProps) {
  const { guide, lang, anam, live, readMode } = p;
  const total = guide.steps.length;
  const [s, dispatch] = useReducer(stageReducer, undefined, () => initialStage(total, p.index, p.startPhase ?? (p.index > 0 ? "step" : "intro")));
  const sRef = useRef(s);
  sRef.current = s;
  const step = guide.steps[s.index];
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [sheet, setSheet] = useState<"none" | "steps" | "controls" | "text">("none");
  // "Your two papers say different things" (27a): shown once, before the step it is about.
  const conflictAt = useMemo(() => conflictStepIndex(guide), [guide]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const conflictSeen = useRef(false);
  const dateIdx = useMemo(() => dateIndexFor(guide.steps[s.index], guide), [guide, s.index]);
  const onRemind = dateIdx >= 0 ? () => openRemindMe(guide, dateIdx) : undefined;
  const [typed, setTyped] = useState("");
  const [goingBack, setGoingBack] = useState(false);
  const [recUser, setRecUser] = useState(""); // browser speech recognition (no avatar)
  const recRef = useRef<Rec>(null);
  const langName = languageLabel(lang);

  useEffect(() => dispatch({ type: "total", total }), [total]);

  /* ---- talking to the avatar ---- */
  const liveRef = useRef(live);
  liveRef.current = live;
  const tell = useCallback(
    (msg: string) => {
      if (!liveRef.current) return false;
      anam.interrupt();
      return anam.send(msg);
    },
    [anam],
  );
  const narrate = useCallback(
    (i: number, how: "start" | "move" | "back" | "resume" | "again") => {
      const st = guide.steps[i];
      if (!st) return;
      const n = i + 1;
      const said = st.say && st.say !== st.text ? ` (you may also say: "${st.say}")` : "";
      const lead =
        how === "start"
          ? `The user is ready. The screen now shows step 1 of ${total}: "${st.text}"${said}.`
          : how === "back"
          ? `The user went back to step ${n} (index ${i}). The screen shows: "${st.text}"${said}. Start with a few words like "OK, let's go back to step ${n}."`
          : how === "resume"
          ? `The user is back after a pause. The screen still shows step ${n} (index ${i}): "${st.text}".`
          : how === "again"
          ? `Say step ${n} again, slowly, with short pauses. The screen shows: "${st.text}".`
          : `User moved to step ${n} (index ${i}). The screen shows: "${st.text}"${said}.`;
      tell(`${lead} Say this one step simply in 1 or 2 short sentences, in the user's language. ${THEN_WAIT} Do not call a step tool.`);
    },
    [guide.steps, total, tell],
  );

  /* ---- moving ---- */
  const run = useCallback(
    (e: StageEvent) => {
      const before = sRef.current;
      const after = stageReducer(before, e);
      dispatch(e);
      sRef.current = after;
      stopSpeaking();
      if (after.index !== before.index) p.onIndex(after.index);
      if (after.phase === "step" && (before.phase !== "step" || after.index !== before.index) && (e.type === "start" || e.type === "next" || e.type === "back" || e.type === "jump" || e.type === "restart")) {
        setPaused(false);
        if (after.index === conflictAt && !conflictSeen.current) {
          conflictSeen.current = true;
          setConflictOpen(true);
          tell(`Before this step, say in one short sentence: "Your two papers say different things." The screen shows both quotes. Ask the user to check with whoever gave them the papers. Do not choose one. Do not call a tool.`);
        } else narrate(after.index, e.type === "start" ? "start" : e.type === "back" ? "back" : "move");
      }
      if (after.phase === "finish" && before.phase !== "finish") {
        tell(
          SHOW_CHECK
            ? `The user finished all ${total} steps. In one short sentence say they did it, then ask if they would like to check they have got it. Do not call a tool.`
            : `The user finished all ${total} steps. In one short sentence say they did it. Do not offer a quiz. Do not call a tool.`,
        );
      }
      if (e.type === "back" && after.index < before.index) setGoingBack(true);
      return after;
    },
    [p, narrate, tell, total, conflictAt],
  );

  // The avatar moved the step with a tool (or the index changed from outside): follow it.
  const seenMove = useRef(p.moveSeq ?? 0);
  useEffect(() => {
    const toolMove = (p.moveSeq ?? 0) !== seenMove.current;
    seenMove.current = p.moveSeq ?? 0;
    if (p.index !== sRef.current.index || toolMove) dispatch({ type: "sync", index: p.index });
  }, [p.index, p.moveSeq]);

  useEffect(() => {
    if (!goingBack) return;
    const tm = setTimeout(() => setGoingBack(false), 1800);
    return () => clearTimeout(tm);
  }, [goingBack]);

  /* ---- what she says about this step: captions count only messages after the step (or phase) changed ---- */
  // No check-in: after she narrates a step the stage stays as it is (circle in the corner, picture, Back / Next).
  const narrBase = useRef(anam.replySeq);
  useEffect(() => {
    narrBase.current = anam.replySeq;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.index]);

  /* ---- asking ---- */
  const askBase = useRef(anam.replySeq);
  const askInfoBase = useRef(p.askInfo?.seq ?? 0);
  const [readAnswer, setReadAnswer] = useState<{ answer: string; grounded: boolean; askWho: string | null } | null>(null);
  const [asking, setAsking] = useState(false);
  // Live: the guide speaks the answer; the "From your paper" / "Who to ask" chip comes from the same grounded
  // check the server does (in case the avatar answered without calling its tool).
  const [meta, setMeta] = useState<{ grounded: boolean; askWho: string | null } | null>(null);
  const metaSeq = useRef(0);
  const fetchMeta = useCallback(
    (q: string) => {
      const mine = ++metaSeq.current;
      setMeta(null);
      if (!q.trim()) return;
      api
        .ask(guide.id, q.trim(), lang)
        .then((r) => {
          if (mine === metaSeq.current) setMeta({ grounded: r.grounded, askWho: whoToAsk(guide.sender, r.ask_who) });
        })
        .catch(() => undefined);
    },
    [guide.id, guide.sender, lang],
  );

  const startAsk = useCallback(
    (mode: "voice" | "type") => {
      askBase.current = anam.replySeq;
      askInfoBase.current = p.askInfo?.seq ?? 0;
      setReadAnswer(null);
      setRecUser("");
      run({ type: "ask", mode });
      if (liveRef.current) {
        if (mode === "voice") {
          anam.interrupt();
          if (anam.micMuted) anam.setMic(false);
        }
        return;
      }
      if (mode === "voice") {
        const R = recognizer();
        if (!R) {
          dispatch({ type: "ask", mode: "type" });
          return;
        }
        try {
          const r = new R();
          r.lang = findWorld(lang)?.code ?? lang;
          r.interimResults = true;
          r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => {
            let txt = "";
            for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
            setRecUser(txt);
          };
          r.onerror = () => undefined;
          recRef.current = r;
          r.start();
        } catch {
          dispatch({ type: "ask", mode: "type" });
        }
      }
    },
    [anam, lang, p.askInfo?.seq, run],
  );

  const submit = useCallback(
    async (q: string) => {
      const text = q.trim();
      if (!text) return;
      try {
        recRef.current?.stop();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
      askBase.current = anam.replySeq;
      askInfoBase.current = p.askInfo?.seq ?? 0;
      dispatch({ type: "asked", question: text });
      setTyped("");
      if (liveRef.current) {
        anam.interrupt();
        anam.send(text);
        fetchMeta(text);
        return;
      }
      setAsking(true);
      try {
        const r = await api.ask(guide.id, text, lang);
        const who = whoToAsk(guide.sender, r.ask_who);
        const answer = r.answer?.trim() || tf(lang, "gs_notOnPaper", { who: who ?? t(lang, "gs_whoeverSent") });
        setReadAnswer({ answer, grounded: r.grounded, askWho: who });
        dispatch({ type: "answered", answer, grounded: r.grounded, askWho: who });
        if (!readMode && p.voice) void speak(answer, lang);
      } catch {
        const who = whoToAsk(guide.sender, null);
        const answer = tf(lang, "gs_notOnPaper", { who: who ?? t(lang, "gs_whoeverSent") });
        setReadAnswer({ answer, grounded: false, askWho: who });
        dispatch({ type: "answered", answer, grounded: false, askWho: who });
      } finally {
        setAsking(false);
      }
    },
    [anam, guide.id, guide.sender, lang, p.askInfo?.seq, p.voice, readMode],
  );

  // Live: when the user finishes speaking during "ask by voice", that is the question.
  useEffect(() => {
    if (s.phase === "ask" && s.askMode === "voice" && live && anam.userCaption.trim()) {
      askInfoBase.current = p.askInfo?.seq ?? 0;
      dispatch({ type: "asked", question: anam.userCaption });
      fetchMeta(anam.userCaption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anam.userSeq]);
  // Live: the user starts talking on a step or an answer (mic on): that is a question (09a).
  useEffect(() => {
    if (!live || paused || anam.activity !== "listening") return;
    const ph = sRef.current.phase;
    if (ph === "step" || ph === "answer") {
      askBase.current = anam.replySeq;
      askInfoBase.current = p.askInfo?.seq ?? 0;
      dispatch({ type: "ask", mode: "voice" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anam.activity, live]);
  // Stop browser listening when leaving the ask view.
  useEffect(() => {
    if (s.phase === "ask") return;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
  }, [s.phase]);
  useEffect(() => () => stopSpeaking(), []);
  // The stage can open straight from the loading screen (no tap): if the phone blocked the guide's sound,
  // the first tap anywhere starts her video and voice.
  useEffect(() => {
    const unblock = () => {
      const v = document.getElementById("anam-video") as HTMLVideoElement | null;
      if (v && v.srcObject && v.paused) void v.play().catch(() => undefined);
    };
    document.addEventListener("pointerdown", unblock, { capture: true });
    return () => document.removeEventListener("pointerdown", unblock, { capture: true });
  }, []);

  /* ---- read mode / pause ---- */
  useEffect(() => {
    if (readMode) {
      setPaused(false);
      stopSpeaking();
    }
  }, [readMode]);

  // Pause turns the mic off; Carry on puts it back the way the user had it (the mic toggle).
  const micBeforePause = useRef(false);
  function togglePause() {
    if (!paused) {
      setPaused(true);
      micBeforePause.current = anam.micMuted;
      anam.interrupt();
      anam.setMic(true);
      anam.setSound(true);
      stopSpeaking();
    } else {
      setPaused(false);
      anam.setMic(micBeforePause.current);
      anam.setSound(false);
      if (s.phase === "step") narrate(s.index, "resume");
    }
    setSheet("none");
  }
  function sayAgain() {
    setSheet("none");
    if (paused) togglePause();
    const last = anam.lastReply();
    if (live && last) {
      anam.interrupt();
      anam.talk(last);
    } else if (live) narrate(s.index, "again");
    else if (p.voice && step) void speak(step.say || step.text, lang);
  }
  function toggleSlow() {
    const next = !slow;
    setSlow(next);
    setSheet("none");
    if (live) {
      tell(next ? `Please speak more slowly from now on, with short pauses between sentences. Now say step ${s.index + 1} again slowly: "${step?.text ?? ""}". ${THEN_WAIT}` : "You can speak at your normal pace again. Keep sentences short.");
    }
  }

  /* ---- what is said in the caption ---- */
  const big = avatarBig(s.phase);
  const visual = useMemo(() => chooseVisual(step, guide, hasCloseUp), [step, guide]);
  const liveText = live && anam.replySeq > narrBase.current ? anam.liveCaption : "";
  let captionLabel = t(lang, live && anam.activity === "talking" ? "gs_talking" : "gs_yourGuide");
  let caption = "";
  // Guide mode has no big step text: the caption is the only text. It shows what she is saying; when she is paused,
  // not live, or has not started on this step yet, it shows the step itself so it is still readable.
  const stepWords = (step?.say || step?.text || "").trim();
  let captionIsStep = false;
  if (s.phase === "intro") caption = live && anam.liveCaption ? anam.liveCaption : t(lang, "gs_intro");
  else if (s.phase === "step") {
    caption = (!paused && liveText.trim()) || stepWords;
    captionIsStep = caption === stepWords;
  } else if (s.phase === "finish") caption = live && anam.replySeq > narrBase.current && anam.liveCaption ? anam.liveCaption : t(lang, "gs_finishLine");
  let answerText: string | null = null;
  if (s.phase === "answer") {
    captionLabel = t(lang, "gs_answering");
    answerText = live ? (anam.replySeq > askBase.current ? anam.liveCaption : null) : readAnswer?.answer ?? null;
  }
  if (paused) captionLabel = t(lang, "gs_pausedLabel");
  const info = p.askInfo && p.askInfo.seq > askInfoBase.current ? p.askInfo : null;
  const grounded = live ? info?.grounded ?? meta?.grounded ?? null : readAnswer?.grounded ?? null;
  const askWho = live ? whoToAsk(guide.sender, info?.askWho ?? meta?.askWho) : readAnswer?.askWho ?? null;

  const talking = live && anam.activity === "talking" && !paused;
  const userSaid = live ? anam.userCaption : recUser;

  /* ---- header ---- */
  const stepHeader = s.phase !== "intro" && s.phase !== "finish";
  const header = (
    <header className="gs-top">
      <button className="gs-round" onClick={p.onHome} aria-label={t(lang, "gs_home")}>
        <Icon name="home" />
      </button>
      {stepHeader ? <h1 className={"gs-count" + (readMode ? " start" : "")}>{tf(lang, "gs_stepOf", { n: s.index + 1, m: total })}</h1> : <span className="gs-grow" />}
      {!readMode && live && (
        <button
          type="button"
          className={"gs-mictoggle" + (anam.micMuted ? " off" : "")}
          role="switch"
          aria-checked={!anam.micMuted}
          title={t(lang, anam.micMuted ? "gs_micOffHint" : "gs_micOnHint")}
          aria-label={t(lang, anam.micMuted ? "gs_micOffHint" : "gs_micOnHint")}
          onClick={() => anam.setMic(!anam.micMuted)}
        >
          {anam.micMuted ? <MicOffIcon /> : <Icon name="mic" />}
          <span>{t(lang, anam.micMuted ? "gs_micOff" : "gs_micOn")}</span>
        </button>
      )}
      {readMode ? (
        <Toggle on={false} label={t(lang, "gs_guide")} icon={<SpeakerIcon />} onClick={() => p.onReadMode(false)} />
      ) : s.phase === "intro" ? (
        <Toggle on={false} label={t(lang, "gs_readMode")} icon={<BookIcon />} onClick={() => p.onReadMode(true)} />
      ) : s.phase !== "finish" ? (
        <button className="gs-round" onClick={() => p.onReadMode(true)} aria-label={t(lang, "gs_readMode")}>
          <BookIcon />
        </button>
      ) : (
        <span className="gs-grow" />
      )}
    </header>
  );
  const progress = stepHeader && (
    <button className="gs-bars" onClick={() => setSheet("steps")} aria-label={t(lang, "gs_seeAllSteps")}>
      {guide.steps.map((st, i) => (
        <i key={st.index} className={i <= s.index ? "d" : ""} />
      ))}
    </button>
  );

  const sheets = (
    <>
      {sheet === "steps" && (
        <AllSteps
          guide={guide}
          index={s.index}
          lang={lang}
          onClose={() => setSheet("none")}
          onPick={(i) => {
            setSheet("none");
            run({ type: "jump", index: i });
          }}
        />
      )}
      {sheet === "controls" && (
        <Controls lang={lang} slow={slow} paused={paused} onAgain={sayAgain} onSlow={toggleSlow} onPause={togglePause} onTextSize={p.onScale ? () => setSheet("text") : undefined} onClose={() => setSheet("none")} />
      )}
      {sheet === "text" && p.onScale && (
        <TextSizeSheet lang={lang} scale={p.scale ?? 1} onScale={p.onScale} onClose={() => setSheet("none")} preview={step ? { title: stepTitle(step), text: stepBody(step) || stepTitle(step) } : undefined} />
      )}
    </>
  );

  const conflictView = conflictOpen && (s.phase === "step" || readMode) && s.phase !== "finish" && (
    <div className="gs-conflict">
      {!readMode && (
        <div className="gs-conflict-av">
          <button type="button" className="gs-av-slot circle" data-avatar-slot="gs" data-shape="circle" onClick={() => setSheet("controls")} aria-label={t(lang, "gs_openControls")}>
            {!live && <img src="/guide-face.jpg" alt="" />}
          </button>
        </div>
      )}
      <ConflictCard
        guide={guide}
        lang={lang}
        onOk={() => {
          setConflictOpen(false);
          narrate(s.index, "move");
        }}
        onAsk={() => {
          setConflictOpen(false);
          startAsk(readMode ? "type" : "voice");
        }}
      />
    </div>
  );
  /* ================================================================ Read mode (12, 19a) */
  if (readMode) {
    const finished = s.phase === "finish";
    return (
      <div className="screen gs gs-read">
        {header}
        {p.cantConnect ? (
          <div className="gs-banner" role="status">
            <p>{t(lang, "gs_cantConnect")}</p>
            <button className="gs-pill" onClick={p.onTryAgain}>
              <Icon name="history" />
              {t(lang, "gs_tryAgain")}
            </button>
          </div>
        ) : (
          <span className="gs-badge">
            <BookIcon />
            {t(lang, "gs_readBadge")}
          </span>
        )}
        {conflictView ? (
          conflictView
        ) : finished ? (
          <FinishBody lang={lang} total={total} caption={t(lang, "gs_finishLine")} label={t(lang, "gs_yourGuide")} p={p} onAgain={() => run({ type: "restart" })} />
        ) : s.phase === "ask" || s.phase === "answer" ? (
          <AskPanel
            lang={lang}
            s={s}
            typed={typed}
            setTyped={setTyped}
            onSend={(q) => void submit(q)}
            asking={asking}
            answer={readAnswer?.answer ?? null}
            grounded={readAnswer?.grounded ?? null}
            askWho={readAnswer?.askWho ?? null}
            onBack={() => run({ type: "backToStep" })}
            onAgain={() => startAsk("type")}
            userSaid=""
            read
          />
        ) : (
          <>
            {progress}
            <div className={"gs-visual read" + (visual.kind === "text" ? " textonly" : "")} key={s.index} data-dir={s.dir}>
              {step && <StepVisualView v={visual} step={step} playing onRemind={onRemind} />}
              {onRemind && <RemindChip lang={lang} onClick={onRemind} />}
            </div>
            <h2 className="gs-title" dir="auto">{stepTitle(step)}</h2>
            {stepBody(step) && <p className="gs-body" dir="auto">{stepBody(step)}</p>}
            <button className="gs-link" onClick={() => startAsk("type")}>
              <KbIcon />
              {t(lang, "gs_askQ")}
            </button>
            <div className="gs-foot two">
              <button className="gs-btn ghost" onClick={() => run({ type: "back" })} disabled={s.index === 0}>
                <Chev back />
                {t(lang, "gs_back")}
              </button>
              <button className="gs-btn" onClick={() => run({ type: "next" })}>
                <Chev />
                {t(lang, "gs_next")}
              </button>
            </div>
          </>
        )}
        {sheets}
      </div>
    );
  }

  /* ================================================================ Guide mode */
  const connecting = !live && (anam.state === "connecting" || anam.state === "idle");
  const avatarLabel = t(lang, "gs_openControls");
  return (
    <div className={"screen gs gs-" + s.phase + (big ? " big" : " small") + (paused ? " paused" : "")}>
      {header}
      {s.phase === "finish" ? null : progress}
      {s.phase === "ask" || (s.phase === "answer" && !live) ? null : null}

      {conflictView ? (
        conflictView
      ) : s.phase === "finish" ? (
        <FinishBody
          lang={lang}
          total={total}
          caption={caption}
          label={captionLabel}
          p={p}
          onAgain={() => run({ type: "restart" })}
          avatar={
            <div className="gs-finish-av">
              <div className="gs-av-slot circle" data-avatar-slot="gs" data-shape="finish">
                <img src="/guide-face.jpg" alt="" />
              </div>
              <span className="gs-tick">
                <Icon name="check" />
              </span>
            </div>
          }
        />
      ) : (
        <>
          <div className={"gs-stage" + (s.phase === "ask" ? " asking" : "")}>
            {/* the step visual: under the avatar, who stays the small circle through steps, questions and answers */}
            {(s.phase === "step" || s.phase === "ask" || s.phase === "answer") && step && (
              <div className={"gs-visual" + (visual.kind === "text" ? " textonly" : "")} key={s.index} data-dir={s.dir}>
                <StepVisualView v={visual} step={step} playing={!paused} circle onRemind={onRemind} />
                {onRemind && !paused && <RemindChip lang={lang} onClick={onRemind} />}
                {goingBack && (
                  <span className="gs-chip back">
                    <Chev back />
                    {t(lang, "gs_goingBack")}
                  </span>
                )}
                {paused && (
                  <span className="gs-paused">
                    <Icon name="pause" />
                    <b>{t(lang, "gs_paused")}</b>
                  </span>
                )}
              </div>
            )}
            {s.phase === "answer" && s.question && (
              <span className="gs-you" dir="auto">
                {t(lang, "gs_you")}: “{s.question}”
              </span>
            )}
            <button
              type="button"
              className={"gs-av-slot " + (big ? "big" : "circle")}
              data-avatar-slot="gs"
              data-shape={big ? "big" : "circle"}
              onClick={() => setSheet("controls")}
              aria-label={avatarLabel}
            >
              {!live && <img src={big ? "/guide-cartoon.jpg" : "/guide-face.jpg"} alt="" />}
              {connecting && big && <span className="gs-joining">{t(lang, "gs_joining")}</span>}
            </button>
            {live && anam.needsTap && (
              <button type="button" className={"gs-taphear" + (big ? "" : " small")} onClick={() => anam.unlock()}>
                <SpeakerIcon />
                {t(lang, "gs_tapToHear")}
              </button>
            )}
            <Talking on={talking} small={!big} />
          </div>

          {s.phase === "ask" ? (
            <AskPanel
              lang={lang}
              s={s}
              typed={typed}
              setTyped={setTyped}
              onSend={(q) => void submit(q)}
              asking={asking}
              answer={null}
              grounded={null}
              askWho={null}
              onBack={() => run({ type: "backToStep" })}
              onAgain={() => startAsk("type")}
              onVoice={() => startAsk("voice")}
              onType={() => dispatch({ type: "ask", mode: "type" })}
              onDone={() => (userSaid.trim() ? void submit(userSaid) : run({ type: "backToStep" }))}
              userSaid={userSaid}
              live={live}
            />
          ) : (
            <>
              {/* Guide mode: no big step text here; the caption below is the only text (Read mode keeps the title). */}
              {(caption || answerText !== null || s.phase === "answer") && (
                <div className={"gs-caption" + (paused ? " paused" : "") + (captionIsStep ? " step" : "")} aria-live="polite">
                  <small>
                    {captionLabel} · {langName}
                  </small>
                  <p dir="auto">
                    {paused && s.phase !== "step"
                      ? t(lang, "gs_tapCarryOn")
                      : s.phase === "answer"
                      ? tailCaption(answerText ?? "", 220) || t(lang, "gs_thinking")
                      : captionIsStep
                      ? caption
                      : tailCaption(caption, 220)}
                  </p>
                </div>
              )}
              {s.phase === "answer" && answerText && grounded !== null && (
                <span className={"gs-chip " + (grounded ? "src" : "who")}>
                  {grounded ? <Icon name="doc" /> : <Icon name="alert" />}
                  {grounded ? t(lang, "gs_fromPaper") : tf(lang, "gs_whoToAsk", { who: askWho ?? t(lang, "gs_whoeverSent") })}
                </span>
              )}
              <div className="gs-actions">
                {s.phase === "intro" && (
                  <>
                    <button className="gs-btn" onClick={() => run({ type: "start" })}>
                      <Chev />
                      {t(lang, "gs_yesStart")}
                    </button>
                    <p className="gs-or">{t(lang, "gs_orAsk")}</p>
                    <div className="gs-two">
                      <button className="gs-btn sage" onClick={() => startAsk("voice")}>
                        <Icon name="mic" />
                        {t(lang, "gs_speak")}
                      </button>
                      <button className="gs-btn ghost" onClick={() => startAsk("type")}>
                        <KbIcon />
                        {t(lang, "gs_type")}
                      </button>
                    </div>
                  </>
                )}
                {s.phase === "step" && (
                  <>
                    {/* Always there: Back / Next to move, Speak / Type to ask (no check-in after each step). */}
                    <div className="gs-two">
                      <button className="gs-btn ghost" onClick={() => run({ type: "back" })} disabled={s.index === 0}>
                        <Chev back />
                        {t(lang, "gs_back")}
                      </button>
                      <button className="gs-btn" onClick={() => run({ type: "next" })}>
                        <Chev />
                        {t(lang, "gs_next")}
                      </button>
                    </div>
                    {paused ? (
                      <button className="gs-btn sage" onClick={togglePause}>
                        <Icon name="play" />
                        {t(lang, "gs_carryOn")}
                      </button>
                    ) : (
                      <div className="gs-two">
                        <button className="gs-btn sage" onClick={() => startAsk("voice")}>
                          <Icon name="mic" />
                          {t(lang, "gs_speak")}
                        </button>
                        <button className="gs-btn ghost" onClick={() => startAsk("type")}>
                          <KbIcon />
                          {t(lang, "gs_type")}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {s.phase === "answer" && (
                  <>
                    <button className="gs-btn" onClick={() => run({ type: "backToStep" })}>
                      <Chev back />
                      {t(lang, "gs_backToStep")}
                    </button>
                    <div className="gs-two">
                      <button className="gs-btn sage" onClick={() => startAsk("voice")}>
                        <Icon name="mic" />
                        {t(lang, "gs_askAgain")}
                      </button>
                      <button className="gs-btn ghost" onClick={() => run({ type: "next" })}>
                        <Chev />
                        {t(lang, "gs_nextStep")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
      {sheets}
    </div>
  );
}

/* ---------------------------------------------------------------- ask panel (09a / 09b, and read-mode answers) */
function AskPanel(props: {
  lang: string;
  s: ReturnType<typeof initialStage>;
  typed: string;
  setTyped: (v: string) => void;
  onSend: (q: string) => void;
  asking: boolean;
  answer: string | null;
  grounded: boolean | null;
  askWho: string | null;
  onBack: () => void;
  onAgain: () => void;
  onVoice?: () => void;
  onType?: () => void;
  onDone?: () => void;
  userSaid: string;
  live?: boolean;
  read?: boolean;
}) {
  const { lang, s, typed, setTyped, onSend } = props;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (s.phase === "ask" && s.askMode === "type") inputRef.current?.focus();
  }, [s.phase, s.askMode]);
  if (s.phase === "answer") {
    // Read mode answer (the live answer is shown in the caption under the avatar).
    return (
      <div className="gs-askcard">
        <p className="gs-q" dir="auto">
          {t(lang, "gs_you")}: “{s.question}”
        </p>
        <div className="gs-caption">
          {/* "The answer comes from your paper" only when it does: a not-on-your-paper answer says who to ask below. */}
          {props.grounded !== false && <small>{t(lang, "gs_willAnswerRead")}</small>}
          <p dir="auto">{props.answer ?? t(lang, "gs_thinking")}</p>
        </div>
        {props.answer && props.grounded !== null && (
          <span className={"gs-chip " + (props.grounded ? "src" : "who")}>
            {props.grounded ? <Icon name="doc" /> : <Icon name="alert" />}
            {props.grounded ? t(lang, "gs_fromPaper") : tf(lang, "gs_whoToAsk", { who: props.askWho ?? t(lang, "gs_whoeverSent") })}
          </span>
        )}
        <div className="gs-actions">
          <button className="gs-btn" onClick={props.onBack}>
            <Chev back />
            {t(lang, "gs_backToStep")}
          </button>
          <button className="gs-btn ghost" onClick={props.onAgain}>
            <KbIcon />
            {t(lang, "gs_askAgain")}
          </button>
        </div>
      </div>
    );
  }
  if (s.askMode === "voice") {
    return (
      <div className="gs-askcard">
        <div className="gs-listen">
          <h2>{t(lang, "gs_listening")}</h2>
          <div className="gs-wave" aria-hidden="true">
            {Array.from({ length: 21 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 7) * 90}ms` }} />
            ))}
          </div>
          {props.userSaid && (
            <>
              <small>{t(lang, "gs_youSaid")}</small>
              <p dir="auto">{props.userSaid}</p>
            </>
          )}
        </div>
        <p className="gs-hint">{t(lang, "gs_speakAny")}</p>
        <div className="gs-mic" aria-hidden="true">
          <Icon name="mic" />
        </div>
        <div className="gs-two">
          <button className="gs-btn ghost" onClick={props.onType}>
            <KbIcon />
            {t(lang, "gs_typeInstead")}
          </button>
          <button className="gs-btn" onClick={props.onDone}>
            <Icon name="check" />
            {t(lang, "gs_done")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="gs-askcard">
      <form
        className="gs-typebox"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(typed);
        }}
      >
        <h2>{t(lang, "gs_typeQ")}</h2>
        <textarea
          ref={inputRef}
          dir="auto"
          rows={2}
          value={typed}
          enterKeyHint="send"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend(typed);
            }
          }}
          aria-label={t(lang, "gs_typeQ")}
        />
        <div className="gs-two">
          {props.onVoice ? (
            <button type="button" className="gs-btn sage" onClick={props.onVoice}>
              <Icon name="mic" />
              {t(lang, "gs_speak")}
            </button>
          ) : (
            <button type="button" className="gs-btn ghost" onClick={props.onBack}>
              <Chev back />
              {t(lang, "gs_back")}
            </button>
          )}
          <button type="submit" className="gs-btn" disabled={!typed.trim() || props.asking}>
            <Icon name="send" />
            {t(lang, "gs_send")}
          </button>
        </div>
      </form>
      <p className="gs-hint">{t(lang, props.read || !props.live ? "gs_willAnswerRead" : "gs_willAnswer")}</p>
      {!props.read && props.onVoice && (
        <button className="gs-link" onClick={props.onBack}>
          <Chev back />
          {t(lang, "gs_backToStep")}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- finish (13) */
function FinishBody({ lang, total, caption, label, p, onAgain, avatar }: { lang: string; total: number; caption: string; label: string; p: GuideStageProps; onAgain: () => void; avatar?: React.ReactNode }) {
  return (
    <div className="gs-finish">
      {avatar ?? (
        <div className="gs-finish-av">
          <div className="gs-av-slot circle still">
            <img src="/guide-face.jpg" alt="" />
          </div>
          <span className="gs-tick">
            <Icon name="check" />
          </span>
        </div>
      )}
      <h2>{t(lang, "gs_youDidIt")}</h2>
      <p className="gs-sub">{tf(lang, "gs_finishedAll", { n: total })}</p>
      <div className="gs-caption">
        <small>
          {label} · {languageLabel(lang)}
        </small>
        <p dir="auto">{tailCaption(caption)}</p>
      </div>
      {!p.guide.source.is_sample && (
        <span className="gs-chip ok">
          <Icon name="check" />
          {t(lang, "gs_saved")}
        </span>
      )}
      <div className="gs-actions">
        {SHOW_CHECK && (
          <button className="gs-btn" onClick={p.onCheck}>
            <Icon name="check" />
            {t(lang, "gs_checkGotIt")}
          </button>
        )}
        <div className="gs-two">
          <button className="gs-btn ghost" onClick={() => openShare(p.guide)}>
            <Icon name="send" />
            {t(lang, "gs_share")}
          </button>
          <button className="gs-btn ghost" onClick={p.onPapers}>
            <Icon name="doc" />
            {t(lang, "gs_myGuides")}
          </button>
        </div>
        {hasDates(p.guide) && (
          <button className="gs-btn sage" onClick={() => openRemindMe(p.guide, 0)}>
            <Icon name="sun" />
            {t(lang, "gs_remind")}
          </button>
        )}
        <button className="gs-link" onClick={onAgain}>
          <Icon name="history" />
          {t(lang, "gs_again")}
        </button>
      </div>
    </div>
  );
}
