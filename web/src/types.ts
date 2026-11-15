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
  conflicts?: { field: string; label: string; leaflet: string }[];
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
