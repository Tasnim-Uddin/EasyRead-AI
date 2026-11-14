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
  const [micMuted, setMicMuted] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const sessionRef = useRef(0); // bumped by every stop(), so a start() still connecting knows it was cancelled
  const startingRef = useRef(false);
  const logRef = useRef(onLog);
  logRef.current = onLog;

  const stop = useCallback(async () => {
    sessionRef.current += 1;
    startingRef.current = false;
    const c = clientRef.current;
    clientRef.current = null;
    try {
      await c?.stopStreaming();
    } catch {
      /* already stopped */
    }
    const v = document.getElementById(videoId) as HTMLVideoElement | null;
    if (v) v.muted = false;
    setMicMuted(false);
    setSoundOff(false);
    setState((s) => (s === "standin" || s === "error" ? s : "idle"));
  }, [videoId]);

  const start = useCallback(
    async (guideId: string, language: string, stepIndex = 0) => {
      if (clientRef.current || startingRef.current) return;
      const session = ++sessionRef.current;
      startingRef.current = true;
      setState("connecting");
      setError(null);
      try {
        const { token, mock } = await getAnamToken(guideId, language, stepIndex);
        if (session !== sessionRef.current) return; // End was pressed while connecting
        if (mock) {
          startingRef.current = false;
          setState("standin");
          return;
        }
        const client = createClient(token);
        for (const name of Object.keys(handlersRef.current)) {
          client.registerToolCallHandler(name, {
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
        }
        client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
          if (clientRef.current === client) {
            clientRef.current = null;
            setState("idle");
          }
        });
        clientRef.current = client;
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
        clientRef.current = null;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    },
    [videoId],
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

  useEffect(() => () => void stop(), [stop]);

  return { state, error, micMuted, soundOff, start, stop, toggleMic, toggleSound, setLanguage };
}
