import type { Attempt, Settings } from "@/lib/domain";
import { labelNames, questionVersion } from "@/lib/catalog";
import { decideRouting, margin, reasonNames } from "@/lib/jev/policy";
const number = (n: number) => n.toFixed(2);
export function AnalysisPanel({
  attempt,
  settings,
}: {
  attempt: Attempt | undefined;
  settings: Settings;
}) {
  if (!attempt)
    return (
      <div className="panel">
        <h2>Jev analysis</h2>
        <p className="muted">
          No analysis available. This request needs manual review.
        </p>
      </div>
    );
  const a = attempt.result;
  if (!a)
    return (
      <div className="panel">
        <h2>Jev analysis</h2>
        <p className="notice">
          {attempt.status === "started"
            ? attempt.interrupted
              ? "Analysis interrupted. You can make a manual decision."
              : "Analysis in progress. You can make a manual decision."
            : reasonNames[attempt.reason ?? "api_error"]}
        </p>
      </div>
    );
  const compatible = a.questionVersion === questionVersion;
  const preview = compatible ? decideRouting(a, settings) : null;
  const threshold =
    (a.choice === "technical" ||
    a.choice === "complaint" ||
    a.choice === "offer" ||
    a.choice === "spam"
      ? attempt.settings.categoryOverrides[a.choice]
      : undefined) ?? attempt.settings.minConfidence;
  return (
    <section className="panel stack">
      <div className="section-heading">
        <h2>Jev analysis</h2>
        <span className="badge ai">
          {attempt.applied ? "Applied" : "For reference"}
        </span>
      </div>
      <h3>{labelNames[a.choice]}</h3>
      <div className="metrics">
        <div>
          <span>Jev confidence</span>
          <strong>{number(a.confidence)}</strong>
          <small>threshold {number(threshold)}</small>
        </div>
        <div>
          <span>Margin p₁ − p₂</span>
          <strong>{number(margin(a))}</strong>
          <small>threshold {number(attempt.settings.minMargin)}</small>
        </div>
      </div>
      <p className="notice">
        {reasonNames[attempt.reason ?? "invalid_result"]}
        {attempt.reason === "low_confidence"
          ? `: ${number(a.confidence)} < ${number(threshold)}`
          : ""}
      </p>
      <div className="probabilities">
        {Object.entries(a.probabilities)
          .sort(([, a], [, b]) => b - a)
          .map(([key, value]) => (
            <div key={key}>
              <div className="bar-label">
                <span>{labelNames[key as keyof typeof labelNames]}</span>
                <b>{number(value)}</b>
              </div>
              <div className="bar">
                <span style={{ width: `${value * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
      <p className="hint">
        Confidence describes distribution concentration, not the percentage of
        correct decisions.
      </p>
      <details>
        <summary>What would happen with current thresholds?</summary>
        <p className="notice">
          {preview
            ? `${preview.action === "route" ? "Automatic assignment" : preview.action === "spam" ? "Automatic spam" : "Consultant review"}: ${reasonNames[preview.reason]}`
            : "Cannot compare results from a different question or category version."}
        </p>
        <p className="hint">
          Preview with settings v{settings.version}. No changes are saved and no
          API call is made.
        </p>
      </details>
      <p className="hint">
        Model: {a.model} · Questions: {a.questionVersion} · Analysis settings: v
        {attempt.settings.version}
      </p>
    </section>
  );
}
