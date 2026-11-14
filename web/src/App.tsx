import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import type { Clip, Guide, ToolLogEntry } from "./types";
import { LANGUAGES, t } from "./i18n";
import { cleanLanguage, isRtl, languageLabel, languageValue } from "./languages";
import { useAnam, type ToolHandler } from "./useAnam";
import { speak, stopSpeaking, voiceSettings } from "./speech";
import { applyTheme, dockOn, initialTheme, type Theme } from "./look";
import { forgetGuide, initialDemo, myGuideIds, rememberGuide, saveDemo } from "./mode";
import {
  AskScreen,
  AVATAR_VIDEO_ID,
  AvatarHost,
  LiveContext,
  type LiveInfo,
  CheckPhoto,
  ClipScreen,
  DevPanel,
  ErrorScreen,
  Home,
  MAX_FILES,
  MyPapers,
  type PaperRow,
  PrintSheet,
  Reading,
  Settings,
  StepScreen,
  Summary,
  summaryText,
  TalkScreen,
  TellBack,
  Tray,
  type Role,
  type TrayItem,
} from "./screens";

const SAFE_FALLBACK = "I can't check that right now. Please ask your pharmacist or GP.";
type Screen = "home" | "check" | "tray" | "reading" | "summary" | "step" | "clip" | "ask" | "talk" | "tellback" | "error" | "settings" | "papers";
const isSample = (g: Guide | null) => !!g && g.id.startsWith("g_sample");

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked: settings just last for this visit */
  }
}

let nextId = 1;
// A fetched guide can be older than a step_updated event already applied: keep any picture that has arrived.
function keepNewer(cur: Guide, next: Guide): Guide {
  const byIndex = new Map(cur.steps.map((s) => [s.index, s]));
  return {
    ...next,
    status: cur.status === "ready" ? "ready" : next.status,
    steps: next.steps.map((s) => {
      const old = byIndex.get(s.index);
      return old?.image_url && !s.image_url ? { ...s, image_url: old.image_url, status: old.status } : s;
    }),
  };
}
const fileUrl = (f: File) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null);

export default function App() {
  const [lang, setLang] = useState(() => load("er.lang", "en"));
  const [screen, setScreen] = useState<Screen>("home");
  const [prevScreen, setPrevScreen] = useState<Screen>("home");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [index, setIndex] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [langBusy, setLangBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string | null } | null>(null);
  const [log, setLog] = useState<ToolLogEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [items, setItems] = useState<TrayItem[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const [checking, setChecking] = useState<{ file: File; url: string | null } | null>(null);
  const [scale, setScale] = useState(() => load("er.scale", 1));
  const [rate, setRate] = useState(() => load("er.rate", 1));
  const [voice, setVoice] = useState(() => load("er.voice", true));
  // Customer mode by default; demo mode (?demo=1, the Settings switch, or a #/sample link) shows samples and dev tools.
  const [demo, setDemo] = useState(initialDemo);
  const [mine, setMine] = useState<string[]>(myGuideIds);
  const [papers, setPapers] = useState<PaperRow[] | null>(null);
  const [papersFailed, setPapersFailed] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const th = initialTheme();
    applyTheme(th); // before the first paint, so the page never flashes the old look
    return th;
  });

  const voiceRef = useRef(voice);
  const indexRef = useRef(0);
  const guideRef = useRef<Guide | null>(null);
  const langRef = useRef(lang);
  voiceRef.current = voice;
  indexRef.current = index;
  guideRef.current = guide;
  langRef.current = lang;
  voiceSettings.rate = rate;

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const go = useCallback((s: Screen) => {
    stopSpeaking();
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    save("er.lang", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.style.setProperty("--scale", String(scale));
    save("er.scale", scale);
  }, [scale]);
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => save("er.rate", rate), [rate]);
  useEffect(() => save("er.voice", voice), [voice]);
  useEffect(() => {
    void api.getLibrary().then(setClips);
  }, []);

  /* ---- live updates while the server writes and illustrates the guide ---- */
  const addLog = useCallback(
    (tool: string, args: Record<string, unknown>, ms: number, say: string, source: "browser" | "server" = "browser") => {
      setLog((l) => [{ at: Date.now(), tool, args, ms, say, source }, ...l].slice(0, 50));
    },
    [],
  );
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  useEffect(() => {
    if (!guide || isSample(guide)) return;
    const id = guide.id;
    // The whole guide, merged so a picture that already arrived is never lost to an older copy.
    const refresh = () =>
      void api
        .getGuide(id)
        .then((g) => setGuide((cur) => (cur && cur.id === id ? keepNewer(cur, g) : cur)))
        .catch(() => undefined);
    return api.subscribe(id, (e) => {
      if (e.type === "tool_log") {
        addLogRef.current(e.tool, e.args, e.ms, "", "server");
        return;
      }
      if (e.type === "guide_status") {
        setGuide((g) => (g ? { ...g, status: e.status } : g));
        // The steps' text is written once pictures start: fetch it so the summary can open early.
        if (e.status === "illustrating" || e.status === "ready") refresh();
      } else if (e.type === "step_updated") {
        if (!guideRef.current?.steps.some((s) => s.index === e.step.index)) refresh();
        setGuide((g) => (g ? { ...g, steps: g.steps.map((s) => (s.index === e.step.index ? e.step : s)) } : g));
      }
    });
  }, [guide?.id]);

  // Fallback if an event is missed: ask for the guide again until it is ready
  // (pictures keep arriving after the summary has opened).
  useEffect(() => {
    if (!guide || isSample(guide) || guide.status === "ready" || guide.status === "failed") return;
    const id = guide.id;
    const timer = setInterval(() => {
      api.getGuide(id).then((g) => setGuide((cur) => (cur && cur.id === id && cur.status !== "ready" ? keepNewer(cur, g) : cur))).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [guide?.id, guide?.status]);

  // Open the guide as soon as its steps are written; step pictures fill in live.
  const textDone = !!guide && guide.steps.length > 0 && (guide.status === "illustrating" || guide.status === "ready");
  useEffect(() => {
    if (screen !== "reading" || !guide) return;
    if (textDone) {
      // Let "Drawing the pictures" show as in progress for a moment, then open the summary.
      const timer = setTimeout(() => go("summary"), guide.status === "ready" ? 0 : 900);
      return () => clearTimeout(timer);
    }
    if (guide.status === "failed") {
      const code = guide.error_code;
      setError({ title: t(langRef.current, code === "not_a_document" ? "notAPaper" : "couldNotRead"),
                 detail: code === "unreadable" ? t(langRef.current, "clearerPhoto") : null });
      go("error");
    }
  }, [screen, guide?.status, textDone, go]);

  /* ---- client tools, CONTRACTS.md section 3. Each returns the short `say` text for the avatar ---- */
  const goto = useCallback((i: number) => {
    const total = guideRef.current?.steps.length ?? 0;
    const clamped = Math.max(0, Math.min(total - 1, i));
    setIndex(clamped);
    return clamped;
  }, []);

  const anamLangRef = useRef<(code: string) => void>(() => {});
  const handlers = useMemo<Record<string, ToolHandler>>(() => {
    const stepSay = (i: number) => {
      const s = guideRef.current?.steps[i];
      return s ? `Showing step ${i + 1}. ${s.text}` : "There is no such step.";
    };
    const g = () => guideRef.current;
    const server = async (name: string, args: Record<string, unknown>) => {
      if (!g() || isSample(g())) return SAFE_FALLBACK;
      return (await api.postTool(name, g()!.id, args)).say;
    };
    return {
      show_step: ({ index: i }) => {
        setScreen("step");
        return stepSay(goto(Number(i)));
      },
      next_step: () => {
        setScreen("step");
        return indexRef.current >= (g()?.steps.length ?? 1) - 1 ? "That was the last step." : stepSay(goto(indexRef.current + 1));
      },
      previous_step: () => {
        setScreen("step");
        return indexRef.current <= 0 ? "This is the first step." : stepSay(goto(indexRef.current - 1));
      },
      play_technique: ({ step_index }) => {
        const i = goto(Number(step_index));
        const step = g()?.steps[i];
        const clip = clips.find((c) => c.id === step?.technique_clip_id);
        setScreen("clip");
        return clip
          ? `${clip.unchecked ? "Playing a demo video that a pharmacist has not checked yet." : "Playing the checked video."} ${clip.caption_en}`
          : "I don't have a checked video for this step. Please ask your pharmacist to show you.";
      },
      answer_from_document: async ({ question: q }) => {
        if (!g()) return SAFE_FALLBACK;
        // Sample guides are loaded on the server too (g_sample_*), so they answer from their document as well.
        // With no server (offline demo) a sample falls back to the safe line instead of an error.
        let r: Awaited<ReturnType<typeof api.ask>>;
        try {
          r = await api.ask(g()!.id, String(q), langRef.current);
        } catch (e) {
          if (isSample(g())) return SAFE_FALLBACK;
          throw e;
        }
        const tail = r.escalate === "999" ? " If this is an emergency, call 999." : r.escalate === "111" ? " Call 111 for urgent advice." : "";
        return r.answer + tail;
      },
      check_understanding: (args) =>
        isSample(g())
          ? args.answer
            ? "Thank you. If you are not sure, go back through the steps or ask your pharmacist."
            : `In your own words, how do you use ${g()!.facts?.medicine ?? "your medicine"}?`
          : server("check_understanding", args),
      set_language: async ({ language }) => {
        const code = languageValue(String(language));
        if (!cleanLanguage(code)) return "I can't switch to that language yet.";
        setLang(code);
        anamLangRef.current(code);
        if (g() && isSample(g())) {
          const v = api.sampleVariant(g()!, code);
          if (v && v.id !== g()!.id) setGuide(v); // same screen and step index
        } else if (g()) {
          setLangBusy(true);
          try {
            setGuide(await api.setLanguage(g()!.id, code));
          } finally {
            setLangBusy(false);
          }
        }
        return `Switched to ${languageLabel(code)}.`;
      },
    };
  }, [clips, goto]);

  const anam = useAnam(AVATAR_VIDEO_ID, handlers, addLog);
  anamLangRef.current = anam.setLanguage;

  // The same client tools the avatar uses, driven by on-screen buttons. Logged to the dev
  // panel and read aloud, so the app works without Anam.
  const runTool = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      const t0 = performance.now();
      let say: string;
      try {
        say = await handlers[name](args);
      } catch {
        say = SAFE_FALLBACK;
      }
      addLog(name, args, Math.round(performance.now() - t0), say);
      if (voiceRef.current) void speak(say, langRef.current);
      return say;
    },
    [handlers, addLog],
  );

  /* ---- adding papers ---- */
  const addFiles = useCallback((files: File[]) => {
    setItems((cur) => {
      const room = MAX_FILES - cur.length;
      setTooMany(files.length > room);
      return [...cur, ...files.slice(0, Math.max(0, room)).map((file) => ({ id: nextId++, file, role: "auto" as Role, url: fileUrl(file) }))];
    });
  }, []);

  function onCamera(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setChecking({ file, url: fileUrl(file) });
    go("check");
  }
  function onUpload(list: FileList | null) {
    if (!list || list.length === 0) return;
    addFiles(Array.from(list));
    go("tray");
  }
  function useChecked() {
    if (checking) addFiles([checking.file]);
    setChecking(null);
    go("tray");
  }

  function startOver() {
    setGuide(null);
    setLog([]);
    setAnswer(null);
    setQuestion("");
    setError(null);
    go(items.length ? "tray" : "home");
  }

  // Several pages or papers go as repeated "document" fields, with `roles` in the same order (CONTRACTS.md section 2).
  async function makeGuide() {
    if (items.length === 0) return;
    setBusy(true);
    setUploading(true);
    setError(null);
    go("reading");
    try {
      const f = api.buildGuideForm(items, lang);
      const { guide_id } = await api.createGuide(f);
      rememberGuide(guide_id); // "My papers" on this device only
      setMine(myGuideIds());
      const g = await api.getGuide(guide_id);
      setGuide(g);
      setIndex(0);
      setAnswer(null);
    } catch (e) {
      setError({ title: t(lang, "couldNotRead"), detail: api.errorText(lang, e) });
      go("error");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  /* ---- My papers: the guides made on this device (ids kept in localStorage, CONTRACTS.md section 2) ---- */
  const loadPapers = useCallback(() => {
    const ids = myGuideIds();
    setMine(ids);
    setPapersFailed(false);
    setPapers(null);
    if (ids.length === 0) {
      setPapers([]);
      return;
    }
    api
      .listGuides(ids)
      .then((rows) => setPapers(rows))
      .catch(() => setPapersFailed(true));
  }, []);

  function openPapers() {
    loadPapers();
    go("papers");
  }

  async function openPaper(id: string) {
    try {
      const g = await api.getGuide(id);
      setGuide(g);
      setIndex(0);
      setAnswer(null);
      setLog([]);
      // No steps yet (still being read, or it failed): the progress screen opens the summary or the error when it can.
      go(g.steps.length ? "summary" : "reading");
    } catch (e) {
      if (e instanceof api.ApiError && e.code !== "server") {
        forgetGuide(id);
        setMine(myGuideIds());
        setPapers((rows) => rows?.filter((r) => r.id !== id) ?? rows);
        setError({ title: t(langRef.current, "paperGone"), detail: null });
        go("error");
      } else setPapersFailed(true);
    }
  }

  async function deletePaper(id: string) {
    try {
      await api.deleteGuide(id);
    } catch {
      setPapersFailed(true);
      return;
    }
    forgetGuide(id);
    setMine(myGuideIds());
    setPapers((rows) => rows?.filter((r) => r.id !== id) ?? rows);
    if (guideRef.current?.id === id) setGuide(null);
  }

  function changeDemo(on: boolean) {
    saveDemo(on);
    setDemo(on);
  }

  function openSample(name: string, to: Screen = "summary", at = 0) {
    const g = api.sampleFor(name, langRef.current);
    if (!g) return;
    setGuide(g);
    setIndex(at);
    setAnswer(null);
    setLog([]);
    go(to);
  }

  /* ---- hash routes, so each screen can be opened directly (demo and screenshots) ---- */
  useEffect(() => {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (!parts[0]) return;
    if (parts[0] === "sample") {
      const to = (parts[2] as Screen) || "summary";
      openSample(parts[1], to, Number(parts[3] ?? 0));
      if (to === "ask") setAnswer(null);
    } else if (parts[0] === "tray" || parts[0] === "check") {
      void Promise.all([0, 1, 2].map(async (i) => new File([await (await fetch(`/fixtures/img/step_${i}.png`)).blob()], `page-${i + 1}.png`, { type: "image/png" }))).then((fs) => {
        if (parts[0] === "check") {
          setChecking({ file: fs[0], url: URL.createObjectURL(fs[0]) });
          go("check");
          return;
        }
        setItems(fs.map((file, i) => ({ id: nextId++, file, role: (["label", "leaflet", "device_photo"] as Role[])[i], url: URL.createObjectURL(file) })));
        go("tray");
      });
    } else if (parts[0] === "reading") {
      setGuide({ ...api.sampleGuide, id: "g_demo", status: "writing" });
      go("reading");
    } else if (parts[0] === "error") {
      setError({ title: t(langRef.current, "couldNotRead"), detail: "This file is not a photo of a paper. Try another." });
      go("error");
    } else if (parts[0] === "settings") go("settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAsk(q?: string) {
    const text = (q ?? question).trim();
    if (!guide || !text || busy) return;
    setBusy(true);
    try {
      setAnswer(await runTool("answer_from_document", { question: text }));
    } finally {
      setBusy(false);
    }
  }

  function changeLanguage(code: string) {
    if (guide) void runTool("set_language", { language: code });
    else setLang(code);
  }

  function openSettings() {
    setPrevScreen(screen === "settings" ? prevScreen : screen);
    go("settings");
  }

  function print() {
    if (!guide) return;
    if (isSample(guide)) window.print();
    else window.open(`/api/guides/${guide.id}/sheet`, "_blank");
  }

  function setStep(i: number) {
    if (!guide) return;
    void runTool(i === index + 1 ? "next_step" : i === index - 1 ? "previous_step" : "show_step", { index: i });
  }

  // `?fakelive` (dev builds, demo mode only) shows the live layout without a real Anam session, for screenshots.
  const fakeLive = import.meta.env.DEV && demo && location.search.includes("fakelive");
  const status = uploading ? "uploading" : guide?.status ?? "uploading";
  const lastSay = log.find((l) => l.say)?.say ?? "";
  const liveState = fakeLive ? "live" : anam.state;
  const liveInfo: LiveInfo = {
    live: liveState === "live",
    lang,
    onEnd: () => void anam.stop(),
    micMuted: anam.micMuted,
    soundOff: anam.soundOff,
    onToggleMic: anam.toggleMic,
    onToggleSound: anam.toggleSound,
    onSend: anam.send,
    dock: dockOn(theme),
    caption: lastSay,
    onTalk: () => go("talk"),
  };


  return (
    <LiveContext.Provider value={liveInfo}>
      <div className="phone">
        <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { onCamera(e.target.files); e.target.value = ""; }} />
        <input ref={uploadRef} hidden multiple type="file" accept="application/pdf,image/*" onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />

        {screen === "home" && (
          <Home
            lang={lang}
            onLanguage={changeLanguage}
            onSettings={openSettings}
            onCamera={() => cameraRef.current?.click()}
            onUpload={() => uploadRef.current?.click()}
            onSample={demo ? (n) => openSample(n) : undefined}
            onPapers={openPapers}
            hasPapers={mine.length > 0}
          />
        )}
        {screen === "check" && checking && (
          <CheckPhoto lang={lang} url={checking.url} name={checking.file.name} onBack={() => { setChecking(null); go(items.length ? "tray" : "home"); }} onRetake={() => cameraRef.current?.click()} onUse={useChecked} />
        )}
        {screen === "tray" && (
          <Tray
            lang={lang}
            items={items}
            busy={busy}
            tooMany={tooMany}
            onLanguage={changeLanguage}
            onSettings={openSettings}
            onPapers={openPapers}
            onAdd={() => uploadRef.current?.click()}
            onRole={(id, r) => setItems((c) => c.map((i) => (i.id === id ? { ...i, role: r } : i)))}
            onRemove={(id) => {
              setTooMany(false);
              setItems((c) => {
                const next = c.filter((i) => i.id !== id);
                if (next.length === 0) setTimeout(() => go("home"), 0);
                return next;
              });
            }}
            onMove={(id, d) =>
              setItems((c) => {
                const i = c.findIndex((x) => x.id === id);
                const j = i + d;
                if (i < 0 || j < 0 || j >= c.length) return c;
                const n = [...c];
                [n[i], n[j]] = [n[j], n[i]];
                return n;
              })
            }
            onMake={() => void makeGuide()}
          />
        )}
        {screen === "reading" && <Reading lang={lang} status={status} />}
        {screen === "summary" && guide && (
          <Summary
            guide={guide}
            lang={lang}
            onLanguage={changeLanguage}
            onSettings={openSettings}
            onPapers={openPapers}
            onBack={startOver}
            onStart={() => { setIndex(0); go("step"); }}
            onListen={() => void speak(summaryText(guide), lang)}
          />
        )}
        {screen === "step" && guide && (
          <StepScreen
            guide={guide}
            index={index}
            lang={lang}
            clips={clips}
            onClose={() => go("summary")}
            onIndex={setStep}
            onFinish={() => go("ask")}
            onShowHow={() => void runTool("play_technique", { step_index: index })}
          />
        )}
        {screen === "clip" && guide && <ClipScreen guide={guide} index={index} lang={lang} clips={clips} onBack={() => go("step")} />}
        {screen === "ask" && guide && (
          <AskScreen
            guide={guide}
            lang={lang}
            question={question}
            answer={answer}
            busy={busy}
            onQuestion={setQuestion}
            onAsk={(q) => void onAsk(q)}
            onTalk={() => go("talk")}
            onTellBack={() => { void runTool("check_understanding", {}); go("tellback"); }}
            onPrint={print}
            onBack={() => go("step")}
          />
        )}
        {screen === "talk" && guide && (
          <TalkScreen
            lang={lang}
            state={liveState}
            error={anam.error}
            sttMissing={anam.sttMissing}
            caption={lastSay}
            onLanguage={changeLanguage}
            onBack={() => { void anam.stop(); go("ask"); }}
            onStart={() => void anam.start(guide.id, lang, index)}
            onStop={() => void anam.stop()}
            micMuted={anam.micMuted}
            soundOff={anam.soundOff}
            onToggleMic={anam.toggleMic}
            onToggleSound={anam.toggleSound}
            onType={() => { void anam.stop(); go("ask"); }}
            onSend={anam.send}
          />
        )}
        {screen === "tellback" && guide && (
          <TellBack guide={guide} lang={lang} onCheck={(a) => void runTool("check_understanding", { answer: a })} onClose={() => go("ask")} />
        )}
        {screen === "error" && (
          <ErrorScreen
            lang={lang}
            title={error?.title ?? t(lang, "couldNotRead")}
            detail={error?.detail ?? null}
            canRetry={items.length > 0}
            onRetry={() => void makeGuide()}
            onNewPhoto={() => cameraRef.current?.click()}
            onUpload={() => uploadRef.current?.click()}
            onBack={() => go(items.length ? "tray" : "home")}
          />
        )}
        {screen === "settings" && (
          <Settings
            lang={lang}
            scale={scale}
            rate={rate}
            voice={voice}
            theme={theme}
            onTheme={setTheme}
            onScale={setScale}
            onRate={setRate}
            onVoice={setVoice}
            onLanguage={changeLanguage}
            onBack={() => go(prevScreen === "settings" ? "home" : prevScreen)}
            demo={demo}
            onDemo={changeDemo}
          />
        )}
        {screen === "papers" && (
          <MyPapers
            lang={lang}
            rows={papers}
            failed={papersFailed}
            onBack={() => go(items.length ? "tray" : "home")}
            onOpen={(id) => void openPaper(id)}
            onDelete={(id) => void deletePaper(id)}
            onRetry={loadPapers}
            onNew={() => cameraRef.current?.click()}
          />
        )}

        {langBusy && (
          <p className="banner lang-busy" role="status">
            {t(lang, "changingLanguage")}
          </p>
        )}
        {demo && <DevPanel log={log} lang={lang} />}
      </div>
      {guide && <PrintSheet guide={guide} lang={lang} />}
      <AvatarHost live={liveInfo.live} screen={screen} />
    </LiveContext.Provider>
  );
}
