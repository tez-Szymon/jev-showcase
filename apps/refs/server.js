// Image references: shows that a Jev question can carry pictures in its instructions
// (compare with a reference) and in its criteria (options and score levels defined by
// example pictures). The API key stays on this server.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { APIError, image, TypeSafeClient, withAssets } from "@typesafe-ai/sdk";
import { buildPresets } from "./presets.js";
import { recordingFetch } from "./wire.js";

const PORT = Number(process.env.PORT ?? 4315);
const MODEL = process.env.TYPESAFE_MODEL ?? "jev-preview";
const MAX_BODY = 40 * 1024 * 1024;
const MAX_REFS = 8;

if (!process.env.TYPESAFE_API_KEY) {
  console.error("Missing TYPESAFE_API_KEY.");
  process.exit(1);
}
// One client per run, so each run's raw HTTP log is its own.
const newClient = (log) =>
  new TypeSafeClient({
    timeout: 60000,
    // Images are opt-in ("dreamer-ready") on the TypeSafe API.
    defaultHeaders: { "TypeSafe-Danger-Zone-Images": "true" },
    fetch: recordingFetch(log),
  });
const presets = await buildPresets();

class InputError extends Error {}

// Upright JPEG with each side between 280 and 1568 px (the API rejects anything else).
async function prepare(dataUrl, what) {
  const m = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(dataUrl ?? "");
  if (!m) throw new InputError(`${what}: missing image.`);
  try {
    const input = Buffer.from(m[1], "base64");
    const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    let { width = 0, height = 0 } = meta;
    if ((meta.orientation ?? 1) >= 5) [width, height] = [height, width];
    if (!width || !height || Math.max(width, height) / Math.min(width, height) > 1568 / 280)
      throw new InputError(`${what}: the picture is too narrow; crop it closer to square.`);
    const scale = Math.max(280 / Math.min(width, height), Math.min(1, 1568 / Math.max(width, height)));
    const out = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(Math.round(width * scale), Math.round(height * scale))
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();
    const thumb = await sharp(out).resize(160, 160, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    return { img: image(new Uint8Array(out)), thumb: `data:image/jpeg;base64,${thumb.toString("base64")}` };
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`${what}: could not read the image (use PNG, JPEG or WebP).`);
  }
}

const text = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// An option with a description sends both; without one, the picture alone defines it.
const entry = (ref) => (ref.description ? { description: ref.description, example: ref.img } : ref.img);

async function run(body) {
  const mode = body.mode;
  if (!["match", "choice", "score", "find"].includes(mode)) throw new InputError("Unknown mode.");
  const instructions = text(body.instructions);
  if (!instructions) throw new InputError("Write the instructions.");
  const rawRefs = Array.isArray(body.refs) ? body.refs.slice(0, MAX_REFS) : [];
  if (rawRefs.length < (mode === "match" || mode === "find" ? 1 : 2))
    throw new InputError(mode === "match" || mode === "find" ? "Add at least one reference picture." : "Add at least two example pictures.");

  const query = await prepare(body.query, "Photo");
  const refs = await Promise.all(
    rawRefs.map(async (r, i) => ({
      label: text(r.label, 60) || `ref_${i + 1}`,
      description: text(r.description, 500),
      ...(await prepare(r.image, `Reference ${i + 1}`)),
    })),
  );
  const labels = refs.map((r) => r.label);
  if (new Set(labels).size !== labels.length) throw new InputError("Labels must be unique.");

  // Splits a template at {reference} and puts the picture there; withAssets attaches
  // the image to the text it appears in.
  const fill = (template, r) =>
    withAssets.join(
      template.replaceAll("{label}", r.label).split("{reference}").flatMap((t, j) => (j ? [r.img, t] : [t])),
      "",
    );
  if ((mode === "match" || mode === "find") && !instructions.includes("{reference}"))
    throw new InputError("Put {reference} in the instructions where the reference picture goes.");

  let questions;
  if (mode === "find") {
    // A Box always returns a box, even for something that isn't there, so each target
    // also gets a Noul asking whether it is present at all.
    questions = {};
    refs.forEach((r, i) => {
      questions[`present_${i + 1}`] = {
        type: "noul",
        instructions: fill("Does `photo` contain the thing shown in this picture: {reference}?", r),
      };
      questions[`box_${i + 1}`] = { type: "box", instructions: fill(instructions, r) };
    });
  } else if (mode === "match") {
    if (!instructions.includes("{reference}")) throw new InputError("Put {reference} in the instructions where the reference picture goes.");
    // One Noul per reference. The picture sits inside the sentence, so it is sent
    // with that question only.
    questions = Object.fromEntries(
      refs.map((r, i) => [
        `ref_${i + 1}`,
        {
          type: "noul",
          instructions: fill(instructions, r),
        },
      ]),
    );
  } else if (mode === "choice") {
    const criteria = Object.fromEntries(refs.map((r) => [r.label, entry(r)]));
    if (body.none) criteria.none_of_these = "It matches none of the other options' example pictures.";
    questions = { result: { type: "choice", instructions, criteria } };
  } else {
    questions = { result: { type: "score", instructions, criteria: refs.map(entry) } };
  }

  const request = { model: MODEL, state: { photo: query.img }, questions };
  const started = Date.now();
  const wire = [];
  const { data, requestId } = await newClient(wire).systemOne(request).withResponse();
  const ms = Date.now() - started;

  // What went over the wire (references instead of bytes) plus a thumbnail per reference,
  // so the page can show which picture each reference string stands for.
  const assets = { [String(query.img)]: { name: "photo", thumb: query.thumb } };
  refs.forEach((r) => (assets[String(r.img)] = { name: r.label, thumb: r.thumb }));
  return {
    mode,
    labels,
    answers: data.answers,
    model: data.model,
    usage: data.usage,
    requestId,
    ms,
    sent: JSON.parse(JSON.stringify(request)),
    wire,
    assets,
  };
}

const send = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(new URL("./public/index.html", import.meta.url)));
    }
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, model: MODEL });
    if (req.method === "GET" && url.pathname === "/api/presets") return send(res, 200, presets);
    if (req.method === "POST" && url.pathname === "/api/run") {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX_BODY) throw new InputError("The images are too large together (40 MB max).");
        chunks.push(c);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new InputError("Invalid request.");
      }
      return send(res, 200, await run(body));
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    if (e instanceof InputError) return send(res, 400, { error: e.message });
    if (e instanceof APIError) {
      console.error(`TypeSafe error ${e.status}: ${e.message}`);
      return send(res, 502, { error: `TypeSafe returned ${e.status}: ${e.message}` });
    }
    console.error(e);
    send(res, 500, { error: "Something went wrong. Check the server output." });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Image references: http://127.0.0.1:${PORT} (model ${MODEL})`));
