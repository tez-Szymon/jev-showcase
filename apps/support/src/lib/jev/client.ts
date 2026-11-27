import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { env } from "../env";
import { analysisSchema } from "../validation";
import { questions, questionVersion } from "./questions";
export async function classifyTicket(input: {
  subject: string;
  description: string;
}) {
  const config = env();
  if (!config.apiKey) throw new Error("api_unavailable");
  const client = new TypeSafeClient({
    apiKey: config.apiKey,
    defaultModel: config.model,
    timeout: 8000,
    retry: { maxRetries: 0 },
    logLevel: "off",
  });
  const response = await client.systemOne({
    state: { ticket: input },
    questions,
  });
  const result = analysisSchema.safeParse({
    ...response.answers.routing,
    model: response.model,
    questionVersion,
  });
  if (!result.success) throw new Error("invalid_result");
  return result.data;
}
