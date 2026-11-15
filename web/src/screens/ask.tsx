import { useRef, useState } from "react";
import type { Guide } from "../types";
import { isFallback, t, tf } from "../i18n";
import { canSpeak, findWorld } from "../languages";
import Icon, { GuideFace } from "../icons";
import { speak } from "../speech";
import type { AnamState } from "../useAnam";
import { GuideDock, GuideOrAvatar, TypeBar, LiveControls } from "./guide";
import { useLive, useDock, LangPill, TitleBar } from "./shared";
import { type Kind, kindOf, safetyLines } from "./summary";

/* ---------- 7. ask / finish ---------- */
const CHIP_KEYS: Record<Kind, string[]> = {
  medicine: ["cMed1", "cMed2", "cMed3"],
  letter: ["cLet1", "cLet2", "cLet3"],
  form: ["cForm1", "cForm2"],
  howto: ["cHow1", "cHow2"],
};

interface AskProps {
  guide: Guide;
  lang: string;
  question: string;
  answer: string | null;
  busy: boolean;
  onQuestion: (q: string) => void;
  onAsk: (q?: string) => void;
  onTalk: () => void;
  onTellBack: () => void;
  onPrint: () => void;
  onBack: () => void;
}
export function AskScreen({ guide, lang, question, answer, busy, onQuestion, onAsk, onTalk, onTellBack, onPrint, onBack }: AskProps) {
  const live = useLive();
  const dock = !!useDock();
  const k = kindOf(guide);
  const heading = t(lang, k === "medicine" ? "askAboutMedicine" : "askAboutPaper");
  const [listening, setListening] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;

  function mic() {
    if (!Rec) {
      input.current?.focus();
      return;
    }
    const r = new Rec();
    r.lang = findWorld(lang)?.code ?? lang;
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const text = e.results[0][0].transcript;
      onQuestion(text);
      onAsk(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  const asked = answer ? question.trim() : "";
  const more = (
    <div className="ans-actions">
      <button className="btn surface" onClick={onTellBack}>
        <Icon name="swap" />
        {t(lang, "tellBack")}
      </button>
      <button className="btn quiet" onClick={onPrint}>
        <Icon name="print" />
        {t(lang, "print")}
      </button>
    </div>
  );
  return (
    <div className="screen">
      <TitleBar title={t(lang, "ask")} lang={lang} onBack={onBack} />
      <p className="sub done-line">
        <Icon name="check" />
        <span dir={isFallback(lang, "allDone") ? "ltr" : undefined}>{tf(lang, "allDone", { n: guide.steps.length })}</span>
      </p>
      {live && !dock && (
        <div className="guide">
          <GuideOrAvatar live={live} />
          <LiveControls live={live} />
        </div>
      )}
      <div className="ask">
        <h2>{heading}</h2>
        <form
          className="askbar"
          onSubmit={(e) => {
            e.preventDefault();
            onAsk();
          }}
        >
          <label className="field">
            <span className="sr">{t(lang, "askExample")}</span>
            <textarea
              ref={input}
              className="q"
              rows={1}
              dir="auto"
              value={question}
              placeholder={t(lang, "askExample")}
              onChange={(e) => onQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onAsk();
                }
              }}
            />
          </label>
          {question.trim() && !answer ? (
            <button className="icon-btn send" type="submit" disabled={busy} aria-label={t(lang, "ask")}>
              <Icon name="send" />
            </button>
          ) : (
            <button type="button" className={"icon-btn mic" + (listening ? " on" : "")} onClick={mic} aria-label={t(lang, "tapSpeak")}>
              <Icon name="mic" />
            </button>
          )}
        </form>
        {(busy || listening) && (
          <p className="sub" role="status" style={{ padding: "0.5rem 0 0" }}>
            {busy ? t(lang, "thinking") : t(lang, "listening")}…
          </p>
        )}
      </div>
      <div className="chips" role="list">
        {CHIP_KEYS[k].map((ck) => t(lang, ck)).map((c) => (
          <button
            key={c}
            role="listitem"
            className="chip"
            disabled={busy}
            onClick={() => {
              onQuestion(c);
              onAsk(c);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {answer && !(dock && live) ? (
        <section className="answer" aria-live="polite">
          <div className="ans-head">
            <GuideFace />
            <b>{t(lang, "guideSays")}</b>
            {canSpeak(lang) && (
              <button className="icon-btn surface" onClick={() => void speak(answer, lang)} aria-label={t(lang, "readAnswer")}>
                <Icon name="volume" />
              </button>
            )}
          </div>
          {asked && (
            <p className="asked" dir="auto">
              {t(lang, "youAsked")} {asked}
            </p>
          )}
          <p className="ans-text" dir="auto">
            {answer}
          </p>
          {more}
        </section>
      ) : (
        more
      )}
      {safetyLines(guide, lang).length > 0 && (
        <p className="safe info">
          <Icon name="info" />
          <span>
            <b>{t(lang, "notSure")}</b> {safetyLines(guide, lang).map((l) => l.replace(/^Not sure\?\s*/, "")).join(" ")}
          </span>
        </p>
      )}
      <div className={dock ? "bottombar" : "foot"}>
        {dock && live ? (
          <GuideDock text={answer ?? t(lang, "allDoneSub")} lang={lang} />
        ) : (
          <div className="nav">
            <button className="btn next" onClick={onTalk}>
              <Icon name="chat" />
              {t(lang, "talkGuide")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 8. talk to your guide ---------- */
interface TalkProps {
  lang: string;
  onSend?: (text: string) => boolean;
  state: AnamState;
  error: string | null;
  caption: string;
  onLanguage: (c: string) => void;
  onBack: () => void;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
  sttMissing?: boolean;
  micMuted?: boolean;
  soundOff?: boolean;
  onToggleMic?: () => void;
  onToggleSound?: () => void;
}
export function TalkScreen({ lang, state, error, sttMissing, caption, onLanguage, onBack, onStart, onStop, onType, onSend, micMuted, soundOff, onToggleMic, onToggleSound }: TalkProps) {
  const live = state === "live";
  return (
    <div className="screen talk">
      <TitleBar title="" lang={lang} onBack={onBack} right={<LangPill lang={lang} onLanguage={onLanguage} />} />
      <div className="stage">
        {!live && <GuideFace large />}
        {live && <div className="avslot" data-avatar-slot="stage" />}
        {live && (
          <>
            <span className="stage-chip live-chip">
              <i />
              {t(lang, "liveNow")}
            </span>
            <button className="stage-chip end-chip" onClick={onStop}>
              <Icon name="endCall" />
              {t(lang, "endTalk")}
            </button>
          </>
        )}
      </div>
      <div className={"live" + (caption ? "" : " empty")} aria-live="polite">
        <b>
          <i />
          {t(lang, "guideSays")}
        </b>
        <span dir="auto">{caption || t(lang, "captionEmpty")}</span>
      </div>
      {state === "error" && (
        <p className="banner" role="alert">
          {t(lang, "talkError")}
          {error ? ` ${error}` : ""}
        </p>
      )}
      {sttMissing && (
        <p className="banner" role="status">
          {t(lang, "sttTypeNote")}
        </p>
      )}
      {state === "standin" && (
        <p className="banner" role="status">
          {t(lang, "talkStandin")}
        </p>
      )}
      <div className="micbig">
        {live ? (
          <>
            <button className="m" onClick={onToggleMic} aria-pressed={!!micMuted} aria-label={t(lang, micMuted ? "unmuteMic" : "muteMic")}>
              <Icon name="mic" />
            </button>
            <button className="icon-btn surface" onClick={onToggleSound} aria-pressed={!!soundOff} aria-label={t(lang, soundOff ? "soundOn" : "soundOff")}>
              <Icon name="volume" />
            </button>
          </>
        ) : (
          <>
            <button className="m" onClick={onStart} disabled={state === "connecting"} aria-label={t(lang, "startTalk")}>
              <Icon name="mic" />
            </button>
            <span>{state === "connecting" ? t(lang, "connecting") + "…" : t(lang, "startTalk")}</span>
          </>
        )}
      </div>
      <div className="foot">
        {live && onSend ? (
          <TypeBar lang={lang} onSend={onSend} />
        ) : (
          <button className="txt" onClick={onType}>
            {t(lang, "typeInstead")}
          </button>
        )}
      </div>
    </div>
  );
}
