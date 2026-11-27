// Hotdog / Not hotdog — a tiny demo server that asks Jev (TypeSafe) one yes/no question.
// The API key stays here on the server; the browser only ever talks to /api/classify.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { image, noul, TypeSafeClient } from "@typesafe-ai/sdk";

const PORT = Number(process.env.PORT ?? 3000);
const MODEL = process.env.TYPESAFE_MODEL ?? "jev-latest";
// A Noul is the probability that the answer is "yes". 0.5 = whichever side is more likely,
// which is exactly the binary verdict the demo wants.
const THRESHOLD = Number(process.env.HOTDOG_THRESHOLD ?? 0.5);
const MAX_UPLOAD = 16 * 1024 * 1024;

if (!process.env.TYPESAFE_API_KEY) {
  console.error("Missing TYPESAFE_API_KEY. Put it in .env (see .env.example) or export it.");
  process.exit(1);
}

const client = new TypeSafeClient({
  // Images are opt-in ("dreamer-ready") on the TypeSafe API.
  defaultHeaders: { "TypeSafe-Danger-Zone-Images": "true" },
});

async function classify(bytes) {
  const photo = image(bytes);
  const request = {
    model: MODEL,
    state: { photo },
    questions: {
      is_hotdog: noul("Does `photo` show a hot dog?", {
        true: "The photo shows at least one hot dog: a sausage or frankfurter served in a sliced bun, with or without toppings. Real food, a drawing, or a toy all count if it is clearly a hot dog.",
        false: "No hot dog is shown. A sausage without a bun, a bun without a sausage, a sandwich, a burger, a taco, a hot dog stand with no hot dog visible, or anything else is not a hot dog.",
      }),
    },
  };

  const started = Date.now();
  const { data, requestId } = await client.systemOne(request).withResponse();
  const ms = Date.now() - started;

  const p = data.answers.is_hotdog.noul;
  const trace = {
    // What goes over the wire. The SDK sends the image bytes as a separate multipart part and
    // writes a reference string wherever the image appears, so we show that reference here.
    request: JSON.parse(JSON.stringify({
      ...request,
      assets: { [String(photo)]: { type: "image", format: sniffFormat(bytes), bytes: bytes.length } },
    })),
    response: data,
    requestId,
    ms,
  };
  logTrace(trace, p);
  return { hotdog: p >= THRESHOLD, probability: p, threshold: THRESHOLD, trace };
}

function sniffFormat(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  return "unknown";
}

const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
function logTrace({ request, response, requestId, ms }, p) {
  const verdict = p >= THRESHOLD ? c("1;32", "HOTDOG") : c("1;31", "NOT HOTDOG");
  console.log(`\n${c("2", "─".repeat(70))}`);
  console.log(`${c("1;33", "→ POST https://api.typesafe.ai/v1/systemone")}  ${c("2", "(TypeSafe-Danger-Zone-Images: true)")}`);
  console.log(JSON.stringify(request, null, 2));
  console.log(`${c("1;36", `← 200 OK`)}  ${c("2", `${ms} ms · ${requestId ?? ""}`)}`);
  console.log(JSON.stringify(response, null, 2));
  console.log(`${c("1", "=")} P(hotdog) ${p.toFixed(3)} ${p >= THRESHOLD ? "≥" : "<"} ${THRESHOLD}  →  ${verdict}`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(Object.assign(new Error("Image too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(new URL("./public/index.html", import.meta.url)));
      return;
    }
    if (req.method === "POST" && req.url === "/api/classify") {
      const bytes = await readBody(req);
      if (bytes.length === 0) return json(res, 400, { error: "No image received" });
      return json(res, 200, await classify(bytes));
    }
    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    json(res, err.status ?? 500, { error: err.message ?? "Something went wrong" });
  }
}).listen(PORT, () => {
  console.log(`Hotdog / Not hotdog → http://localhost:${PORT}  (model: ${MODEL})`);
});
