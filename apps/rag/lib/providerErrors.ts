export class ConfigurationError extends Error {
  constructor(names: string[]) {
    super(
      `Missing API keys: ${names.join(", ")}. Set them in .env.local and restart the server.`,
    );
  }
}
import type { LlmExchange } from "./llmLog";
// `log` carries the recorded LLM exchange, so the page can show what the provider said.
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly log?: LlmExchange[],
  ) {
    super(message);
  }
}
export function missingApiKeys() {
  return ["TYPESAFE_API_KEY", "OPENAI_API_KEY"].filter(
    (name) => !process.env[name]?.trim(),
  );
}
export function requireApiKeys() {
  const missing = missingApiKeys();
  if (missing.length) throw new ConfigurationError(missing);
}
