import fixture from "../../demo/fixtures/guide_inhaler.json";
import council from "../../demo/fixtures/guide_council_letter.json";
import flatpack from "../../demo/fixtures/guide_flatpack.json";
import cachedInhaler from "../../demo/fixtures/cached/guide_cached_inhaler.json";
import inhaler_es from "../../demo/fixtures/i18n/guide_inhaler_es.json";
import inhaler_ar from "../../demo/fixtures/i18n/guide_inhaler_ar.json";
import council_es from "../../demo/fixtures/i18n/guide_council_letter_es.json";
import council_ar from "../../demo/fixtures/i18n/guide_council_letter_ar.json";
import flatpack_es from "../../demo/fixtures/i18n/guide_flatpack_es.json";
import flatpack_ar from "../../demo/fixtures/i18n/guide_flatpack_ar.json";
import { isFallback, t } from "./i18n";
import type { AskResult, Clip, Guide, ServerEvent } from "./types";

export const sampleGuide = fixture as unknown as Guide;
export const SAMPLES: Record<string, Guide> = {
  inhaler: sampleGuide,
  council: council as unknown as Guide,
  flatpack: flatpack as unknown as Guide,
  "cached-inhaler": cachedInhaler as unknown as Guide, // saved real run (demo/cache_run.py)
};

/** Translated copies of the samples (demo/fixtures/i18n), by sample name then language code. */
const TRANSLATED: Record<string, Record<string, Guide>> = {
  inhaler: { es: inhaler_es as unknown as Guide, ar: inhaler_ar as unknown as Guide },
  council: { es: council_es as unknown as Guide, ar: council_ar as unknown as Guide },
  flatpack: { es: flatpack_es as unknown as Guide, ar: flatpack_ar as unknown as Guide },
};

/** The sample `name` in `lang`: the translated one if there is one, else the English sample. */
export function sampleFor(name: string, lang: string): Guide | undefined {
  return TRANSLATED[name]?.[lang] ?? SAMPLES[name];
}

/** The same sample as `g` in `lang` (English when it has no translation), or null if `g` is not a known sample. */
export function sampleVariant(g: Guide, lang: string): Guide | null {
  const name = Object.keys(SAMPLES).find((n) => [SAMPLES[n], ...Object.values(TRANSLATED[n] ?? {})].some((x) => x.id === g.id));
  return name ? (sampleFor(name, lang) ?? null) : null;
}

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
  ai_timeout: "errTimeout",
  image_unreadable: "errImage",
  demo_mode_no_key: "errDemoKey",
  client: "errGeneric",
};

/** The error text in the user's language when we have it; otherwise the server's English detail. */
export function errorText(lang: string, e: unknown): string {
  // fetch() itself failed (offline, server down): a plain translated line, never a raw "Failed to fetch".
  if (!(e instanceof ApiError)) return t(lang, "serverDown");
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

/** One row of "My papers" (GET /api/guides?ids=..., CONTRACTS.md section 2). */
export interface GuideSummary {
  id: string;
  title: string;
  language: string;
  doc_type: string;
  created_at: string | null;
  status: Guide["status"];
  thumbnail: string | null;
}

/** Only the given ids come back (the ones this device made), newest first. */
export async function listGuides(ids: string[]): Promise<GuideSummary[]> {
  if (ids.length === 0) return [];
  const r = await json<{ guides: GuideSummary[] }>(await fetch(`/api/guides?ids=${encodeURIComponent(ids.join(","))}`));
  return r.guides;
}

export async function deleteGuide(id: string): Promise<void> {
  const res = await fetch(`/api/guides/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) await json(res);
}
