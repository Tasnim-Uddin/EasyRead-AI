import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import type { Clip, Guide, ToolLogEntry } from "./types";
import { LANGUAGES, t, tf } from "./i18n";
import { cleanLanguage, isRtl, languageLabel, languageValue } from "./languages";
import { CONNECT_BUDGET_MS, useAnam, type ToolHandler } from "./useAnam";
import { audioOwner, claimAudio, onAudioChange, setGuideQuiet, speak, stopSpeaking, voiceSettings } from "./speech";
import { applyTheme, dockOn, initialTheme, type Theme } from "./look";
import { forgetGuide, initialDemo, myGuideIds, rememberGuide, saveDemo } from "./mode";
import { GuideStage, type AskInfo } from "./stage/GuideStage";
import { whoToAsk } from "./stage/machine";
import {
  AskScreen,
  AVATAR_VIDEO_ID,
  AvatarHost,
  LiveContext,
  PaperViewer,
  paperImages,
  NavContext,
  type LiveInfo,
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
  TalkScreen,
  TellBack,
  Tray,
  type Role,
  type TrayItem,
} from "./screens";
import { ExtrasHost, extrasOnGuide, guideRows, needsWelcome, renameRow, saveProgress, type Extra } from "./extras/app";
import { CameraScreen, type Shot } from "./camera/Camera";
import { CropScreen, type Cropped } from "./camera/Crop";
import { QualityScreen } from "./camera/Quality";
import { AddPaperSheet } from "./camera/AddPaper";
import type { Quad } from "./camera/detect";
import { backAction, canGoBack, createHistory, moveTo, previous, push as pushScreen, replace as replaceScreen, type ScreenHistory } from "./nav/history";
import { resumeTarget } from "./nav/resume";
import { getProgress } from "./extras/guides";
import "./nav/strings";

/** The Q&A could not answer (server error): a plain line in the user's language, never advice. */
let fallbackLang = "en";
const safeFallback = () => t(fallbackLang, "gs_qaFailed");
/** The guide has this long to join before the steps open in Read mode instead (Figma 19a). */

// "done" is the "You did it" page after the last step: its own screen, so Back from Save or share lands on it.
type Screen = "home" | "camera" | "check" | "quality" | "tray" | "reading" | "step" | "done" | "clip" | "ask" | "talk" | "tellback" | "error" | "settings" | "papers" | Extra;
const isSample = (g: Guide | null) => !!g && g.id.startsWith("g_sample");
/** Screens where the live guide may keep running. Anywhere else ends the session. */
const GUIDE_FLOW = new Set<Screen>(["step", "done", "clip", "ask", "talk", "tellback"]);

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
  // `?lang=ar` opens the app in that language (demo and screenshot links); otherwise the remembered one.
  const [lang, setLang] = useState(() => cleanLanguage(new URLSearchParams(location.search).get("lang") ?? "") || load("er.lang", "en"));
  const [screen, setScreen] = useState<Screen>(() => (needsWelcome() ? "welcome" : "home"));
  // The screens the user went through (nav/history.ts), mirrored into the browser's history so every Back agrees.
  const [hist, setHist] = useState<ScreenHistory<Screen>>(() => createHistory(screen));
  const histRef = useRef(hist);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [index, setIndex] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [langBusy, setLangBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string | null; code?: string | null } | null>(null);
  const [log, setLog] = useState<ToolLogEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [items, setItems] = useState<TrayItem[]>([]);
  const [tooMany, setTooMany] = useState(false);
  // Photos waiting for "Can you read all of it?": every photo (camera or added) is checked one at a time.
  const [checkQueue, setCheckQueue] = useState<{ file: File; url: string | null; guess?: Quad | null }[]>([]);
  // v4 capture: the "Add a paper" sheet, and a cropped photo waiting on the photo check (17a).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingQuality, setPendingQuality] = useState<Cropped | null>(null);
  const checking = checkQueue[0] ?? null;
  const [guideSeq, setGuideSeq] = useState(0);
  const retakingRef = useRef(false); // the next picked file replaces the photo being checked
  const [scale, setScale] = useState(() => load("er.scale", 1));
  const [rate, setRate] = useState(() => load("er.rate", 1));
  const [voice, setVoice] = useState(() => load("er.voice", true));
  // Guide-led: the live guide is on by default (it still needs one tap to start, browsers block audio before that).
  const [guideOn, setGuideOn] = useState(() => (/[?&]guide=0/.test(location.search) ? false : load("er.guideOn", true)));
  const [moved, setMoved] = useState<number | null>(null); // "Your guide moved you to step N"
  // v4 guide stage: Read mode (no avatar, no sound), the "can't connect" fall-back, and the last grounded answer.
  const [readMode, setReadMode] = useState(false);
  const [cantConnect, setCantConnect] = useState(false);
  const [askInfo, setAskInfo] = useState<AskInfo | null>(null);
  const [moveSeq, setMoveSeq] = useState(0); // +1 each time the avatar moves the steps with a tool
  const askSeq = useRef(0);
  const movedFrom = useRef(0);
  const [paperOpen, setPaperOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(() => import.meta.env.DEV && /[?&]asksheet/.test(location.search)); // screenshot hook
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
  fallbackLang = lang;
  voiceSettings.rate = rate;

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const screenRef = useRef<Screen>("home");
  screenRef.current = screen;
  const setHistory = useCallback((h: ScreenHistory<Screen>) => {
    histRef.current = h;
    setHist(h);
  }, []);
  // Each screen change is a browser history entry (state = screen + depth in the stack), so the phone's Back
  // button, the Android back gesture and the app's back arrow all move through the same stack.
  const go = useCallback((s: Screen, replace = false) => {
    stopSpeaking();
    if (s !== "step" && s !== "done") setAskOpen(false);
    if (s !== screenRef.current) {
      const h = replace ? replaceScreen(histRef.current, s) : pushScreen(histRef.current, s);
      setHistory(h);
      try {
        // Same URL, screen kept in history state: writing the hash would fire hashchange, which reloads (main.tsx).
        if (replace) history.replaceState({ screen: s, depth: h.at }, "");
        else history.pushState({ screen: s, depth: h.at }, "");
      } catch {
        /* history blocked: still change screen */
      }
    }
    screenRef.current = s;
    setScreen(s);
    window.scrollTo(0, 0);
  }, [setHistory]);
  /** The back arrow: the previous screen in the stack (the browser's Back does the same), or Home when nothing is behind. */
  const back = useCallback(() => {
    const a = backAction(histRef.current, "home" as Screen);
    if (a.kind === "pop") {
      try {
        window.history.back(); // popstate below moves the stack and the screen
        return;
      } catch {
        /* history blocked: fall through */
      }
    }
    go("home", true);
  }, [go]);
  useEffect(() => {
    try {
      // The entry the app opened on is depth 0 (only while nothing has been pushed yet: StrictMode runs this twice).
      if (histRef.current.at === 0) history.replaceState({ screen: screenRef.current, depth: 0 }, "");
    } catch {
      /* history blocked */
    }
    const onPop = (e: PopStateEvent) => {
      const st = (e.state as { screen?: Screen; depth?: number } | null) ?? {};
      const s = st.screen ?? "home";
      setHistory(moveTo(histRef.current, st.depth ?? 0, s));
      stopSpeaking();
      setAskOpen(false);
      screenRef.current = s;
      setScreen(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setHistory]);
  useEffect(() => save("er.guideOn", guideOn), [guideOn]);
  // Browser Back/Forward can land on a screen whose data is gone (a checked photo, a deleted guide): never a blank page.
  useEffect(() => {
    if (screen === "check" && !checking) go(items.length ? "tray" : "home", true);
    else if (screen === "quality" && !pendingQuality) go(checking ? "check" : items.length ? "tray" : "home", true);
    else if (!guide && ["step", "done", "clip", "ask", "talk", "tellback", "share"].includes(screen)) go("home", true);
    else if (screen === "tray" && items.length === 0) go("home", true);
    else if (screen === "reading" && !guide && !uploading) go(items.length ? "tray" : "home", true);
  }, [screen, checking, pendingQuality, guide, items.length, uploading, go]);

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
  // v4 extras: remember the step reached (My guides "Continue"), the guide's type and own photo.
  useEffect(() => extrasOnGuide(guide), [guide?.id, guide?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Opening the guide again from My guides resumes here (nav/resume.ts); finished guides open on "You did it".
    if (guide && screen === "step") saveProgress(guide.id, index, guide.steps.length);
    if (guide && (screen === "done" || screen === "tellback")) saveProgress(guide.id, guide.steps.length - 1, guide.steps.length, true);
  }, [guide?.id, index, screen]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // The guide opens once everything (text and pictures) is ready: one smooth loading bar until then.
  const textDone = !!guide && guide.steps.length > 0 && guide.status === "ready";
  useEffect(() => {
    if (screen !== "reading" || !guide) return;
    if (textDone) {
      // Let the bar reach the end for a moment, then open the summary.
      // Replace the progress entry, so Back from the summary never lands on a finished progress screen.
      // Figma: loading -> guide intro. The stage opens on the intro (Read mode when the guide is switched off).
      const timer = setTimeout(() => {
        setIndex(0);
        setCantConnect(false);
        setReadMode(!guideOn);
        go("step", true);
      }, 400);
      return () => clearTimeout(timer);
    }
    if (guide.status === "failed") {
      const code = guide.error_code;
      const L = langRef.current;
      // Photo tips only for photo problems; server faults get a plain, translated line.
      setError({
        code,
        title: t(L, code === "not_a_document" ? "notAPaper" : code === "ai_timeout" ? "errTimeout" : code === "demo_mode_no_key" ? "errDemoKey" : code === "image_unreadable" ? "errImage" : "couldNotRead"),
        detail: code === "unreadable" || code === "image_unreadable" ? t(L, "clearerPhoto") : null,
      });
      go("error");
    }
  }, [screen, guide?.status, textDone, go]);

  /* ---- client tools, CONTRACTS.md section 3. Each returns the short `say` text for the avatar ---- */
  const goto = useCallback((i: number) => {
    const total = guideRef.current?.steps.length ?? 0;
    if (total === 0) return 0;
    const n = Number.isFinite(i) ? Math.round(i) : indexRef.current; // a missing or bad index keeps the current step
    const clamped = Math.max(0, Math.min(total - 1, n));
    setIndex(clamped);
    return clamped;
  }, []);

  const anamLangRef = useRef<(code: string) => void>(() => {});
  const anamRelangRef = useRef<(code: string, stepIndex: number) => Promise<void>>(async () => {});
  const anamStopRef = useRef<() => Promise<void>>(async () => {});
  const handlers = useMemo<Record<string, ToolHandler>>(() => {
    const stepSay = (i: number) => {
      const s = guideRef.current?.steps[i];
      return s ? tf(langRef.current, "nav_showingStep", { n: i + 1, text: s.text }) : t(langRef.current, "nav_noSuchStep");
    };
    const g = () => guideRef.current;
    const server = async (name: string, args: Record<string, unknown>) => {
      if (!g() || isSample(g())) return safeFallback();
      return (await api.postTool(name, g()!.id, args)).say;
    };
    // The guide may only move the steps while the user is looking at them; elsewhere it is ignored, never yanking the user.
    const offSteps = () => screenRef.current !== "step" && screenRef.current !== "clip";
    const OFF = "The user is on another screen, so the step was not changed. Talk with them about what they are looking at.";
    const guideMove = (i: number) => {
      const before = indexRef.current;
      const to = goto(i);
      setMoveSeq((n) => n + 1);
      if (to !== before) {
        movedFrom.current = before;
        setMoved(to + 1);
      }
      if (screenRef.current === "clip") go("step");
      return stepSay(to);
    };
    return {
      show_step: ({ index: i }) => (offSteps() ? OFF : guideMove(Number(i))),
      next_step: () =>
        offSteps() ? OFF : indexRef.current >= (g()?.steps.length ?? 1) - 1 ? t(langRef.current, "nav_lastStep") : guideMove(indexRef.current + 1),
      previous_step: () => (offSteps() ? OFF : indexRef.current <= 0 ? t(langRef.current, "nav_firstStep") : guideMove(indexRef.current - 1)),
      play_technique: ({ step_index }) => {
        if (offSteps()) return OFF;
        const i = goto(Number(step_index));
        const step = g()?.steps[i];
        const clip = clips.find((c) => c.id === step?.technique_clip_id);
        if (clip) go("clip");
        return clip
          ? `${t(langRef.current, clip.unchecked ? "nav_clipUnchecked" : "nav_clipChecked")} ${clip.caption_en}`
          : t(langRef.current, "nav_noClip");
      },
      answer_from_document: async ({ question: q }) => {
        if (!g()) return safeFallback();
        // Sample guides are loaded on the server too (g_sample_*), so they answer from their document as well.
        // With no server (offline demo) a sample falls back to the safe line instead of an error.
        let r: Awaited<ReturnType<typeof api.ask>>;
        try {
          r = await api.ask(g()!.id, String(q), langRef.current);
        } catch (e) {
          if (isSample(g())) return safeFallback();
          throw e;
        }
        // The app adds no advice of its own: the answer, and who to ask when the paper does not say.
        askSeq.current += 1;
        const who = whoToAsk(g()?.sender, r.ask_who);
        setAskInfo({ seq: askSeq.current, grounded: r.grounded, askWho: who });
        if (!r.grounded) {
          return `${r.answer} (Not on the paper.${who ? ` Who to ask: ${who}.` : " Tell them to ask whoever sent it."})`;
        }
        return r.answer;
      },
      check_understanding: (args) =>
        isSample(g())
          ? typeof args.correct === "boolean"
            ? t(langRef.current, args.correct ? "tbRight" : "tbWrong")
            : args.answer
            ? t(langRef.current, "nav_tbThanks")
            : t(langRef.current, "nav_tbAsk")
          : server("check_understanding", args),
      set_language: async ({ language }) => {
        const code = languageValue(String(language));
        if (!cleanLanguage(code)) return t(langRef.current, "nav_noLang");
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
        // The live guide speaks with the voice chosen at session start: start her again in the new language.
        void anamRelangRef.current(code, indexRef.current);
        return tf(code, "nav_switched", { lang: languageLabel(code) });
      },
    };
  }, [clips, goto, go]);

  const anam = useAnam(AVATAR_VIDEO_ID, handlers, addLog);
  anamLangRef.current = anam.setLanguage;
  anamRelangRef.current = anam.relanguage;
  anamStopRef.current = anam.stop;
  // Leaving the steps / questions / check (Home, My papers, Settings, Summary, a new paper, browser Back)
  // ends the live session: stream stopped, mic released, audio off. It never keeps talking off-screen.
  useEffect(() => {
    if (!GUIDE_FLOW.has(screen) && (anam.state === "live" || anam.state === "connecting")) void anam.stop();
  }, [screen, anam.state, anam.stop]);
  setGuideQuiet(anam.quiet);

  /* ---- v4 guide stage: the live guide runs only on the steps in guide mode ---- */
  const wantLive = screen === "step" && !readMode && !!guide;
  const wantLiveRef = useRef(wantLive);
  wantLiveRef.current = wantLive;
  // Read mode ends the session (no avatar, no sound).
  useEffect(() => {
    if (readMode && (anam.state === "live" || anam.state === "connecting")) void anam.stop();
  }, [readMode, anam.state, anam.stop]);
  // Guide mode on the steps: join the guide (it was started on the tap that opened the steps, or start it now).
  const fakeLiveStage = import.meta.env.DEV && demo && location.search.includes("fakelive");
  useEffect(() => {
    if (!wantLive || !guide || fakeLiveStage) return;
    if (anam.state === "idle") {
      claimAudio("guide");
      void anam.start(guide.id, langRef.current, indexRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantLive, guide?.id, anam.state]);
  // Could not connect (no key, refused, or not live after a quiet retry), or the session dropped: calm Read mode (19a).
  const fallBack = useCallback(() => {
    if (!wantLiveRef.current) return;
    setCantConnect(true);
    setReadMode(true);
    void anamStopRef.current();
  }, []);
  useEffect(() => {
    if (!wantLive || fakeLiveStage) return;
    if (anam.state === "error" || anam.state === "standin") {
      fallBack();
      return;
    }
    if (anam.state !== "connecting") return;
    const timer = setTimeout(fallBack, CONNECT_BUDGET_MS);
    return () => clearTimeout(timer);
  }, [wantLive, anam.state, fallBack, fakeLiveStage]);
  const wasLive = useRef(false);
  useEffect(() => {
    if (anam.state === "live") wasLive.current = true;
    else if (anam.state === "idle" && wasLive.current) {
      wasLive.current = false;
      // Dropped while the user was on the steps in guide mode (not ended by the app): fall back to Read mode.
      if (wantLiveRef.current && !stoppingRef.current) fallBack();
    }
    stoppingRef.current = false;
  }, [anam.state, fallBack]);
  const stoppingRef = useRef(false);
  const fakeLiveEarly = import.meta.env.DEV && demo && location.search.includes("fakelive");
  const isLive = fakeLiveEarly || anam.state === "live";
  const [owner, setOwner] = useState(audioOwner());
  useEffect(() => onAudioChange(() => setOwner(audioOwner())), []);
  const liveRef = useRef(isLive);
  liveRef.current = isLive;
  useEffect(() => {
    if (anam.state === "live") claimAudio("guide");
  }, [anam.state]);
  useEffect(() => {
    if (moved === null) return;
    const timer = setTimeout(() => setMoved(null), 5000);
    return () => clearTimeout(timer);
  }, [moved]);

  // The same client tools the avatar uses, driven by on-screen buttons. Logged to the dev
  // panel and read aloud, so the app works without Anam.
  const runTool = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      const t0 = performance.now();
      let say: string;
      try {
        say = await handlers[name](args);
      } catch {
        say = safeFallback();
      }
      addLog(name, args, Math.round(performance.now() - t0), say);
      // One voice: while the guide is live it speaks; read-aloud stays quiet.
      if (liveRef.current) {
        if (name === "check_understanding" && typeof args.correct === "boolean") anam.talk(say);
      } else if (voiceRef.current) void speak(say, langRef.current);
      return say;
    },
    [handlers, addLog, anam.talk],
  );

  /* ---- adding papers ---- */
  const addFiles = useCallback((files: File[], quad?: Quad | null, url?: string) => {
    setItems((cur) => {
      const room = MAX_FILES - cur.length;
      setTooMany(files.length > room);
      return [...cur, ...files.slice(0, Math.max(0, room)).map((file) => ({ id: nextId++, file, role: "auto" as Role, url: url ?? fileUrl(file), quad: quad ?? null }))];
    });
  }, []);

  // Photos join the check queue; a PDF has nothing to look at, so it goes straight onto the tray.
  function queueFiles(files: File[], guess?: Quad | null, stay = false, shotUrl?: string) {
    if (files.length === 0) return;
    const retake = retakingRef.current;
    retakingRef.current = false;
    const photos = files.filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: shotUrl ?? fileUrl(file), guess }));
    const other = files.filter((f) => !f.type.startsWith("image/"));
    if (other.length) addFiles(other);
    if (photos.length === 0) {
      if (!retake) go("tray");
      return;
    }
    setCheckQueue((q) => {
      if (retake && q.length) {
        if (q[0].url) URL.revokeObjectURL(q[0].url);
        return [...photos, ...q.slice(1)];
      }
      return [...q, ...photos];
    });
    if (!stay) go("check", screenRef.current === "check" || screenRef.current === "camera");
  }
  function onCamera(list: FileList | null) {
    const file = list?.[0];
    if (file) queueFiles([file]);
    else retakingRef.current = false;
  }
  function onUpload(list: FileList | null) {
    if (!list || list.length === 0) {
      retakingRef.current = false;
      return;
    }
    queueFiles(Array.from(list));
  }
  function retake() {
    retakingRef.current = true;
    setPendingQuality(null);
    // A photo from the camera is retaken with the camera; an added picture is picked again.
    if (checkSource.current === "upload") uploadRef.current?.click();
    else go("camera", true);
  }
  // A new paper from Home (or My guides): the pages of the last guide are not carried into the next one.
  function freshPaper() {
    if (checkQueue.length) return;
    setItems([]);
    setTooMany(false);
  }
  function openCamera() {
    setSheetOpen(false);
    checkSource.current = "camera";
    go("camera");
  }
  // In-app camera: "Take photo" goes on to the corners; "Add another page" queues it and stays.
  function onShot(shot: Shot, more: boolean) {
    checkSource.current = "camera";
    queueFiles([shot.file], shot.guess, more, shot.url);
  }
  function closeCamera() {
    retakingRef.current = false;
    go(checkQueue.length ? "check" : items.length ? "tray" : "home", true);
  }
  function pickFiles(files: File[]) {
    setSheetOpen(false);
    checkSource.current = "upload";
    queueFiles(files);
  }
  // Corners set: the photo check (17a) comes first when the server found a problem.
  function onCropped(c: Cropped, more: boolean) {
    if (c.quality && !c.quality.ok) {
      setPendingQuality(c);
      go("quality");
      return;
    }
    acceptCropped(c, more);
  }
  function acceptCropped(c: Cropped, more = false) {
    retakingRef.current = false;
    setPendingQuality(null);
    addFiles([c.file], c.quad, c.url);
    const rest = checkQueue.slice(1);
    setCheckQueue(rest);
    if (rest.length) go("check", true);
    else if (more) {
      go("tray", true);
      setSheetOpen(true);
    } else if (items.length === 0) {
      // One page: no tray, straight on to making the guide (the paper kind is worked out on the server).
      autoMakeRef.current = true;
    } else go("tray", true);
  }
  const autoMakeRef = useRef(false);
  useEffect(() => {
    if (!autoMakeRef.current || items.length === 0) return;
    autoMakeRef.current = false;
    void makeGuide(true); // replaces the crop screen: Back from the loading screen goes home
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const checkSource = useRef<"camera" | "upload">("camera");
  function dropChecking() {
    retakingRef.current = false;
    for (const c of checkQueue) if (c.url) URL.revokeObjectURL(c.url);
    setCheckQueue([]);
    go(items.length ? "tray" : "home", true);
  }

  // Everything that belongs to one guide, cleared whenever another guide opens.
  function resetGuideState() {
    stoppingRef.current = true;
    void anamStopRef.current(); // a different guide never inherits the old guide's live session
    setCantConnect(false);
    setAskInfo(null);
    setGuideSeq((n) => n + 1); // remounts the per-guide screens (check results, typed text)
    setAnswer(null);
    setQuestion("");
    setMoved(null);
    setAskOpen(false);
    setPaperOpen(false);
    setLog([]);
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
  async function makeGuide(replace = false) {
    if (items.length === 0) return;
    setBusy(true);
    setUploading(true);
    setError(null);
    go("reading", replace);
    try {
      const f = api.buildGuideForm(items, lang);
      const { guide_id } = await api.createGuide(f);
      rememberGuide(guide_id); // "My papers" on this device only
      setMine(myGuideIds());
      const g = await api.getGuide(guide_id);
      resetGuideState();
      setGuide(g);
      setIndex(0);
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
      setPapers(guideRows([], demo));
      return;
    }
    api
      .listGuides(ids)
      .then((rows) => setPapers(guideRows(rows, demo)))
      .catch(() => setPapersFailed(true));
  }, [demo]);
  useEffect(() => {
    if (screen === "home") loadPapers();
  }, [screen === "home"]); // eslint-disable-line react-hooks/exhaustive-deps

  function openPapers() {
    loadPapers();
    go("papers");
  }

  async function openPaper(id: string, at?: number) {
    try {
      const sample = id.startsWith("g_sample") ? Object.values(api.SAMPLES).find((x) => x.id === id) : undefined;
      let g = sample ? api.sampleVariant(sample, langRef.current) ?? sample : await api.getGuide(id);
      // A saved guide made or last read in another language opens in the app's language (same as switching in Settings).
      if (!sample && g.status === "ready" && g.steps.length && g.language && g.language !== langRef.current) {
        setLangBusy(true);
        try {
          g = await api.setLanguage(id, langRef.current);
        } catch {
          /* keep it in its saved language rather than not opening it */
        } finally {
          setLangBusy(false);
        }
      }
      resetGuideState();
      setGuide(g);
      // Never a restart: the step the user left off on, or "You did it" when they finished it (nav/resume.ts).
      const to = resumeTarget(g.steps.length, getProgress(id), at);
      setIndex(to.index);
      // Not ready yet (still being made, or it failed): the progress screen opens the guide or the error when it can.
      setReadMode(!guideOn);
      setCantConnect(false);
      go(g.status === "ready" && g.steps.length ? to.screen : "reading");
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

  function openSample(name: string, to: Screen = "step", at = 0) {
    const g = api.sampleFor(name, langRef.current);
    if (!g) return;
    resetGuideState();
    setGuide(g);
    setIndex(at);
    setReadMode(!guideOn);
    setCantConnect(false);
    // The old summary page is gone: an old #/sample/x/summary link opens the steps.
    go((to as string) === "summary" ? "step" : to);
  }

  /* ---- hash routes, so each screen can be opened directly (demo and screenshots) ---- */
  useEffect(() => {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (!parts[0]) return; // the first history entry was set when the app opened (depth 0)
    if (parts[0] === "sample") {
      const to = (parts[2] as Screen) || "step";
      openSample(parts[1], to, Number(parts[3] ?? 0));
      if (to === "ask") setAnswer(null);
    } else if (parts[0] === "tray" || parts[0] === "check") {
      void Promise.all([0, 1, 2].map(async (i) => new File([await (await fetch(`/fixtures/img/step_${i}.png`)).blob()], `page-${i + 1}.png`, { type: "image/png" }))).then((fs) => {
        if (parts[0] === "check") {
          setCheckQueue([{ file: fs[0], url: URL.createObjectURL(fs[0]) }]);
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
    else if (parts[0] === "papers") openPapers();
    else if (["privacy", "language", "welcome"].includes(parts[0])) go(parts[0] as Screen);
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
    go("settings"); // Back returns to the screen it was opened from (the history stack)
  }

  function print() {
    if (guide) go("share"); // Save or share: Share, Print and Save as PDF of the same one-page sheet
  }

  // The user moved: change the step, then tell the live guide (it reads the new step) or read it aloud.
  function setStep(i: number) {
    if (!guide) return;
    const to = goto(i);
    setMoved(null);
    addLog(to === index + 1 ? "next_step" : to === index - 1 ? "previous_step" : "show_step", { index: to }, 0, "user tap");
    if (liveRef.current) {
      anam.interrupt();
      anam.send(`User moved to step ${to + 1} (index ${to}). The screen shows: "${guide.steps[to]?.text ?? ""}". Read exactly this step aloud.`);
    } else if (voiceRef.current && guideOn) void speak(guide.steps[to]?.text ?? "", lang);
  }

  // Live: the guide answers out loud (one voice); the sheet shows the grounded answer from the document,
  // fetched in parallel, so the text never depends on the avatar's speech stream.
  async function askOnStep(q: string) {
    const text = q.trim();
    if (!text || !guide) return;
    setQuestion(text);
    setAnswer(null);
    if (liveRef.current && anam.send(text)) {
      try {
        setAnswer(await runTool("answer_from_document", { question: text }));
      } catch {
        setAnswer(anam.liveCaption || null);
      }
      return;
    }
    await onAsk(text);
  }

  function hideGuide() {
    void anam.stop();
    setGuideOn(false);
  }

  // `?fakelive` (dev builds, demo mode only) shows the live layout without a real Anam session, for screenshots.
  const fakeLive = fakeLiveEarly;
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
    dock: dockOn(),
    caption: anam.liveCaption || lastSay,
    status: anam.soundOff
      ? "stSoundOff"
      : owner === "clip"
      ? "stClip"
      : owner === "tts"
      ? "stReading"
      : anam.activity === "paused"
      ? "stPaused"
      : anam.activity === "listening"
      ? "stListening"
      : anam.activity === "talking" || fakeLiveEarly
      ? "stTalking"
      : "stReady",
    onAsk: () => setAskOpen(true),
    onTalk: () => go("talk"),
    state: liveState,
    // "Talk to your guide" on a step opens the live avatar in the dock, on that step. Only ever on a tap.
    onStartHere: guide ? () => { stopSpeaking(); claimAudio("guide"); setGuideOn(true); void anam.start(guide.id, lang, index); } : undefined,
    guideOn,
    onHide: hideGuide,
    onShow: () => setGuideOn(true),
    onPause: anam.interrupt,
  };
  const debug = demo && /[?&]debug=1/.test(location.search);
  const toHome = () => {
    stoppingRef.current = true;
    go("home");
  };
  // The guide stage's "You did it" page and its steps are one mounted stage: the page is its own history entry.
  const finishSteps = () => go("done");
  // "Go through it again": back to the steps entry when it is right behind, so the stack never doubles up.
  const againSteps = () => {
    setIndex(0);
    if (previous(histRef.current) === "step") back();
    else go("step", true);
  };
  const nav = { onHome: screen === "home" ? undefined : toHome, onBack: screen !== "home" && canGoBack(hist) ? back : undefined };

  return (
    <LiveContext.Provider value={liveInfo}>
      <NavContext.Provider value={nav}>
      <div className="phone">
        <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { checkSource.current = "camera"; onCamera(e.target.files); e.target.value = ""; }} />
        <input ref={uploadRef} hidden multiple type="file" accept="application/pdf,image/*" onChange={(e) => { if (!retakingRef.current) checkSource.current = "upload"; onUpload(e.target.files); e.target.value = ""; }} />

        {screen === "home" && (
          <Home
            lang={lang}
            onLanguage={changeLanguage}
            onSettings={openSettings}
            onCamera={() => { freshPaper(); openCamera(); }}
            onUpload={() => { freshPaper(); setSheetOpen(true); }}
            onSample={demo ? (n) => openSample(n) : undefined}
            onPapers={openPapers}
            hasPapers={mine.length > 0}
            recent={papers}
            onOpenPaper={(id) => void openPaper(id)}
          />
        )}
        {screen === "check" && checking && (
          <CropScreen
            key={checking.url ?? checking.file.name}
            lang={lang}
            file={checking.file}
            url={checking.url ?? ""}
            guess={checking.guess}
            pages={items.map((i) => ({ url: i.url }))}
            onBack={dropChecking}
            onRetake={retake}
            onUse={onCropped}
          />
        )}
        {screen === "camera" && (
          <CameraScreen
            lang={lang}
            pages={items.length + checkQueue.length}
            thumb={checkQueue[checkQueue.length - 1]?.url ?? items[items.length - 1]?.url ?? null}
            onShot={onShot}
            onClose={closeCamera}
            onPages={checkQueue.length ? () => go("check", true) : items.length ? () => go("tray", true) : undefined}
            onPhotos={() => { checkSource.current = "upload"; uploadRef.current?.click(); }}
            onSystemCamera={() => { checkSource.current = "camera"; cameraRef.current?.click(); }}
          />
        )}
        {screen === "quality" && pendingQuality?.quality && (
          <QualityScreen
            lang={lang}
            url={pendingQuality.url}
            quad={pendingQuality.quad}
            quality={pendingQuality.quality}
            onRetake={retake}
            onUseAnyway={() => acceptCropped(pendingQuality)}
            onHome={() => { setPendingQuality(null); dropChecking(); }}
          />
        )}
        {sheetOpen && (
          <AddPaperSheet
            lang={lang}
            onCamera={openCamera}
            onPhotos={pickFiles}
            onFile={pickFiles}
            onClose={() => setSheetOpen(false)}
          />
        )}
        {screen === "tray" && (
          <Tray
            lang={lang}
            items={items}
            busy={busy}
            tooMany={tooMany}
            onLanguage={changeLanguage}
            onSettings={openSettings}
            onAdd={() => setSheetOpen(true)}
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
        {screen === "reading" && (
          <Reading
            lang={lang}
            status={status}
            onCancel={() => {
              // "Stop making this guide?" yes: the photo is not used, and the guide leaves My guides.
              const id = guide?.id;
              if (id && !isSample(guide)) {
                forgetGuide(id);
                setMine(myGuideIds());
                void api.deleteGuide(id).catch(() => undefined);
              }
              setGuide(null);
              go("home");
            }}
            onRetry={items.length ? () => void makeGuide() : undefined}
            onHome={() => { setGuide(null); go("home"); }}
          />
        )}
        {(screen === "step" || screen === "done") && guide && (
          <GuideStage
            key={guideSeq}
            guide={guide}
            index={index}
            finished={screen === "done"}
            onFinish={finishSteps}
            onAgain={againSteps}
            onBack={nav.onBack}
            lang={lang}
            anam={anam}
            live={isLive}
            readMode={readMode}
            cantConnect={cantConnect}
            voice={voice}
            askInfo={askInfo}
            moveSeq={moveSeq}
            onIndex={(i) => { goto(i); setMoved(null); }}
            onReadMode={(on) => { if (!on) { setCantConnect(false); anam.resetError(); } setReadMode(on); }}
            onTryAgain={() => { anam.resetError(); setCantConnect(false); setReadMode(false); }}
            onHome={() => { stoppingRef.current = true; go("home"); }}
            onPapers={() => { stoppingRef.current = true; openPapers(); }}
            onCheck={() => go("tellback")}
            scale={scale}
            onScale={setScale}
          />
        )}
        {screen === "clip" && guide && <ClipScreen guide={guide} index={index} lang={lang} clips={clips} onBack={back} />}
        {screen === "ask" && guide && (
          <AskScreen
            key={guideSeq}
            guide={guide}
            lang={lang}
            question={question}
            answer={answer}
            busy={busy}
            onQuestion={setQuestion}
            onAsk={(q) => void onAsk(q)}
            onTalk={() => go("talk")}
            onTellBack={() => { go("tellback"); }}
            onPrint={print}
            onBack={back}
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
            onBack={back}
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
          <TellBack
            key={guideSeq}
            guide={guide}
            lang={lang}
            onCheck={(a, correct) => void runTool("check_understanding", { answer: a, correct })}
            onClose={() => go("done")}
            onBack={back}
            backLabel={tf(lang, "stepN", { n: index + 1 })}
            onPapers={openPapers}
          />
        )}
        {screen === "error" && (
          <ErrorScreen
            lang={lang}
            title={error?.title ?? t(lang, "couldNotRead")}
            detail={error?.detail ?? null}
            canRetry={items.length > 0}
            onRetry={() => void makeGuide()}
            onNewPhoto={openCamera}
            onUpload={() => setSheetOpen(true)}
            onBack={() => go("home")}
            onSample={error?.code === "demo_mode_no_key" ? () => openSample("inhaler") : undefined}
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
            onBack={back}
            demo={demo}
            onDemo={changeDemo}
          />
        )}
        {screen === "papers" && (
          <MyPapers
            lang={lang}
            rows={papers}
            failed={papersFailed}
            onBack={() => go("home")}
            onOpen={(id, at) => void openPaper(id, at)}
            onDelete={(id) => void deletePaper(id)}
            onRename={(id, title) => setPapers((rows) => renameRow(rows, id, title))}
            onRetry={loadPapers}
            onNew={() => { freshPaper(); setSheetOpen(true); }}
          />
        )}

        <ExtrasHost
          screen={screen}
          lang={lang}
          guide={guide}
          go={(s, r) => go(s as Screen, r)}
          back={back}
          onLanguage={changeLanguage}
          onShareGuide={(g) => { if (g.id !== guideRef.current?.id) { resetGuideState(); setGuide(g); } }}
          myCount={mine.length}
          onDeleteThis={guide && !isSample(guide) ? async () => { await deletePaper(guide.id); } : undefined}
          onDeleteAll={async () => { for (const id of myGuideIds()) await deletePaper(id); }}
        />
        {langBusy && (
          <p className="banner lang-busy" role="status">
            {t(lang, "changingLanguage")}
          </p>
        )}
        {debug && <DevPanel log={log} lang={lang} />}
      </div>
      </NavContext.Provider>
      {paperOpen && guide && <PaperViewer lang={lang} urls={paperImages(guide)} onClose={() => setPaperOpen(false)} />}
      {guide && <PrintSheet guide={guide} lang={lang} />}
      <AvatarHost live={liveInfo.live} screen={screen} />
    </LiveContext.Provider>
  );
}
