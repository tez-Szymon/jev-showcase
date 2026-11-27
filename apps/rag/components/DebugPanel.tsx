import type { Turn } from "@/types";
import FlowStep from "./FlowStep";
import LlmLog from "./LlmLog";
const ms = (value: number) => `${value < 1 ? "<1" : Math.round(value)} ms`;
export default function DebugPanel({
  turn,
  count,
  selected,
  onSelect,
}: {
  turn?: Turn;
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="inspector" tabIndex={0} aria-label="Turn inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">UNDER THE HOOD</span>
          <h2>
            Turn inspector <span className="live-dot" />
          </h2>
        </div>
        {count > 0 && (
          <select
            aria-label="Inspect turn"
            value={selected}
            onChange={(e) => onSelect(Number(e.target.value))}
          >
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={i}>
                Turn {String(i + 1).padStart(2, "0")}
              </option>
            ))}
          </select>
        )}
      </div>
      {!turn ? (
        <div className="inspector-empty">
          <div className="empty-flow">
            <FlowStep label="JEV" kind="jev" detail="Decide" />
            <b>↓</b>
            <FlowStep label="RAG" detail="Retrieve if needed" />
            <b>↓</b>
            <FlowStep label="LLM" detail="Answer + state" />
          </div>
          <h3>Every decision, in view.</h3>
          <p>
            Send a message to inspect the route, retrieved context, and state
            carried into the next turn.
          </p>
          <div className="inspector-note">
            The LLM is called once, after routing.
          </div>
        </div>
      ) : (
        <div className="trace">
          <div className="trace-input">
            <span className="eyebrow">INPUT</span>
            <p>“{turn.currentMessage}”</p>
            <details>
              <summary>Previous conversation state</summary>
              <pre>{JSON.stringify(turn.previousState, null, 2)}</pre>
            </details>
          </div>
          <section className="trace-section">
            <div className="step-title">
              <span className="step-number">01</span>
              <span className="badge jev">JEV</span>
              <h3>Routing decision</h3>
              <small>{ms(turn.timing.jev)}</small>
            </div>
            <div className="decision-card">
              <span className="route-label">{turn.decision.route}</span>
              <strong>
                {Math.round(turn.decision.confidence * 100)}
                <small>%</small>
              </strong>
              <div className="confidence-track">
                <i style={{ width: `${turn.decision.confidence * 100}%` }} />
              </div>
              <div className="decision-caption">
                <span>Choice confidence</span>
                <span>LIVE</span>
              </div>
            </div>
            <p className="micro">
              Needs company data{" "}
              <b>{Math.round(turn.decision.needsContext * 100)}%</b>
            </p>
          </section>
          <section className="trace-section">
            <div className="step-title">
              <span className="step-number">02</span>
              <span className="badge rag">RAG</span>
              <h3>
                {turn.retrieval.used
                  ? "Context retrieved"
                  : "Retrieval skipped"}
              </h3>
              <small>{turn.retrieval.used ? ms(turn.timing.rag) : "—"}</small>
            </div>
            {turn.retrieval.used ? (
              <>
                <p className="micro">
                  Source <b>{turn.retrieval.source}</b> · Mock dataset
                </p>
                {turn.retrieval.documents.map((d) => (
                  <div className="document" key={d.id}>
                    <span>▤ &nbsp; {d.title}</span>
                    <p>{d.text}</p>
                  </div>
                ))}
                {!turn.retrieval.documents.length && (
                  <p className="micro">
                    No matching records. The answer will ask for clarification.
                  </p>
                )}
              </>
            ) : (
              <div className="skip-note">
                No external context needed. Sent directly to generation.
              </div>
            )}
          </section>
          <section className="trace-section">
            <div className="step-title">
              <span className="step-number">03</span>
              <span className="badge llm">LLM</span>
              <h3>Answer + compact state</h3>
              <small>{ms(turn.timing.llm)}</small>
            </div>
            <p className="micro">One model call · {turn.generation.model}</p>
            {turn.generation.log?.length > 0 && (
              <details className="raw llm-log-box" open>
                <summary>LLM log · raw HTTP exchange</summary>
                <LlmLog log={turn.generation.log} />
              </details>
            )}
          </section>
          <section className="trace-section">
            <div className="step-title">
              <span className="step-number">04</span>
              <span className="badge state">STATE</span>
              <h3>Ready for the next turn</h3>
            </div>
            <pre className="state-code">
              {JSON.stringify(turn.generation.conversationState, null, 2)}
            </pre>
            <p className="state-caption">
              ↳ Passed to Jev with your next message
            </p>
          </section>
          <details className="raw">
            <summary>Raw model responses</summary>
            <pre>
              {JSON.stringify(
                { jev: turn.decision.raw, llm: turn.generation.raw },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="trace-footer">
            <span>TURN COMPLETED</span>
            <span>{ms(turn.timing.total)} total</span>
          </div>
        </div>
      )}
    </aside>
  );
}
