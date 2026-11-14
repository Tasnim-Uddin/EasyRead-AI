import { useCallback, useEffect, useRef, useState } from "react";
import { AnamEvent, createClient } from "@anam-ai/js-sdk";
import { getAnamToken } from "./api";

export type AnamState = "idle" | "connecting" | "live" | "error";
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
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const logRef = useRef(onLog);
  logRef.current = onLog;

  const stop = useCallback(async () => {
    try {
      await clientRef.current?.stopStreaming();
    } catch {
      /* already stopped */
    }
    clientRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(
    async (guideId: string, language: string) => {
      setState("connecting");
      setError(null);
      try {
        const token = await getAnamToken(guideId, language);
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
        client.addListener(AnamEvent.CONNECTION_CLOSED, () => setState("idle"));
        await client.streamToVideoElement(videoId);
        clientRef.current = client;
        setState("live");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    },
    [videoId],
  );

  useEffect(() => () => void stop(), [stop]);

  return { state, error, start, stop };
}
