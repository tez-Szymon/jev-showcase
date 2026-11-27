import type { LlmExchange } from "@/lib/llmLog";

type Message = { role?: string; content?: unknown };
const pretty = (value: unknown) => {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
};
const headerLines = (headers?: Record<string, string>) =>
  Object.entries(headers ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

// The exact HTTP exchange with the LLM provider, as recorded on the server.
export default function LlmLog({ log }: { log?: LlmExchange[] }) {
  if (!log?.length) return null;
  return (
    <div className="llm-log">
      {log.map((x, i) => {
        const body = (x.requestBody ?? {}) as { messages?: Message[]; [k: string]: unknown };
        const { messages, ...options } = body;
        const res = x.responseBody as {
          model?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
        } | null;
        const url = new URL(x.url);
        return (
          <div className="llm-exchange" key={i}>
            <div className="llm-stats">
              <span>
                {x.method} {url.host}
                {url.pathname}
              </span>
              <span className={x.status && x.status < 400 ? "ok" : "bad"}>
                {x.error ? `failed: ${x.error}` : `HTTP ${x.status} ${x.statusText ?? ""}`}
              </span>
              {x.ms != null && <span>{x.ms} ms</span>}
              {res?.usage && (
                <span>
                  {res.usage.prompt_tokens} in · {res.usage.completion_tokens} out tokens
                  {typeof res.usage.cost === "number" ? ` · $${res.usage.cost.toFixed(5)}` : ""}
                </span>
              )}
            </div>
            <details open>
              <summary>Request headers</summary>
              <pre>{`${x.method} ${x.url}\n${headerLines(x.requestHeaders)}`}</pre>
            </details>
            {messages?.map((m, j) => (
              <details key={j} open={m.role !== "system"}>
                <summary>
                  Message {j + 1} · <b>{m.role}</b>
                  {m.role === "user" ? " (message, state and retrieved documents)" : ""}
                </summary>
                <pre>{pretty(m.content)}</pre>
              </details>
            ))}
            <details>
              <summary>Other request fields (model, limits, response schema)</summary>
              <pre>{pretty(options)}</pre>
            </details>
            <details open>
              <summary>Response {x.status ? `· HTTP ${x.status}` : ""}</summary>
              <pre>
                {headerLines(x.responseHeaders)}
                {x.responseHeaders && Object.keys(x.responseHeaders).length ? "\n\n" : ""}
                {x.error ? x.error : pretty(x.responseBody)}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}
