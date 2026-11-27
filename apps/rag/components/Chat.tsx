"use client";
import { useEffect, useRef, useState } from "react";
import type { Turn } from "@/types";
import { emptyState } from "@/lib/conversationState";
import DebugPanel from "./DebugPanel";
import FlowStep from "./FlowStep";
import LlmLog from "./LlmLog";
import type { LlmExchange } from "@/lib/llmLog";
const scenarios = [
  {
    tag: "HR",
    title: "Check a vacation balance",
    prompt: "How many vacation days do I have left?",
    icon: "☀",
  },
  {
    tag: "FOLLOW-UP",
    title: "Switch the person",
    prompt: "And Tomek from Sales?",
    icon: "↳",
  },
  {
    tag: "PRODUCT",
    title: "Explore product docs",
    prompt: "Does our product support SSO?",
    icon: "▤",
  },
  {
    tag: "FOLLOW-UP",
    title: "Keep the context",
    prompt: "What plan do I need?",
    icon: "↳",
  },
  {
    tag: "NO RAG",
    title: "Ask a general question",
    prompt: "Explain dependency injection in two sentences.",
    icon: "◇",
  },
  {
    tag: "CRM",
    title: "Look up an account",
    prompt: "What plan is Globex on?",
    icon: "▦",
  },
];
export default function Chat({ missingKeys }: { missingKeys: string[] }) {
  const configured = missingKeys.length === 0;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorLog, setErrorLog] = useState<LlmExchange[] | undefined>();
  const lock = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pending]);
  async function send(message: string) {
    if (!configured || !message.trim() || lock.current) return;
    lock.current = true;
    setPending(message);
    setError("");
    setErrorLog(undefined);
    setInput("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentMessage: message,
          conversationState:
            turns.at(-1)?.generation.conversationState ?? emptyState,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrorLog(result.llmLog);
        throw new Error(result.error || "Request failed");
      }
      setTurns((previous) => [...previous, result]);
      setSelected(turns.length);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to connect. Please retry.",
      );
      setInput(message);
    } finally {
      setPending(null);
      lock.current = false;
    }
  }
  const latest = turns.at(-1);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Jev playground home">
          <span className="brand-mark">
            j<span>↗</span>
          </span>
          <strong>jev</strong>
          <span className="brand-divider" />
          <span className="brand-by">by TypeSafe AI</span>
        </a>
        <div className="topbar-right">
          <span className="sandbox-label">ROUTING PLAYGROUND</span>
          <a href="https://docs.typesafe.ai" target="_blank" rel="noreferrer">
            Documentation ↗
          </a>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> CONVERSATIONAL RAG DEMO
            </div>
            <h1>Jev decides. Your LLM answers.</h1>
            <p>
              Follow the route from a question to an answer. See exactly what
              happens in between.
            </p>
          </div>
          <div className="mode-group">
            <span>
              Jev{" "}
              <b>
                {missingKeys.includes("TYPESAFE_API_KEY")
                  ? "KEY MISSING"
                  : "LIVE"}
              </b>
            </span>
            <span>
              LLM{" "}
              <b>
                {missingKeys.includes("OPENAI_API_KEY")
                  ? "KEY MISSING"
                  : "LIVE"}
              </b>
            </span>
          </div>
        </div>
        <div
          className="architecture-strip"
          tabIndex={0}
          aria-label="Architecture flow"
        >
          <span className="strip-label">THE ARCHITECTURE</span>
          <span>User + state</span>
          <b>→</b>
          <span className="strip-jev">Jev router</span>
          <b>→</b>
          <span>
            RAG <small>if needed</small>
          </span>
          <b>→</b>
          <span>LLM</span>
          <b>→</b>
          <span>Answer + new state</span>
          <span className="loop-label">↶ next turn</span>
        </div>
        <div className="workspace">
          <section className="chat-panel">
            <div className="panel-heading">
              <div>
                <span className="chat-icon">◫</span>
                <h2>Conversation</h2>
                <span className="counter">
                  {turns.length} {turns.length === 1 ? "turn" : "turns"}
                </span>
              </div>
              <button
                className="reset"
                disabled={!!pending || !turns.length}
                onClick={() => {
                  setTurns([]);
                  setSelected(0);
                  setError("");
                  setInput("");
                }}
              >
                ↺ <span>Reset conversation</span>
              </button>
            </div>
            <div
              className="messages"
              tabIndex={0}
              aria-label="Conversation messages"
            >
              {!turns.length && !pending ? (
                <div className="welcome">
                  <div className="welcome-symbol">↗</div>
                  <span className="eyebrow">
                    A SMALL MODEL. A CLEAR DECISION.
                  </span>
                  <h2>Give your question a direction.</h2>
                  <p>
                    Ask about your company or something entirely different.
                    <br />
                    Jev chooses a source. The LLM takes it from there.
                  </p>
                  <div className="scenario-heading">
                    <span>TRY A DEMO SCENARIO</span>
                    <span>Click to send ↙</span>
                  </div>
                  <div className="scenario-grid">
                    {scenarios.map((s) => (
                      <button
                        key={s.prompt}
                        className="scenario"
                        disabled={!configured || !!pending}
                        onClick={() => send(s.prompt)}
                      >
                        <span className="scenario-icon">{s.icon}</span>
                        <span>
                          <small>{s.tag}</small>
                          <strong>{s.title}</strong>
                          <span>{s.prompt}</span>
                        </span>
                        <b>↗</b>
                      </button>
                    ))}
                  </div>
                  <p className="welcome-tip">
                    Try a follow-up after its HR or product question to see
                    compact memory in action.
                  </p>
                </div>
              ) : (
                <>
                  {turns.map((turn, i) => (
                    <div className="turn" key={turn.id}>
                      <div className="user-message">
                        <span className="avatar user-avatar">Y</span>
                        <div>
                          <span className="message-author">You</span>
                          <p>{turn.currentMessage}</p>
                        </div>
                      </div>
                      <div className="assistant-message">
                        <span className="avatar assistant-avatar">j↗</span>
                        <div className="assistant-content">
                          <div className="message-author">
                            Assistant <span>LLM</span>
                          </div>
                          <p>{turn.generation.answer}</p>
                          <button
                            className={`turn-flow ${selected === i ? "selected" : ""}`}
                            aria-label={`Inspect turn ${i + 1}`}
                            onClick={() => setSelected(i)}
                          >
                            <FlowStep
                              label="JEV"
                              kind="jev"
                              detail={turn.decision.route}
                            />
                            <b>→</b>
                            {turn.retrieval.used && (
                              <>
                                <FlowStep label="RAG" kind="rag" />
                                <b>→</b>
                              </>
                            )}
                            <FlowStep label="LLM" kind="llm" />
                            <b>→</b>
                            <FlowStep label="STATE" kind="state" />
                            <span className="inspect-link">Inspect ↗</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pending && (
                    <div className="pending" role="status">
                      <p>{pending}</p>
                      <span className="pulse" /> Routing → retrieval if needed →
                      answer + state…
                    </div>
                  )}
                  <div ref={end} />
                </>
              )}
            </div>
            <div className="composer-area">
              {!configured && (
                <p className="error" role="alert">
                  Set {missingKeys.join(" and ")} in .env.local, restart the
                  server, and reload this page to enable live chat.
                </p>
              )}
              {turns.length > 0 && (
                <div className="quick-prompts">
                  {scenarios.map((s) => (
                    <button
                      key={s.prompt}
                      disabled={!configured || !!pending}
                      title={s.prompt}
                      onClick={() => send(s.prompt)}
                    >
                      {s.title} ↗
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                  {errorLog && (
                    <details className="llm-log-box">
                      <summary>LLM log · what the provider returned</summary>
                      <LlmLog log={errorLog} />
                    </details>
                  )}
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <textarea
                  aria-label="Your message"
                  placeholder="Ask a question. Jev will find the way."
                  rows={2}
                  value={input}
                  maxLength={2000}
                  disabled={!configured || !!pending}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <button
                  aria-label="Send message"
                  disabled={!configured || !!pending || !input.trim()}
                  type="submit"
                >
                  ↑
                </button>
              </form>
              <div className="composer-caption">
                <span>
                  <span className="live-dot" />{" "}
                  {latest?.generation.conversationState.dataDomain
                    ? `Memory active · ${latest.generation.conversationState.topic}`
                    : "Compact memory · no full-history routing"}
                </span>
                <span>Enter to send</span>
              </div>
            </div>
          </section>
          <DebugPanel
            turn={turns[selected]}
            count={turns.length}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <footer className="page-footer">
          <span>Built to make the decision visible.</span>
          <span>
            Jev routes <i>·</i> Mock data retrieves <i>·</i> LLM generates
          </span>
          <span>All company data is fictional.</span>
        </footer>
      </main>
    </div>
  );
}
