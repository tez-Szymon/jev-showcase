import { requireApiKeys } from "./providerErrors";
import { routeWithJev } from "@/lib/jev";
import { retrieveMockContext } from "@/lib/mockRag";
import { generateAnswer } from "@/lib/llm";
import type { Input, Turn } from "@/types";
export async function runTurn(
  input: Input,
  deps = { routeWithJev, retrieveMockContext, generateAnswer },
): Promise<Turn> {
  requireApiKeys();
  const start = performance.now();
  const decision = await deps.routeWithJev(input);
  const routed = performance.now();
  const source = decision.route === "NO_RAG" ? null : decision.route;
  const documents = source
    ? deps.retrieveMockContext(
        source,
        input.currentMessage,
        input.conversationState,
      )
    : [];
  const retrieved = performance.now();
  const generation = await deps.generateAnswer({
    ...input,
    route: decision.route,
    documents,
  });
  const end = performance.now();
  return {
    id: crypto.randomUUID(),
    currentMessage: input.currentMessage,
    previousState: input.conversationState,
    decision,
    retrieval: { used: source !== null, source, documents },
    generation,
    timing: {
      jev: routed - start,
      rag: retrieved - routed,
      llm: end - retrieved,
      total: end - start,
    },
  };
}
