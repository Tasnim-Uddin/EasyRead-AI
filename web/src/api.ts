import fixture from "../../demo/fixtures/guide_inhaler.json";
import council from "../../demo/fixtures/guide_council_letter.json";
import flatpack from "../../demo/fixtures/guide_flatpack.json";
import cachedInhaler from "../../demo/fixtures/cached/guide_cached_inhaler.json";
import { isFallback, t } from "./i18n";
import type { AskResult, Clip, Guide, ServerEvent } from "./types";

export const sampleGuide = fixture as unknown as Guide;
export const SAMPLES: Record<string, Guide> = {
  inhaler: sampleGuide,
  council: council as unknown as Guide,
  flatpack: flatpack as unknown as Guide,
  "cached-inhaler": cachedInhaler as unknown as Guide, // saved real run (demo/cache_run.py)
};

/** An error from the server: `code` is its `error` field (or "server" / "client"), `message` the English detail. */
export class ApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

const ERROR_KEYS: Record<string, string> = {
  unsupported_file_type: "errUnsupported",
  too_many_files: "errTooMany",
  file_too_large: "errTooBig",
  too_many_pages: "errTooPages",
  document_required: "errNoDoc",
  server: "errServer",
  client: "errGeneric",
};

/** The error text in the user's language when we have it; otherwise the server's English detail. */
export function errorText(lang: string, e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : String(e);
  const key = ERROR_KEYS[e.code];
  if (!key || isFallback(lang, key)) return e.message;
  return t(lang, key).replace("{max}", e.message.match(/\d+/)?.[0] ?? "");
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // The server sends { error, detail } for upload problems (too many pages, bad file type, ...).
    // FastAPI's own validation errors have a list as detail, so only a string is shown.
    const body = await res.json().catch(() => null);
    if (typeof body?.detail === "string") throw new ApiError(body.detail, typeof body.error === "string" ? body.error : "other");
    if (res.status >= 500) throw new ApiError("The server is not answering. Wait a moment and try again.", "server");
    throw new ApiError("We could not use these files. Check them and try again.", "client");
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

/** `mock` is true when the server has no Anam key: the app then keeps the illustrated stand-in. */
export async function getAnamToken(guideId: string, language: string, stepIndex = 0): Promise<{ token: string; mock: boolean; stt: boolean }> {
  const r = await json<{ sessionToken: string; mock?: boolean; stt_supported?: boolean }>(
    await fetch("/api/anam/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guide_id: guideId, language, step_index: stepIndex }),
    }),
  );
  return { token: r.sessionToken, mock: !!r.mock || r.sessionToken === "dev-mock-token", stt: r.stt_supported !== false };
}

/** Only clips a human has checked may reach a user (CONTRACTS.md §5). */
export async function getLibrary(): Promise<Clip[]> {
  try {
    const r = await json<{ clips: Clip[] }>(await fetch("/api/library"));
    return r.clips.filter((c) => !!c.checked_by || c.unchecked === true); // unchecked only arrives in server demo mode
  } catch {
    return [];
  }
}
