import fixture from "../../demo/fixtures/guide_inhaler.json";
import type { AskResult, Clip, Guide, ServerEvent } from "./types";

export const sampleGuide = fixture as unknown as Guide;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // The server sends { error, detail } for upload problems (too many pages, bad file type, ...)
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? body?.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function createGuide(form: FormData): Promise<{ guide_id: string }> {
  return json(await fetch("/api/guides", { method: "POST", body: form }));
}

export async function getGuide(id: string): Promise<Guide> {
  return json(await fetch(`/api/guides/${id}`));
}

export function subscribe(id: string, onEvent: (e: ServerEvent) => void): () => void {
  const es = new EventSource(`/api/guides/${id}/events`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as ServerEvent);
    } catch {
      /* ignore malformed event */
    }
  };
  return () => es.close();
}

export async function setLanguage(id: string, language: string): Promise<Guide> {
  return json(
    await fetch(`/api/guides/${id}/language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    }),
  );
}

export async function ask(id: string, question: string, language: string): Promise<AskResult> {
  return json(
    await fetch(`/api/guides/${id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, language }),
    }),
  );
}

export async function postTool(
  name: string,
  guideId: string,
  args: Record<string, unknown>,
): Promise<{ say: string }> {
  return json(
    await fetch(`/api/tools/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guide_id: guideId, ...args }),
    }),
  );
}

export async function getAnamToken(guideId: string, language: string): Promise<string> {
  const r = await json<{ sessionToken: string }>(
    await fetch("/api/anam/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guide_id: guideId, language }),
    }),
  );
  return r.sessionToken;
}

/** Only clips a human has checked may reach a user (CONTRACTS.md §5). */
export async function getLibrary(): Promise<Clip[]> {
  try {
    const r = await json<{ clips: Clip[] }>(await fetch("/api/library"));
    return r.clips.filter((c) => !!c.checked_by);
  } catch {
    return [];
  }
}
