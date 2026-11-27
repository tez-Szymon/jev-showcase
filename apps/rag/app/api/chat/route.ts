import { ConfigurationError, ProviderError } from "@/lib/providerErrors";
import "server-only";
import { isState } from "@/lib/conversationState";
import { runTurn } from "@/lib/chat";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 16000)
      return Response.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(text);
    if (
      !body ||
      typeof body.currentMessage !== "string" ||
      !body.currentMessage.trim() ||
      body.currentMessage.length > 2000 ||
      !isState(body.conversationState)
    )
      return Response.json(
        {
          error:
            "Provide a message of 1–2,000 characters and a valid compact state.",
        },
        { status: 400 },
      );
    return Response.json(
      await runTurn({
        currentMessage: body.currentMessage.trim(),
        conversationState: body.conversationState,
      }),
    );
  } catch (error) {
    if (error instanceof ConfigurationError || error instanceof ProviderError) {
      return Response.json(
        {
          error: error.message,
          ...(error instanceof ProviderError && error.log?.length ? { llmLog: error.log } : {}),
        },
        { status: error instanceof ConfigurationError ? 503 : 502 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid JSON request."
            : "This turn could not be completed. Please try again.",
      },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}
