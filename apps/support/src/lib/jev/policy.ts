import type { Analysis, Decision, Settings, Reason } from "../domain";
import { analysisSchema } from "../validation";
import { questionVersion } from "../catalog";
export function margin(a: Analysis) {
  const p = Object.values(a.probabilities).sort((a, b) => b - a);
  return p[0] - p[1];
}
export function decideRouting(input: Analysis, settings: Settings): Decision {
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success || parsed.data.questionVersion !== questionVersion)
    return { action: "review", reason: "invalid_result" };
  const a = parsed.data;
  if (
    a.choice !== "technical" &&
    a.choice !== "complaint" &&
    a.choice !== "offer" &&
    a.choice !== "spam"
  )
    return { action: "review", reason: "special_label" };
  if (
    a.confidence <
    (settings.categoryOverrides[a.choice] ?? settings.minConfidence)
  )
    return { action: "review", reason: "low_confidence" };
  if (margin(a) + Number.EPSILON < settings.minMargin)
    return { action: "review", reason: "small_margin" };
  if (a.choice === "spam") return { action: "spam", reason: "auto_spam" };
  return { action: "route", category: a.choice, reason: "auto_routed" };
}
export const reasonNames: Record<Reason, string> = {
  manual_mode: "Manual review",
  special_label: "This category requires consultant review",
  low_confidence: "Confidence below the threshold",
  small_margin: "Probability margin is too small",
  api_error: "Analysis unavailable. Consultant review required",
  invalid_result: "Invalid analysis result",
  auto_routed: "Both thresholds met",
  auto_spam: "Spam detected; both thresholds met",
  stale_result:
    "The consultant decision takes priority. This result was not applied",
};
