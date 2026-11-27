import test from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "../lib/chat";
import { routeWithJev } from "../lib/jev";
import { generateAnswer } from "../lib/llm";
import { retrieveMockContext } from "../lib/mockRag";
import { emptyState, isState } from "../lib/conversationState";
import { ConfigurationError, ProviderError } from "../lib/providerErrors";
import type { ConversationState, Route } from "../types";

// HTTP fixtures exercise the real SDK adapters; no substitute models ship in the app.
async function withProviders(work: () => Promise<void>) {
  const originalFetch = global.fetch;
  const originalKeys = [
    process.env.TYPESAFE_API_KEY,
    process.env.OPENAI_API_KEY,
  ];
  process.env.TYPESAFE_API_KEY = "test-typesafe";
  process.env.OPENAI_API_KEY = "test-openai";
  try {
    await work();
  } finally {
    global.fetch = originalFetch;
    ["TYPESAFE_API_KEY", "OPENAI_API_KEY"].forEach((name, index) => {
      if (originalKeys[index] === undefined) delete process.env[name];
      else process.env[name] = originalKeys[index];
    });
  }
}
const input = { currentMessage: "Hello", conversationState: emptyState };
const generationInput = { ...input, route: "NO_RAG" as Route, documents: [] };
function decision(route: Route) {
  return {
    model: "jev-test",
    answers: {
      route: {
        type: "choice",
        choice: route,
        confidence: 0.92,
        probabilities: { [route]: 1 },
      },
      needs_context: { type: "noul", noul: route === "NO_RAG" ? 0.02 : 0.98 },
    },
  };
}
function completion(answer: string, conversationState = emptyState) {
  return {
    model: "openai-test",
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({ answer, conversationState }),
          refusal: null,
        },
      },
    ],
  };
}

test("SDK pipeline carries compact state, retrieves only selected sources, and generates once", async () =>
  withProviders(async () => {
    const hr = {
      ...emptyState,
      topic: "vacation balance",
      subject: "Current User",
      dataDomain: "HR",
    } satisfies ConversationState;
    const product = {
      ...emptyState,
      topic: "Single sign-on",
      subject: "Acme Analytics",
      dataDomain: "PRODUCT_DOCS",
    } satisfies ConversationState;
    const cases: {
      message: string;
      route: Route;
      state: ConversationState;
      expected: string;
    }[] = [
      {
        message: "How many vacation days do I have left?",
        route: "HR",
        state: hr,
        expected: "12",
      },
      {
        message: "And Tomek from Sales?",
        route: "HR",
        state: { ...hr, subject: "Tomasz Kowalski" },
        expected: "7",
      },
      {
        message: "Explain dependency injection in two sentences.",
        route: "NO_RAG",
        state: emptyState,
        expected: "",
      },
      {
        message: "Does our product support SSO?",
        route: "PRODUCT_DOCS",
        state: product,
        expected: "Business and Enterprise",
      },
      {
        message: "What plan do I need?",
        route: "PRODUCT_DOCS",
        state: product,
        expected: "Business and Enterprise",
      },
      {
        message: "How many vacation days do I have?",
        route: "HR",
        state: hr,
        expected: "12",
      },
      {
        message: "What plan is Globex on?",
        route: "CRM",
        state: { ...emptyState, subject: "Globex", dataDomain: "CRM" },
        expected: "Enterprise",
      },
    ];
    let previousState = emptyState;
    for (const scenario of cases) {
      const order: string[] = [];
      global.fetch = async (url, init) => {
        const body = JSON.parse(init!.body as string);
        if (String(url).includes("typesafe.ai")) {
          order.push("jev");
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            "Bearer test-typesafe",
          );
          assert.deepEqual(body.state, {
            current_message: scenario.message,
            conversation_state: previousState,
          });
          assert.equal(body.questions.route.type, "choice");
          assert.equal(body.questions.needs_context.type, "noul");
          return Response.json(decision(scenario.route));
        }
        order.push("llm");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer test-openai",
        );
        assert.equal(body.response_format.json_schema.strict, true);
        const payload = JSON.parse(body.messages[1].content);
        assert.deepEqual(payload.conversationState, previousState);
        assert.equal(payload.route, scenario.route);
        if (scenario.route === "NO_RAG")
          assert.deepEqual(payload.documents, []);
        else
          assert.ok(
            payload.documents.some((d: { text: string }) =>
              d.text.includes(scenario.expected),
            ),
          );
        return Response.json(completion("Provider answer", scenario.state));
      };
      const turn = await runTurn(
        { currentMessage: scenario.message, conversationState: previousState },
        {
          routeWithJev,
          generateAnswer,
          retrieveMockContext: (...args) => {
            order.push("rag");
            return retrieveMockContext(...args);
          },
        },
      );
      assert.deepEqual(
        order,
        scenario.route === "NO_RAG" ? ["jev", "llm"] : ["jev", "rag", "llm"],
      );
      assert.equal(turn.generation.answer, "Provider answer");
      assert.deepEqual(turn.generation.conversationState, scenario.state);
      assert.equal(turn.decision.confidence, 0.92);
      previousState = turn.generation.conversationState;
    }
  }));

test("both keys are required before making any provider call", async () =>
  withProviders(async () => {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error("Unexpected call");
    };
    for (const name of ["TYPESAFE_API_KEY", "OPENAI_API_KEY"]) {
      const key = process.env[name];
      process.env[name] = "  ";
      await assert.rejects(runTurn(input), ConfigurationError);
      process.env[name] = key;
    }
    delete process.env.TYPESAFE_API_KEY;
    await assert.rejects(routeWithJev(input), ConfigurationError);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(generateAnswer(generationInput), ConfigurationError);
    assert.equal(calls, 0);
  }));

test("provider transport failures reject without retrying or inventing a response", async () =>
  withProviders(async () => {
    for (const call of [
      () => routeWithJev(input),
      () => generateAnswer(generationInput),
    ]) {
      for (const failure of ["http", "connection"]) {
        let calls = 0;
        global.fetch = async () => {
          calls++;
          if (failure === "connection")
            throw new TypeError("Connection unavailable");
          return Response.json(
            { error: { message: "secret-provider-detail" } },
            { status: 503 },
          );
        };
        await assert.rejects(
          call(),
          (error) =>
            error instanceof ProviderError &&
            !error.message.includes("secret-provider-detail"),
        );
        assert.equal(calls, 1);
      }
    }
  }));

test("invalid Jev decisions stop the pipeline before retrieval or generation", async () =>
  withProviders(async () => {
    for (const raw of [
      {},
      { ...decision("HR"), answers: {} },
      {
        ...decision("HR"),
        answers: {
          ...decision("HR").answers,
          route: { type: "choice", choice: "OTHER", confidence: 0.9 },
        },
      },
    ]) {
      let calls = 0;
      global.fetch = async () => {
        calls++;
        return Response.json(raw);
      };
      await assert.rejects(runTurn(input), ProviderError);
      assert.equal(calls, 1);
    }
  }));

test("OpenAI refusal, truncation, malformed JSON and invalid state reject", async () =>
  withProviders(async () => {
    const responses = [
      {
        choices: [
          {
            finish_reason: "stop",
            message: { refusal: "Refused", content: null },
          },
        ],
      },
      {
        ...completion("partial"),
        choices: [
          { ...completion("partial").choices[0], finish_reason: "length" },
        ],
      },
      {
        choices: [{ finish_reason: "stop", message: { content: "not JSON" } }],
      },
      completion("", emptyState),
      completion("answer", { ...emptyState, topic: "x".repeat(161) }),
    ];
    for (const raw of responses) {
      global.fetch = async () => Response.json(raw);
      await assert.rejects(generateAnswer(generationInput), ProviderError);
    }
  }));

test("failed generation leaves the caller's previous state unchanged", async () =>
  withProviders(async () => {
    const state = { ...emptyState, topic: "existing topic" };
    global.fetch = async (url) =>
      String(url).includes("typesafe.ai")
        ? Response.json(decision("NO_RAG"))
        : Response.json({}, { status: 500 });
    await assert.rejects(
      runTurn({ ...input, conversationState: state }),
      ProviderError,
    );
    assert.deepEqual(state, { ...emptyState, topic: "existing topic" });
  }));

test("compact state validation and missing retrieval records", () => {
  assert.ok(isState(emptyState));
  assert.equal(isState({ ...emptyState, dataDomain: "OTHER" }), false);
  assert.deepEqual(
    retrieveMockContext(
      "HR",
      "How many vacation days does Susan have?",
      emptyState,
    ),
    [],
  );
});
