import { afterEach, it, expect, vi } from "vitest";
import { classifyTicket } from "../src/lib/jev/client";
import { analysis } from "./fixtures/jev";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const input = {
  subject: "No internet connection",
  description: "I have had no internet since this morning.",
};
it("maps actual SDK HTTP response and sends the versioned question", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test-secret");
  let sent: Record<string, unknown> = {};
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(
      JSON.stringify({
        model: "jev-test-version",
        answers: { routing: { type: "choice", ...analysis() } },
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const result = await classifyTicket(input);
  expect(result).toEqual({ ...analysis(), model: "jev-test-version" });
  expect(sent.state).toEqual({ ticket: input });
  expect(sent.questions).toHaveProperty("routing.criteria.insufficient");
});
it("makes a single attempt on rate limiting without retry", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test-secret");
  let requests = 0;
  vi.stubGlobal("fetch", async () => {
    requests++;
    return new Response("{}", { status: 429 });
  });
  await expect(classifyTicket(input)).rejects.toThrow();
  expect(requests).toBe(1);
});
it("fails without a key before reaching the network", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "");
  vi.stubGlobal("fetch", () => {
    throw new Error("unexpected network");
  });
  await expect(classifyTicket(input)).rejects.toThrow("api_unavailable");
});
it("rejects malformed output from the SDK transport", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test-secret");
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          model: "test",
          answers: { routing: { ...analysis(), confidence: 2 } },
        }),
        { status: 200 },
      ),
  );
  await expect(classifyTicket(input)).rejects.toThrow("invalid_result");
});
