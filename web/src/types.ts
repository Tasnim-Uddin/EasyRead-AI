// Mirrors CONTRACTS.md §1–§5. Do not invent fields here; change the contract first.
export type GuideStatus = "extracting" | "writing" | "illustrating" | "ready" | "failed";
export type StepKind = "what" | "when" | "how" | "warning" | "get_help";
export type StepStatus = "pending" | "generating" | "ready" | "failed" | "skipped";

export interface Step {
  index: number;
  text: string;
  text_en: string;
  kind: StepKind;
  say?: string; // the guide's bubble line; show `text` when missing
  picture_prompt: string;
  image_url: string | null;
  technique_clip_id: string | null;
  status: StepStatus;
  /** v4: animated close-up from the built-in library (web/src/closeups). Missing = none. */
  visual?: { kind: "closeup"; id: string } | null;
  /** v4: where this step's words are on the user's own photo (OCR-located, never guessed). */
  highlights?: Highlight[];
  /** v4: the big number/date card for this step, e.g. {value:"£212.50", sub:"by 17 Nov"}. */
  callout?: { value: string; sub?: string } | null;
}

/** v4: a span of printed text located on page `page` (0-based index into source.image_urls).
 *  `quad` = 4 corner points [x,y] normalised 0-1 to the image, clockwise from top-left. */
export interface Highlight {
  page: number;
  text: string;
  quad: [number, number][];
}

/** v4: a dated action found on the paper (quote checked against the photo). */
export interface DatedAction {
  what: string;        // plain words in guide language, e.g. "Pay £212.50"
  what_en: string;
  date: string;        // YYYY-MM-DD
  time?: string | null; // HH:MM 24h, missing = all day
  quote: string;       // exact printed words
  amount?: string | null;
}

export interface Facts {
  medicine: string | null;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  device_type: string;
  device_confidence: number;
  warnings: string[];
  get_help: string[];
  unreadable: string[];
  /** label vs leaflet ({label, leaflet} plus a/b), or any two papers ({a, b, a_page, b_page}). */
  conflicts?: { field: string; label?: string; leaflet?: string; a?: string; b?: string; a_page?: number; b_page?: number }[];
  title?: string;
  source_steps?: string[];
}

export interface GuideContent {
  what_this_is?: string;
  what_to_do?: string[];
  by_when?: { date: string; what: string }[];
  amounts?: { what: string; amount: string }[];
  fields?: { label: string; what_to_write: string }[];
}

export interface Guide {
  id: string;
  status: GuideStatus;
  /** Set when status is failed because the upload is not a paper, or no words could be read. */
  error_code?: "not_a_document" | "unreadable" | "ai_timeout" | "image_unreadable" | "demo_mode_no_key";
  language: string;
  doc_type?: "how_to" | "letter" | "bill" | "form" | "other"; // missing = how_to
  domain?: string;
  source: {
    kind: string;
    image_urls: string[];
    is_sample: boolean;
    device_photo_url?: string | null;
    device_photo_labelled_url?: string;
    device_photo_labels?: string[];
    documents?: { index: number; role: string; role_source: string; image_url: string | null }[];
  };
  facts: Facts | null;
  content?: GuideContent | null;
  safety_lines?: string[];
  summary_line?: string;
  summary_line_en?: string;
  steps: Step[];
  created_at: string;
  /** v4: who sent the paper / who to ask when the answer is not on it. */
  sender?: { name: string; kind: "pharmacy" | "gp" | "hospital" | "council" | "school" | "company" | "government" | "other"; contact?: string | null } | null;
  /** v4: dated actions for Remind me / Add to calendar. */
  dates?: DatedAction[];
  /** v4: parts of a photo that could not be read. */
  unreadable_regions?: { page: number; quad: [number, number][]; note: string }[];
  /** v4: user's own name for the guide (Rename in My guides). */
  title_override?: string | null;
}

export interface Clip {
  id: string;
  device_type: string;
  order: number;
  caption_en: string;
  video_url: string;
  poster_url: string;
  checked_by?: string;
  checked_against?: string;
  checked_at?: string;
  /** Set by the server only in demo mode (SHOW_UNCHECKED_CLIPS=1): the clip has no human sign-off. */
  unchecked?: boolean;
}

export type Escalate = "none" | "pharmacist" | "111";
export interface AskResult {
  answer: string;
  grounded: boolean;
  escalate: Escalate;
  /** v4: when not grounded, who to ask instead (from guide.sender), e.g. "the council". */
  ask_who?: string | null;
}

/** v4: result of POST /api/scan (edge detect + quality, no AI). */
export interface ScanResult {
  quad: [number, number][];      // normalised corners; full photo when found=false
  found: boolean;
  quality: {
    ok: boolean;
    issues: ("small" | "blurry" | "dark" | "low_contrast" | "glare" | "cut_off")[];
    block: boolean;
    /** Where the problem is, [x, y, w, h] normalised (glare), when known. */
    region?: [number, number, number, number];
    metrics?: { sharpness: number; brightness: number; contrast: number };
  };
  /** Photo size in px after EXIF rotation. */
  size?: [number, number];
}

export type ServerEvent =
  | { type: "guide_status"; guide_id: string; status: GuideStatus }
  | { type: "step_updated"; guide_id: string; step: Step }
  | { type: "tool_log"; tool: string; args: Record<string, unknown>; ms: number };

export interface ToolLogEntry {
  at: number;
  tool: string;
  args: Record<string, unknown>;
  ms: number;
  say: string;
  source: "browser" | "server";
}
