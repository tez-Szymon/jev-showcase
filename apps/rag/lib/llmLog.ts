// Records the HTTP exchange the OpenAI SDK makes (to OpenAI or OpenRouter), so the
// turn inspector can show exactly what was sent and received. The key is redacted.
export type LlmExchange = {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status?: number;
  statusText?: string;
  ms?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  error?: string;
};

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
// Headers worth showing; the rest (cookies, CDN noise) is left out.
const interesting = /^(content-type|x-request-id|openai-|x-ratelimit-|x-generation-id|x-openrouter)/i;

export function recordingFetch(log: LlmExchange[]): typeof fetch {
  return async (input, init) => {
    const requestHeaders = Object.fromEntries(new Headers(init?.headers).entries());
    if (requestHeaders.authorization) requestHeaders.authorization = "Bearer ••••••••";
    const entry: LlmExchange = {
      method: init?.method ?? "GET",
      url: input instanceof Request ? input.url : String(input),
      requestHeaders,
      requestBody: typeof init?.body === "string" ? parse(init.body) : init?.body == null ? null : "(non-text body)",
    };
    log.push(entry);
    const started = performance.now();
    try {
      // Looked up at call time, so tests that replace global fetch still apply.
      const res = await globalThis.fetch(input, init);
      entry.status = res.status;
      entry.statusText = res.statusText;
      entry.ms = Math.round(performance.now() - started);
      entry.responseHeaders = Object.fromEntries([...res.headers.entries()].filter(([k]) => interesting.test(k)));
      entry.responseBody = parse(await res.clone().text());
      return res;
    } catch (error) {
      entry.ms = Math.round(performance.now() - started);
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  };
}
