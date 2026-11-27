import type { ConversationState } from "@/types";
export const emptyState: ConversationState = {
  topic: null,
  intent: null,
  subject: null,
  dataDomain: null,
  lastAction: null,
};
export function isState(value: unknown): value is ConversationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    Object.keys(s).length === 5 &&
    Object.keys(emptyState).every((k) =>
      k === "dataDomain"
        ? s[k] === null ||
          ["HR", "PRODUCT_DOCS", "CRM"].includes(s[k] as string)
        : s[k] === null ||
          (typeof s[k] === "string" && (s[k] as string).length <= 160),
    )
  );
}
