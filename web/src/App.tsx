import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import type { Clip, Guide, ToolLogEntry } from "./types";
import { LANGUAGES, RTL, t } from "./i18n";
import { useAnam, type ToolHandler } from "./useAnam";
import Upload from "./components/Upload";
import StepViewer from "./components/StepViewer";
import AvatarPanel, { AVATAR_VIDEO_ID } from "./components/AvatarPanel";
import DevPanel from "./components/DevPanel";

const SAFE_FALLBACK = "I can't check that right now. Please ask your pharmacist or GP.";

export default function App() {
  const [lang, setLang] = useState("en");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [index, setIndex] = useState(0);
  const [playClip, setPlayClip] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<ToolLogEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const indexRef = useRef(0);
  const guideRef = useRef<Guide | null>(null);
  const langRef = useRef(lang);
  indexRef.current = index;
  guideRef.current = guide;
  langRef.current = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    void api.getLibrary().then(setClips);
  }, []);

  // Live updates while the server writes and illustrates the guide.
  useEffect(() => {
    if (!guide || guide.status === "ready" || guide.status === "failed" || guide.id.startsWith("g_sample")) return;
    return api.subscribe(guide.id, (e) => {
      if (e.type === "guide_status") setGuide((g) => (g ? { ...g, status: e.status } : g));
      else if (e.type === "step_updated")
        setGuide((g) => (g ? { ...g, steps: g.steps.map((s) => (s.index === e.step.index ? e.step : s)) } : g));
    });
  }, [guide?.id, guide?.status]);

  const goto = useCallback((i: number, withClip = false) => {
    const total = guideRef.current?.steps.length ?? 0;
    const clamped = Math.max(0, Math.min(total - 1, i));
    setIndex(clamped);
    setPlayClip(withClip);
    return clamped;
  }, []);

  const addLog = useCallback((tool: string, args: Record<string, unknown>, ms: number, say: string) => {
    setLog((l) => [{ at: Date.now(), tool, args, ms, say }, ...l].slice(0, 50));
  }, []);

  // Client tools, CONTRACTS.md §3. Each returns the short `say` text for the avatar.
  const handlers = useMemo<Record<string, ToolHandler>>(() => {
    const stepSay = (i: number) => {
      const s = guideRef.current?.steps[i];
      return s ? `Showing step ${i + 1}. ${s.text}` : "There is no such step.";
    };
    const g = () => guideRef.current;
    const server = async (name: string, args: Record<string, unknown>) => {
      if (!g() || g()!.id.startsWith("g_sample")) return SAFE_FALLBACK;
      return (await api.postTool(name, g()!.id, args)).say;
    };
    return {
      show_step: ({ index: i }) => stepSay(goto(Number(i))),
      next_step: () =>
        indexRef.current >= (g()?.steps.length ?? 1) - 1
          ? "That was the last step."
          : stepSay(goto(indexRef.current + 1)),
      previous_step: () =>
        indexRef.current <= 0 ? "This is the first step." : stepSay(goto(indexRef.current - 1)),
      play_technique: ({ step_index }) => {
        const i = goto(Number(step_index), true);
        const step = g()?.steps[i];
        const clip = clips.find((c) => c.id === step?.technique_clip_id);
        return clip
          ? `Playing the checked video. ${clip.caption_en}`
          : "I don't have a checked video for this step. Please ask your pharmacist to show you.";
      },
      answer_from_document: async ({ question: q }) => {
        if (!g() || g()!.id.startsWith("g_sample")) return SAFE_FALLBACK;
        const r = await api.ask(g()!.id, String(q), langRef.current);
        const tail =
          r.escalate === "999" ? " If this is an emergency, call 999." : r.escalate === "111" ? " Call 111 for urgent advice." : "";
        return r.answer + tail;
      },
      check_understanding: (args) => server("check_understanding", args),
      set_language: async ({ language }) => {
        const code = String(language);
        if (!LANGUAGES.some((l) => l.code === code)) return "I can't switch to that language yet.";
        setLang(code);
        if (g() && !g()!.id.startsWith("g_sample")) setGuide(await api.setLanguage(g()!.id, code));
        return `Switched to ${LANGUAGES.find((l) => l.code === code)!.label}.`;
      },
    };
  }, [clips, goto]);

  const anam = useAnam(AVATAR_VIDEO_ID, handlers, addLog);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const { guide_id } = await api.createGuide(form);
      setGuide(await api.getGuide(guide_id));
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!guide || !question.trim()) return;
    try {
      const r = await api.ask(guide.id, question, lang);
      setAnswer(r.answer + (r.escalate === "999" ? " Call 999." : ""));
    } catch {
      setAnswer(SAFE_FALLBACK);
    }
  }

  function changeLanguage(code: string) {
    setLang(code);
    if (guide && !guide.id.startsWith("g_sample")) void api.setLanguage(guide.id, code).then(setGuide);
  }

  return (
    <div className="app">
      <header className="top">
        <strong>{t(lang, "title")}</strong>
        <label>
          <span className="sr">{t(lang, "language")}</span>
          <select value={lang} onChange={(e) => changeLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      {!guide ? (
        <Upload
          lang={lang}
          busy={busy}
          onLanguage={setLang}
          onSubmit={(f) => void submit(f)}
          onSample={() => {
            setGuide(api.sampleGuide);
            setIndex(0);
          }}
        />
      ) : (
        <main className="split">
          <AvatarPanel
            state={anam.state}
            error={anam.error}
            onStart={() => void anam.start(guide.id, lang)}
            onStop={() => void anam.stop()}
          />
          <div className="right">
            {guide.status !== "ready" && <p className="banner">{t(lang, "working")}</p>}
            {guide.source.is_sample && <p className="note">{t(lang, "sampleNote")}</p>}
            {guide.steps.length > 0 && (
              <StepViewer guide={guide} index={index} lang={lang} clips={clips} playClip={playClip} onIndex={(i) => goto(i)} />
            )}
            <form className="card askbox" onSubmit={(e) => void onAsk(e)}>
              <label className="field">
                <span>{t(lang, "ask")}</span>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} />
              </label>
              <button className="btn" type="submit">
                {t(lang, "askGo")}
              </button>
              {answer && <p className="answer">{answer}</p>}
            </form>
            <button className="btn" onClick={() => window.print()}>
              {t(lang, "print")}
            </button>
          </div>
        </main>
      )}

      <footer className="foot">
        <a className="sos" href="tel:999">
          {t(lang, "emergency")}
        </a>
        <p className="note">{t(lang, "noMedical")}</p>
        <DevPanel log={log} lang={lang} />
      </footer>
    </div>
  );
}
