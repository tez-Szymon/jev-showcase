import type { categories, labels } from "./catalog";
export type Category = (typeof categories)[number];
export type Label = (typeof labels)[number];
export type Status = "needs_review" | "routed" | "spam";
export type Reason =
  | "manual_mode"
  | "special_label"
  | "low_confidence"
  | "small_margin"
  | "api_error"
  | "invalid_result"
  | "auto_routed"
  | "auto_spam"
  | "stale_result";
export type Settings = {
  version: number;
  minConfidence: number;
  minMargin: number;
  categoryOverrides: Partial<
    Record<Exclude<Category, "other"> | "spam", number>
  >;
};
export type Analysis = {
  choice: Label;
  confidence: number;
  probabilities: Record<Label, number>;
  model: string;
  questionVersion: string;
};
export type Decision =
  | {
      action: "route";
      category: Exclude<Category, "other">;
      reason: "auto_routed";
    }
  | { action: "spam"; reason: "auto_spam" }
  | { action: "review"; reason: Reason };
export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: "validation" | "not_found" | "conflict" | "storage";
      message: string;
    };
export type Ticket = {
  id: string;
  submission_id: string;
  subject: string;
  description: string;
  status: Status;
  category: Category | null;
  department: string | null;
  decision_by: "jev" | "consultant" | null;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Attempt = {
  interrupted: boolean;
  id: string;
  ticket_id: string;
  started_at: string;
  finished_at: string | null;
  status: "started" | "success" | "error";
  result: Analysis | null;
  settings: Settings;
  reason: Reason | null;
  applied: boolean;
  error_code: string | null;
};
export type TicketEvent = {
  id: string;
  actor: string;
  kind: string;
  before: Ticket | null;
  after: Ticket;
  created_at: string;
};
export const defaults = {
  minConfidence: 0.9,
  minMargin: 0.2,
  categoryOverrides: {},
} satisfies Omit<Settings, "version">;
