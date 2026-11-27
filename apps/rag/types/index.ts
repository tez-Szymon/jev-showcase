export const routes = ["NO_RAG", "HR", "PRODUCT_DOCS", "CRM"] as const;
export type Route = (typeof routes)[number];
export type Domain = Exclude<Route, "NO_RAG">;
export type ConversationState = {
  topic: string | null;
  intent: string | null;
  subject: string | null;
  dataDomain: Domain | null;
  lastAction: string | null;
};
export type Input = {
  currentMessage: string;
  conversationState: ConversationState;
};
export type Decision = {
  route: Route;
  confidence: number;
  needsContext: number;
  model: string;
  raw: unknown;
};
export type Document = { id: string; title: string; text: string };
export type Generation = {
  answer: string;
  conversationState: ConversationState;
  model: string;
  raw: unknown;
  log: import("@/lib/llmLog").LlmExchange[];
};
export type Turn = {
  id: string;
  currentMessage: string;
  previousState: ConversationState;
  decision: Decision;
  retrieval: { used: boolean; source: Domain | null; documents: Document[] };
  generation: Generation;
  timing: { jev: number; rag: number; llm: number; total: number };
};
