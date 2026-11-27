import { createServer } from "node:http";
// Test-only HTTP server. The app has no mock mode or hardcoded classification.
createServer(async (req, res) => {
  if (req.url === "/health") {
    res.end("ok");
    return;
  }
  if (req.url !== "/v1/systemone" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  if (!request.state?.ticket?.subject || !request.questions?.routing) {
    res.writeHead(400).end();
    return;
  }
  if (request.state.ticket.subject.includes("[429]")) {
    res.writeHead(429).end("{}");
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      model: "test-http-transport",
      answers: {
        routing: {
          type: "choice",
          choice: "technical",
          confidence: 0.95,
          probabilities: {
            technical: 0.94,
            complaint: 0.01,
            offer: 0.01,
            other: 0.01,
            mixed: 0.01,
            insufficient: 0.01,
            spam: 0.01,
          },
        },
      },
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
  );
}).listen(3199, "127.0.0.1");
