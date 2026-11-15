import { useCallback, useEffect, useRef, useState } from "react";
import { AnamEvent, createClient } from "@anam-ai/js-sdk";
import { getAnamToken } from "./api";

/** "standin" = no Anam key on the server: the illustrated stand-in stays and the steps still work. */
export type AnamState = "idle" | "connecting" | "live" | "standin" | "error";
export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

/**
 * Owns the Anam client. `handlers` are the client tools from CONTRACTS.md §3;
 * each returns the short `say` string the avatar talks about.
 */
export function useAnam(
  videoId: string,
  handlers: Record<string, ToolHandler>,
  onLog: (tool: string, args: Record<string, unknown>, ms: number, say: string) => void,
) {
  const [state, setState] = useState<AnamState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sttMissing, setSttMissing] = useState(false); // the avatar cannot hear this language: the user types instead
  const [micMuted, setMicMuted] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  /** What the guide is doing, for the dock's status chip. */
  const [activity, setActivity] = useState<"idle" | "talking" | "listening" | "paused">("idle");
  const [liveCaption, setLiveCaption] = useState("");
  /** What the user is saying, live (Anam's own transcript of the user's speech). */
  const [userCaption, setUserCaption] = useState("");
  const [userSeq, setUserSeq] = useState(0); // +1 each time the user finishes saying something
  const userDone = useRef(true);
  /** The whole of the guide's last finished message (for "Say that again"). */
  const lastReplyRef = useRef("");
  const captionRef = useRef("");
  const msgDone = useRef(true); // the last persona message ended: the next chunk starts a new caption
  const [replySeq, setReplySeq] = useState(0); // +1 for each new persona message
  const [replyDone, setReplyDone] = useState(0); // +1 each time a persona message ends
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const sessionRef = useRef(0); // bumped by every stop(), so a start() still connecting knows it was cancelled
  const startingRef = useRef(false);
  const logRef = useRef(onLog);
  logRef.current = onLog;

  const cleanupRef = useRef<(() => void)[]>([]); // listener + tool-handler removers of the current client
  const stop = useCallback(async () => {
    sessionRef.current += 1;
    startingRef.current = false;
    const c = clientRef.current;
    clientRef.current = null;
    for (const off of cleanupRef.current.splice(0)) {
      try {
        off();
      } catch {
        /* already removed */
      }
    }
    // The UI goes back to the not-live dock straight away, even if the SDK is slow to close.
    setMicMuted(false);
    setSoundOff(false);
    setActivity("idle");
    setLiveCaption("");
    setUserCaption("");
    captionRef.current = "";
    msgDone.current = true;
    userDone.current = true;
    setState((s) => (s === "standin" || s === "error" ? s : "idle"));
    try {
      await c?.stopStreaming(); // closes the connection and stops the mic track
    } catch {
      /* already stopped */
    }
    const v = document.getElementById(videoId) as HTMLVideoElement | null;
    if (v) {
      // Release anything still attached to the video element (remote audio/video), so nothing keeps playing.
      const src = v.srcObject as MediaStream | null;
      src?.getTracks().forEach((tr) => tr.stop());
      v.srcObject = null;
      v.muted = false;
    }
  }, [videoId]);

  const start = useCallback(
    async (guideId: string, language: string, stepIndex = 0) => {
      if (clientRef.current || startingRef.current) return;
      const session = ++sessionRef.current;
      startingRef.current = true;
      setState("connecting");
      setError(null);
      try {
        const { token, mock, stt } = await getAnamToken(guideId, language, stepIndex);
        if (session !== sessionRef.current) return; // End was pressed while connecting
        setSttMissing(!stt);
        if (mock) {
          startingRef.current = false;
          setState("standin");
          return;
        }
        const client = createClient(token);
        const offs: (() => void)[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const on = (ev: AnamEvent, cb: (...a: any[]) => void) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client.addListener(ev, cb as any);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          offs.push(() => client.removeListener(ev, cb as any));
        };
        for (const name of Object.keys(handlersRef.current)) {
          const off = client.registerToolCallHandler(name, {
            onStart: async (payload: { arguments?: Record<string, unknown> }) => {
              const args = payload.arguments ?? {};
              const t0 = performance.now();
              let say: string;
              try {
                say = await handlersRef.current[name](args);
              } catch (e) {
                say = "Sorry, that did not work. Please try again.";
                console.error(`tool ${name} failed`, e);
              }
              logRef.current(name, args, Math.round(performance.now() - t0), say);
              return say;
            },
          });
          if (typeof off === "function") offs.push(off);
        }
        on(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (e: { id: string; content: string; role: string; endOfSpeech: boolean; interrupted: boolean }) => {
          if (e.role === "user") {
            if (userDone.current) {
              userDone.current = false;
              setUserCaption(e.content ?? "");
            } else setUserCaption((c) => c + (e.content ?? ""));
            if (e.endOfSpeech || e.interrupted) {
              userDone.current = true;
              setUserSeq((n) => n + 1);
            }
            return;
          }
          if (e.role !== "persona") return;
          // Chunks of one message share nothing reliable, so a message runs until endOfSpeech/interrupted.
          if (msgDone.current) {
            msgDone.current = false;
            setReplySeq((n) => n + 1);
            captionRef.current = e.content ?? "";
          } else captionRef.current += e.content ?? "";
          setLiveCaption(captionRef.current);
          if (e.endOfSpeech || e.interrupted) {
            msgDone.current = true;
            if (e.endOfSpeech && captionRef.current.trim()) lastReplyRef.current = captionRef.current;
            setReplyDone((n) => n + 1);
          }
          setActivity(e.endOfSpeech || e.interrupted ? "idle" : "talking");
        });
        on(AnamEvent.USER_SPEECH_STARTED, () => {
          setActivity("listening");
          if (userDone.current) setUserCaption("");
        });
        on(AnamEvent.USER_SPEECH_ENDED, () => setActivity("idle"));
        on(AnamEvent.TALK_STREAM_INTERRUPTED, () => setActivity((a) => (a === "paused" ? a : "idle")));
        on(AnamEvent.CONNECTION_CLOSED, () => {
          if (clientRef.current === client) {
            // Closed from the other side (timeout, network): same clean-up as End.
            void stop();
          }
        });
        clientRef.current = client;
        cleanupRef.current = offs;
        await client.streamToVideoElement(videoId);
        startingRef.current = false;
        if (session !== sessionRef.current) {
          // End was pressed while the stream was connecting: shut it down, stay idle.
          if (clientRef.current === client) clientRef.current = null;
          try {
            await client.stopStreaming();
          } catch {
            /* already stopped */
          }
          return;
        }
        setState("live");
      } catch (e) {
        startingRef.current = false;
        if (session !== sessionRef.current) return;
        const c = clientRef.current;
        clientRef.current = null;
        void c?.stopStreaming().catch(() => undefined); // never leave a half-open session holding the mic
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    },
    [videoId, stop],
  );

  /** The listener mic: the avatar keeps talking, but does not hear you. */
  const toggleMic = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    try {
      const s = micMuted ? c.unmuteInputAudio() : c.muteInputAudio();
      setMicMuted(s.isMuted);
    } catch {
      /* no mic permission */
    }
  }, [micMuted]);

  /** Mic on or off on purpose (Pause / Carry on). */
  const setMic = useCallback((muted: boolean) => {
    const c = clientRef.current;
    if (!c) return;
    try {
      const s = muted ? c.muteInputAudio() : c.unmuteInputAudio();
      setMicMuted(s.isMuted);
    } catch {
      /* no mic permission */
    }
  }, []);

  /** Avatar sound off or on (the video element's own audio). */
  const toggleSound = useCallback(() => {
    const v = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!v) return;
    v.muted = !v.muted;
    setSoundOff(v.muted);
  }, [videoId]);

  /** Keeps the avatar's speech recognition in step with the app language (no new session needed). */
  const setLanguage = useCallback((code: string) => {
    try {
      clientRef.current?.sendDataMessage(JSON.stringify({ message_type: "persona_config", data: { languageCode: code } }));
    } catch {
      /* not live */
    }
  }, []);

  /** Typed message to the avatar, for people who cannot or prefer not to speak. The avatar answers and can call tools. */
  const send = useCallback((text: string) => {
    const msg = text.trim();
    if (!msg) return false;
    try {
      setActivity("idle");
      clientRef.current?.sendUserMessage(msg);
      return !!clientRef.current;
    } catch {
      return false;
    }
  }, []);

  /** The guide says exactly this text (e.g. the on-screen check verdict). */
  const talk = useCallback((text: string) => {
    try {
      void clientRef.current?.talk(text);
    } catch {
      /* not live */
    }
  }, []);

  /** Stop the guide mid-sentence. */
  const interrupt = useCallback(() => {
    try {
      clientRef.current?.interruptPersona();
      if (clientRef.current) setActivity("paused");
    } catch {
      /* not live */
    }
  }, []);

  /** Another sound took the audio (read-aloud, a clip): quiet the guide's video; restore unless the user muted it. */
  const soundOffRef = useRef(soundOff);
  soundOffRef.current = soundOff;
  const quiet = useCallback(
    (q: boolean) => {
      const v = document.getElementById(videoId) as HTMLVideoElement | null;
      if (!v || !clientRef.current) return;
      if (q) interrupt();
      v.muted = q || soundOffRef.current;
    },
    [videoId, interrupt],
  );

  useEffect(() => {
    // Closing or hiding the tab ends the session too, so the mic is never left on.
    const onHide = () => void stop();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void stop();
    };
  }, [stop]);

  /** Avatar sound on purpose (Pause / Carry on). */
  const setSound = useCallback(
    (off: boolean) => {
      const v = document.getElementById(videoId) as HTMLVideoElement | null;
      if (!v) return;
      v.muted = off;
      setSoundOff(off);
    },
    [videoId],
  );
  const lastReply = useCallback(() => lastReplyRef.current, []);
  /** "Try guide again": forget the last failure so a new session can start. */
  const resetError = useCallback(() => {
    setError(null);
    setState((s) => (s === "error" || s === "standin" ? "idle" : s));
  }, []);

  return { state, error, sttMissing, micMuted, soundOff, start, stop, toggleMic, setMic, toggleSound, setSound, setLanguage, send, talk, interrupt, quiet, activity, liveCaption, userCaption, userSeq, lastReply, resetError, replySeq, replyDone };
}
