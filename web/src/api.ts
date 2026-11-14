import fixture from "../../demo/fixtures/guide_inhaler.json";
import council from "../../demo/fixtures/guide_council_letter.json";
import flatpack from "../../demo/fixtures/guide_flatpack.json";
import type { AskResult, Clip, Guide, ServerEvent } from "./types";

export const sampleGuide = fixture as unknown as Guide;
export const SAMPLES: Record<string, Guide> = {
  inhaler: sampleGuide,
  council: council as unknown as Guide,
  flatpack: flatpack as unknown as Guide,
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // The server sends { error, detail } for upload problems (too many pages, bad file type, ...).
    // FastAPI's own validation errors have a list as detail, so only a string is shown.
    const body = await res.json().catch(() => null);
    if (typeof body?.detail === "string") throw new Error(body.detail);
    throw new Error(
      res.status >= 500
        ? "The server is not answering. Wait a moment and try again."
        : "We could not use these files. Check them and try again.",
    );
  }
  return res.json() as Promise<T>;
}

interface UploadItem {
  file: File;
  role: string;
}

/**
 * Builds the POST /api/guides body (CONTRACTS.md section 2): each paper is a repeated `document` field,
 * `roles` is aligned with them ("" = detect it), and the device photo keeps its own field.
 */
export function buildGuideForm(items: UploadItem[], language: string): FormData {
  const device = items.find((i) => i.role === "device_photo");
  const docs = items.filter((i) => i !== device);
  const f = new FormData();
  // A device photo on its own is the one document.
  const main = docs.length ? docs : device ? [device] : [];
  main.forEach((d) => f.append("document", d.file));
  // Extra device photos have no field of their own, so they go as ordinary papers.
  const roles = main.map((d) => (d.role === "auto" || d === device ? "" : d.role === "device_photo" ? "other" : d.role));
  if (roles.some(Boolean)) f.append("roles", JSON.stringify(roles));
  if (device && docs.length) f.append("device_photo", device.file);
  f.append("language", language);
  return f;
}

export async function createGuide(form: FormData): Promise<{ guide_id: string }> {
  let res: Response;
  try {
    res = await fetch("/api/guides", { method: "POST", body: form });
  } catch {
    throw new Error("We could not reach the server. Check your connection and try again.");
  }
  return json(res);
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
