// Mirrors CONTRACTS.md §1–§5. Do not invent fields here; change the contract first.
export type GuideStatus = "extracting" | "writing" | "illustrating" | "ready" | "failed";
export type StepKind = "what" | "when" | "how" | "warning" | "get_help";
export type StepStatus = "pending" | "generating" | "ready" | "failed";

export interface Step {
  index: number;
  text: string;
  text_en: string;
  kind: StepKind;
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
}

export interface Guide {
  id: string;
  status: GuideStatus;
  language: string;
  source: { kind: string; image_urls: string[]; is_sample: boolean };
  facts: Facts | null;
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
}

export type Escalate = "none" | "pharmacist" | "111" | "999";
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
}
