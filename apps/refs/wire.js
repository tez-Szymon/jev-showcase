// Records the exact HTTP exchange the SDK makes, for display. The SDK is given this
// fetch wrapper, so what is logged is what went over the wire (API key redacted).
import zlib from "node:zlib";

const HEX = (buf) => [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");

async function bodyBytes(body) {
  if (body == null) return Buffer.alloc(0);
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  return Buffer.from(String(body));
}

// Splits a multipart/form-data body into its parts. Text parts are kept as text;
// binary parts are summarised (size, first bytes), never sent to the page as bytes.
function parseMultipart(buf, boundary) {
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let pos = buf.indexOf(delim);
  while (pos !== -1) {
    const start = pos + delim.length;
    if (buf.subarray(start, start + 2).toString() === "--") break; // closing delimiter
    const next = buf.indexOf(delim, start);
    if (next === -1) break;
    const raw = buf.subarray(start + 2, next - 2); // skip CRLF after delimiter and before next
    const split = raw.indexOf("\r\n\r\n");
    const headers = raw.subarray(0, split).toString().split("\r\n");
    const content = raw.subarray(split + 4);
    const type = (headers.find((h) => /^content-type:/i.test(h)) ?? "").split(":")[1]?.trim() ?? "";
    const name = /name="([^"]+)"/.exec(headers[0] ?? "")?.[1] ?? "";
    parts.push(
      type.startsWith("application/json") || type.startsWith("text/")
        ? { name, headers, kind: "text", text: content.toString("utf8") }
        : { name, headers, kind: "binary", bytes: content.length, head: HEX(content.subarray(0, 16)) },
    );
    pos = next;
  }
  return parts;
}

export function recordingFetch(log) {
  return async (url, init = {}) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    if (headers.authorization) headers.authorization = "Bearer ••••••••";
    const wire = await bodyBytes(init.body);
    let plain = wire;
    const encoding = headers["content-encoding"];
    if (encoding === "zstd") plain = zlib.zstdDecompressSync(wire);
    else if (encoding === "gzip") plain = zlib.gunzipSync(wire);
    const boundary = /boundary=([^;]+)/.exec(headers["content-type"] ?? "")?.[1];
    const entry = {
      method: init.method ?? "GET",
      url,
      headers,
      wireBytes: wire.length,
      bodyBytes: plain.length,
      boundary,
      parts: boundary ? parseMultipart(plain, boundary) : null,
      text: boundary ? null : plain.toString("utf8"),
    };
    log.push(entry);
    const started = Date.now();
    const res = await fetch(url, init);
    const text = await res.clone().text();
    entry.response = {
      status: res.status,
      statusText: res.statusText,
      ms: Date.now() - started,
      headers: Object.fromEntries([...res.headers.entries()].filter(([k]) => /^(content-type|content-length|x-request-id|request-id|typesafe-|x-typesafe)/i.test(k))),
      text,
    };
    return res;
  };
}
