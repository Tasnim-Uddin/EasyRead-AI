import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Clip, Guide, Step } from "../types";
import { isFallback, t, tf } from "../i18n";
import { Counter, T } from "../bidi";
import { canSpeak, findWorld } from "../languages";
import Icon, { GuideFace } from "../icons";
import { claimAudio, releaseAudio, speak } from "../speech";
import { AVATAR_VIDEO_ID, type LiveInfo, LiveContext, useLive, useDock, TitleBar } from "./shared";
import { kindOf } from "./summary";

/**
 * One panel above the bottom bar: the live avatar in a rounded video slot with its latest caption,
 * small End / mic / sound controls and the type bar. Collapses to a slim bar. When the avatar is not
 * live it is a slim "Talk to your guide" row.
 */
export function GuideDock({ text, lang }: { text: string; lang: string }) {
  const info = useDock();
  if (!info) return null;
  if (!info.live) {
    // Not live: one clear "Start your guide" tap (browsers need a tap before any sound). Never starts on its own.
    const start = info.onStartHere ?? info.onTalk;
    if (!start) return null;
    const st = info.state;
    const on = info.guideOn !== false;
    const sub =
      st === "connecting" ? t(lang, "connecting") + "…" : st === "standin" ? t(lang, "talkStandin") : st === "error" ? t(lang, "talkError") : on ? t(lang, "startGuideSub") : t(lang, "talkGuideSub");
    return (
      <button className={"dock dock-slim" + (on ? " dock-start" : "")} onClick={start} disabled={st === "connecting"} aria-busy={st === "connecting"}>
        <GuideFace />
        <span className="dock-txt">
          <b>{t(lang, on ? "startGuide" : "showGuide")}</b>
          <small role={st === "standin" || st === "error" ? "status" : undefined}>{sub}</small>
        </span>
        <span className="dock-go">
          <Icon name="chevRight" />
        </span>
      </button>
    );
  }
  const full = info.caption || text;
  const caption = full.length > 90 ? "…" + full.slice(-90).replace(/^\S*\s/, "") : full; // the latest words
  // Compact, one row: video tile, status chip + two-line caption, icon buttons. Typing lives in the question sheet.
  return (
    <section className="dock dock-live dock-compact" aria-label={t(lang, "guideSays")}>
      <div className="avslot dockvid" data-avatar-slot="dock" />
      <div className="dock-mid">
        <span className={"st-chip st-" + (info.status ?? "stReady")} role="status">
          {t(lang, info.status ?? "stReady")}
        </span>
        <span className="dock-cap2" dir="auto" aria-live="polite">
          {caption}
        </span>
      </div>
      <div className="dock-icons">
        {info.onPause && (
          <button type="button" className="icon-btn" onClick={info.onPause} aria-label={t(lang, "pauseGuide")} title={t(lang, "pauseGuide")}>
            <Icon name="pause" />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={info.onToggleSound} aria-pressed={info.soundOff} aria-label={t(lang, info.soundOff ? "soundOn" : "soundOff")}>
          <Icon name="volume" />
        </button>
        {info.onAsk && (
          <button type="button" className="icon-btn" onClick={info.onAsk} aria-label={t(lang, "askQ")} title={t(lang, "askQ")}>
            <Icon name="chat" />
          </button>
        )}
        <button type="button" className="icon-btn end" onClick={info.onHide ?? info.onEnd} aria-label={t(lang, "hideGuide")} title={t(lang, "hideGuide")}>
          <Icon name="x" />
        </button>
      </div>
    </section>
  );
}

/**
 * Rendered once at App level (never unmounted), so the avatar stream survives screen changes.
 * It sits over whichever [data-avatar-slot] the current screen shows (large stage on Talk, small
 * face in the guide row on Step/Ask). With no slot (clip, settings...) it floats as a small tile.
 */
export function AvatarHost({ live, screen }: { live: boolean; screen: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    let slot: Element | null = null;
    let ro: ResizeObserver | null = null;
    const place = () => {
      if (!slot || !slot.isConnected) return;
      const r = slot.getBoundingClientRect();
      Object.assign(host.style, {
        top: `${r.top + window.scrollY}px`,
        left: `${r.left + window.scrollX}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      // The guide stage's slot morphs (big picture <-> small circle): the video takes its shape too.
      if (slot.getAttribute("data-avatar-slot") === "gs") host.style.borderRadius = getComputedStyle(slot).borderRadius;
      else host.style.removeProperty("border-radius");
    };
    // While the slot animates (a CSS transition on its size and position), follow it every frame.
    let raf = 0;
    let until = 0;
    const follow = () => {
      until = performance.now() + 700;
      if (raf) return;
      const tick = () => {
        place();
        raf = performance.now() < until ? requestAnimationFrame(tick) : 0;
      };
      raf = requestAnimationFrame(tick);
    };
    const find = () => {
      const next = document.querySelector("[data-avatar-slot]");
      if (next === slot) {
        follow();
        return place();
      }
      ro?.disconnect();
      slot = next;
      host.dataset.mode = slot ? (slot.getAttribute("data-avatar-slot") ?? "face") : "float";
      if (!slot) {
        for (const k of ["top", "left", "width", "height"]) host.style.removeProperty(k);
        return;
      }
      ro = new ResizeObserver(place);
      ro.observe(slot);
      ro.observe(document.body);
      place();
    };
    find();
    // slots can appear a frame after the screen (lists, images): re-check as the page settles
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-shape"] });
    window.addEventListener("resize", place);
    // the dock slot sits in a sticky bottom bar, so it moves on the page as the user scrolls
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [screen, live]);
  const info = useContext(LiveContext);
  return (
    <div ref={ref} className="avhost" data-mode="float" data-live={live ? "1" : "0"}>
      <video id={AVATAR_VIDEO_ID} autoPlay playsInline />
      {live && info && (
        <button className="avend" onClick={info.onEnd} aria-label={t(info.lang, "endTalk")}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/** Stand-in face, or the empty slot the live avatar is shown over. */
export function GuideOrAvatar({ live }: { live: LiveInfo | null }) {
  return live ? <div className="avslot face" data-avatar-slot="face" /> : <GuideFace />;
}

/** Small End / mic / sound buttons next to the live tile. */
/** Typed message to the live avatar (for people who cannot or prefer not to speak). */
export function TypeBar({ lang, onSend, children }: { lang: string; onSend?: (text: string) => boolean; children?: React.ReactNode }) {
  const [typed, setTyped] = useState("");
  const has = !!typed.trim();
  return (
    <form
      className="typebar"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSend?.(typed)) setTyped("");
      }}
    >
      {onSend && (
        <span className="field">
          <input dir="auto" enterKeyHint="send" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t(lang, "typeToGuide")} aria-label={t(lang, "typeToGuide")} />
          {/* The send button shows once there is something to send, so the bar stays calm. */}
          {(has || !children) && (
            <button className="icon-btn send" type="submit" disabled={!has} aria-label={t(lang, "send")}>
              <Icon name="send" />
            </button>
          )}
        </span>
      )}
      {children}
    </form>
  );
}
export function LiveControls({ live }: { live: LiveInfo }) {
  const { lang } = live;
  return (
    <>
    <div className="livectl">
      <button className="end" onClick={live.onEnd}>
        {t(lang, "endTalk")}
      </button>
      <button onClick={live.onToggleMic} aria-pressed={live.micMuted} aria-label={t(lang, live.micMuted ? "unmuteMic" : "muteMic")}>
        <Icon name="mic" />
      </button>
      <button onClick={live.onToggleSound} aria-pressed={live.soundOff} aria-label={t(lang, live.soundOff ? "soundOn" : "soundOff")}>
        <Icon name="play" />
      </button>
    </div>
    {live.onSend && <TypeBar lang={lang} onSend={live.onSend} />}
    </>
  );
}

/* ---------- 5. step ---------- */
const KIND_ICON: Record<string, string> = { what: "doc", when: "sun", how: "hand", warning: "alert", get_help: "alert" };

export const pictureComing = (s: Step) => !s.image_url && (s.status === "pending" || s.status === "generating");

function StepPicture({ step, lang }: { step: Step; lang: string }) {
  const butter = step.kind === "warning" || step.kind === "get_help";
  const badge = butter ? (
    <div className="badge">
      <Icon name="alert" />
      {t(lang, step.kind === "warning" ? "goodToKnow" : "getHelp")}
    </div>
  ) : null;
  if (step.image_url) {
    // Pictures carry no words, so they work in every language.
    return (
      <div className={"pic" + (butter ? " warn" : "")}>
        {badge}
        <img src={step.image_url} alt="" />
      </div>
    );
  }
  const icon = <Icon name={KIND_ICON[step.kind] ?? "doc"} style={butter ? { width: 72, height: 72, strokeWidth: 2.6 } : undefined} />;
  if (pictureComing(step)) {
    // Same box as the finished picture, so nothing jumps when it arrives.
    return (
      <div className={"pic loading" + (butter ? " warn" : " ph")} role="img" aria-label={t(lang, "rowPictures")}>
        {badge}
        {icon}
      </div>
    );
  }
  // No picture (failed or offline): the step text is enough. A calm icon, no error text.
  return (
    <div className={"pic" + (step.status === "failed" ? "" : " small") + (butter ? " warn" : " ph")}>
      {badge}
      {icon}
    </div>
  );
}

interface StepProps {
  guide: Guide;
  index: number;
  lang: string;
  clips: Clip[];
  onClose: () => void;
  onIndex: (i: number) => void;
  onFinish: () => void;
  onShowHow: () => void;
  moved?: number | null;
  onUndoMove?: () => void;
  askOpen?: boolean;
  onAskOpen?: (open: boolean) => void;
  onAsk?: (q: string) => void;
  answer?: string | null;
  busy?: boolean;
  onCheck?: () => void;
}
/** "Show me how" only when the step has a clip in the library: never a dead button. */
export function stepHasHow(_guide: Guide, step: Step, clips: Clip[]) {
  return !!(step.technique_clip_id && clips.some((c) => c.id === step.technique_clip_id));
}
export function StepScreen({ guide, index, lang, clips, onClose, onIndex, onFinish, onShowHow, moved, onUndoMove, askOpen, onAskOpen, onAsk, answer, busy, onCheck }: StepProps) {
  const live = useLive();
  const dock = !!useDock();
  const step = guide.steps[index];
  if (!step) return null;
  const total = guide.steps.length;
  const last = index >= total - 1;
  // While the guide is live it is the one voice: no separate Listen button.
  const listen = canSpeak(lang) && !live;
  const how = stepHasHow(guide, step, clips);
  const noVideo = !how && step.kind === "how" && kindOf(guide) !== "letter" && kindOf(guide) !== "form";
  return (
    <div className={"screen step-screen" + (live ? " is-live" : "")}>
      <TitleBar
        lang={lang}
        onBack={onClose}
        backLabel={t(lang, "summaryNav")}
        title={
          <>
            <T lang={lang} k="step" /> <Counter lang={lang} n={index + 1} total={total} />
          </>
        }
      />
      <div className="bars">
        {guide.steps.map((s) => (
          <button
            key={s.index}
            className={s.index <= index ? "d" : ""}
            onClick={() => onIndex(s.index)}
            aria-label={`${t(lang, "step")} ${s.index + 1}`}
            aria-current={s.index === index ? "step" : undefined}
          />
        ))}
      </div>
      {moved != null && (
        <p className="moved-note" role="status">
          <span dir={isFallback(lang, "guideMoved") ? "ltr" : undefined}>{tf(lang, "guideMoved", { n: moved })}</span>
          {onUndoMove && (
            <button className="link-btn" onClick={onUndoMove}>
              {t(lang, "undo")}
            </button>
          )}
        </p>
      )}
      <StepPicture step={step} lang={lang} />
      <div className="step" aria-live="polite" dir="auto">
        {step.text}
      </div>
      {(listen || how) && (
        <div className={"seg" + (listen && how ? "" : " one")}>
          {listen && (
            <button className="on" onClick={() => void speak(step.text, lang)}>
              <Icon name="volume" />
              {t(lang, "listen")}
            </button>
          )}
          {how && (
            <button onClick={onShowHow}>
              <Icon name="playCircle" />
              {t(lang, "showHow")}
            </button>
          )}
        </div>
      )}
      {noVideo && (
        <p className="no-video" role="status">
          {t(lang, "noVideo")}
        </p>
      )}
      {onAskOpen && (
        <div className="step-more">
          <button className="btn surface" onClick={() => onAskOpen(true)}>
            <Icon name="chat" />
            {t(lang, "askQ")}
          </button>

        </div>
      )}
      {askOpen && onAskOpen && onAsk && (
        <AskSheet lang={lang} n={index + 1} live={!!live} answer={answer ?? null} busy={!!busy} onAsk={onAsk} onClose={() => onAskOpen(false)} />
      )}
      {!dock && (
        <div className="guide">
          <GuideOrAvatar live={live} />
          <div className="bubble" dir="auto">
            <b>{t(lang, "guideSays")}</b>
            {step.say || step.text}
          </div>
          {live && <LiveControls live={live} />}
        </div>
      )}
      <div className={dock ? "bottombar" : undefined} style={dock ? undefined : { display: "contents" }}>
        <GuideDock text={step.say || step.text} lang={lang} />
        <div className="nav">
          <button className="btn quiet back" onClick={() => onIndex(index - 1)} disabled={index === 0}>
            <Icon name="back" />
            {t(lang, "back")}
          </button>
          <button className="btn next" onClick={last ? onFinish : () => onIndex(index + 1)}>
            {t(lang, last ? "finish" : "next")}
            <Icon name="chevRight" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ask on the step screen: type or speak; the guide (or the document answer) replies, the user stays on the step. */
function AskSheet({ lang, n, live, answer, busy, onAsk, onClose }: { lang: string; n: number; live: boolean; answer: string | null; busy: boolean; onAsk: (q: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState(false);
  const [listening, setListening] = useState(false);
  const SR = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
  const submit = (text: string) => {
    if (!text.trim()) return;
    setSent(true);
    onAsk(text);
  };
  function mic() {
    if (!Rec) return;
    const r = new Rec();
    r.lang = findWorld(lang)?.code ?? lang;
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      submit(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t(lang, "askQ")} onClick={onClose}>
      <div className="ask-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{t(lang, "askQ")}</b>
          <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
            <Icon name="x" />
          </button>
        </div>
        <p className="sub">{tf(lang, "stillOnStep", { n })}</p>
        <textarea
          dir="auto"
          value={q}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(q);
            }
          }}
          onChange={(e) => setQ(e.target.value)} rows={2} placeholder={t(lang, "askExample")} />
        <div className="sheet-actions">
          {Rec && (
            <button className="btn quiet" onClick={mic} aria-pressed={listening}>
              <Icon name="mic" />
              {listening ? t(lang, "listening") : t(lang, "speak")}
            </button>
          )}
          <button className="btn" onClick={() => submit(q)} disabled={!q.trim() || busy}>
            <Icon name="send" />
            {t(lang, "askQ")}
          </button>
        </div>
        {sent && answer ? (
          <div className="answer" dir="auto" aria-live="polite">
            {live && <b>{t(lang, "guideSays")}: </b>}
            {answer}
          </div>
        ) : sent && busy ? (
          <p className="sub" role="status">{live ? t(lang, "guideSays") : ""}…</p>
        ) : null}
        <button className="btn quiet" onClick={onClose}>
          {tf(lang, "backToStep", { n })}
        </button>
      </div>
    </div>
  );
}

/* ---------- 6. show me how ---------- */
export function ClipScreen({ guide, index, lang, clips, onBack }: { guide: Guide; index: number; lang: string; clips: Clip[]; onBack: () => void }) {
  const step = guide.steps[index];
  const clip = step?.technique_clip_id ? clips.find((c) => c.id === step.technique_clip_id) : undefined;
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const dock = !!useDock();
  useEffect(() => {
    if (vid.current) vid.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, playing]);
  // A clip has the floor while it plays: the guide is quieted, and comes back after.
  useEffect(() => {
    if (!playing || !clip) return;
    claimAudio("clip");
    return () => releaseAudio("clip");
  }, [playing, clip]);
  if (!step) return null;
  const play = () => {
    setPlaying(true);
    if (vid.current) void vid.current.play();
    else void speak(step.text, lang);
  };
  return (
    <div className="screen">
      <TitleBar title={t(lang, "clipTitle")} lang={lang} onBack={onBack} backLabel={tf(lang, "stepN", { n: index + 1 })} />
      <div className="clip">
        {clip ? (
          <video ref={vid} src={clip.video_url} poster={clip.poster_url} loop muted playsInline controls={playing} aria-label={clip.caption_en} />
        ) : step.image_url ? (
          <img src={step.image_url} alt="" />
        ) : pictureComing(step) ? (
          <div className="loading fill" role="img" aria-label={t(lang, "rowPictures")}>
            <Icon name="hand" size={72} />
          </div>
        ) : (
          <Icon name="hand" size={72} />
        )}
        {!playing && clip && (
          <button className="play" onClick={play} aria-label={t(lang, "playAgain")}>
            <Icon name="play" />
          </button>
        )}
        {!clip && <p className="no-video" role="status">{t(lang, "noVideo")}</p>}
      </div>
      <div className="cap">{clip?.caption_en ?? step.text}</div>
      {clip?.unchecked ? (
        <div className="check butter">
          <Icon name="alert" />
          {t(lang, "clipUnchecked")}
        </div>
      ) : clip ? (
        <div className="check">
          <Icon name="check" />
          {(clip.checked_against ?? "").includes("nhs.uk") ? t(lang, "clipNhs") : t(lang, "clipChecked")}
        </div>
      ) : (
        <div className="check butter">
          <Icon name="alert" />
          {t(lang, "clipMissing")}
        </div>
      )}
      <div className="row2">
        <button className="btn soft" onClick={play}>
          {t(lang, "playAgain")}
        </button>
        <button className="btn soft" onClick={() => setSlow(!slow)} aria-pressed={slow}>
          {t(lang, "slower")}
        </button>
      </div>
      <div className={dock ? "bottombar" : undefined} style={dock ? undefined : { display: "contents" }}>
        <GuideDock text={step.say || step.text} lang={lang} />
        <div className="nav">
          <button className="btn" onClick={onBack}>
            {t(lang, "close")}
          </button>
        </div>
      </div>
    </div>
  );
}
