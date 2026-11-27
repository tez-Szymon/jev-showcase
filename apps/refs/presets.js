// Built-in sample pictures, drawn as SVG and rendered to JPEG at startup, so the demo
// works before anyone uploads a photo. Uploaded photos make a stronger demo.
import sharp from "sharp";

const S = 512;
const svg = (body, bg = "#ffffff") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${bg}"/>${body}</svg>`;

// Traffic signs, centred at (cx, cy) with radius r.
function octagon(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}
const signs = {
  stop: (cx, cy, r) =>
    `<polygon points="${octagon(cx, cy, r)}" fill="#c8102e" stroke="#fff" stroke-width="${r * 0.06}"/>` +
    `<text x="${cx}" y="${cy + r * 0.22}" font-family="Helvetica, Arial" font-weight="700" font-size="${r * 0.62}" fill="#fff" text-anchor="middle">STOP</text>`,
  yield: (cx, cy, r) =>
    `<polygon points="${cx - r},${cy - r * 0.7} ${cx + r},${cy - r * 0.7} ${cx},${cy + r}" fill="#fff" stroke="#c8102e" stroke-width="${r * 0.2}" stroke-linejoin="round"/>`,
  no_entry: (cx, cy, r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#c8102e"/><rect x="${cx - r * 0.72}" y="${cy - r * 0.16}" width="${r * 1.44}" height="${r * 0.32}" fill="#fff"/>`,
  parking: (cx, cy, r) =>
    `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.12}" fill="#1f5fbf" stroke="#fff" stroke-width="${r * 0.06}"/>` +
    `<text x="${cx}" y="${cy + r * 0.45}" font-family="Helvetica, Arial" font-weight="700" font-size="${r * 1.3}" fill="#fff" text-anchor="middle">P</text>`,
};
// A sign on a pole in a street scene: smaller, off-centre and slightly tilted.
const scene = (sign) =>
  svg(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ef"/><stop offset="1" stop-color="#dff0fb"/></linearGradient></defs>` +
      `<rect width="${S}" height="330" fill="url(#sky)"/><rect y="330" width="${S}" height="182" fill="#7a9a5a"/>` +
      `<rect y="380" width="${S}" height="70" fill="#5b5f66"/><rect x="40" y="410" width="60" height="8" fill="#eee"/><rect x="180" y="410" width="60" height="8" fill="#eee"/><rect x="320" y="410" width="60" height="8" fill="#eee"/>` +
      `<rect x="40" y="210" width="110" height="130" fill="#b9886a"/><polygon points="30,210 95,160 160,210" fill="#8a4b3a"/>` +
      `<rect x="354" y="190" width="10" height="200" fill="#777"/>` +
      `<g transform="rotate(-7 359 165)">${signs[sign](359, 165, 62)}</g>`,
  );

// A wider street with three signs, for the Box preset. "no entry" is deliberately absent.
const busyStreet = (() => {
  const W = 960, H = 540;
  const post = (x, top, sign, r, tilt) =>
    `<rect x="${x - 4}" y="${top}" width="8" height="${400 - top}" fill="#777"/><g transform="rotate(${tilt} ${x} ${top})">${signs[sign](x, top, r)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ef"/><stop offset="1" stop-color="#dff0fb"/></linearGradient></defs>` +
    `<rect width="${W}" height="340" fill="url(#sky)"/><rect y="340" width="${W}" height="200" fill="#7a9a5a"/><rect y="400" width="${W}" height="80" fill="#5b5f66"/>` +
    [60, 240, 420, 600, 780].map((x) => `<rect x="${x}" y="436" width="80" height="8" fill="#eee"/>`).join("") +
    `<rect x="30" y="200" width="150" height="150" fill="#b9886a"/><polygon points="20,200 105,140 190,200" fill="#8a4b3a"/>` +
    `<rect x="560" y="170" width="190" height="180" fill="#c7b199"/><rect x="590" y="210" width="40" height="40" fill="#8fb8d8"/><rect x="680" y="210" width="40" height="40" fill="#8fb8d8"/>` +
    `<circle cx="470" cy="300" r="55" fill="#4f7a3a"/><rect x="465" y="330" width="10" height="40" fill="#5a3d2b"/>` +
    post(260, 210, "stop", 38, 4) + post(820, 150, "yield", 44, -6) + post(400, 250, "parking", 30, 0) + `</svg>`;
})();

// Battery icons for a Score rubric: 0 to 4 bars.
const bars = ["#d33", "#e8862a", "#e8c02a", "#3aa655"];
const battery = (n, { x = 136, y = 186, w = 220, h = 140, color } = {}) => {
  let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="none" stroke="#222" stroke-width="12"/>` +
    `<rect x="${x + w + 6}" y="${y + h * 0.3}" width="22" height="${h * 0.4}" rx="5" fill="#222"/>`;
  const gap = 10, bw = (w - 24 - gap * 3) / 4;
  for (let i = 0; i < n; i++)
    body += `<rect x="${x + 12 + i * (bw + gap)}" y="${y + 14}" width="${bw}" height="${h - 28}" rx="4" fill="${color ?? bars[Math.max(n - 1, 0)]}"/>`;
  return body;
};
// The query: three bars, a different size and colour, rotated, on a phone-like screen.
const batteryQuery = svg(
  `<rect x="96" y="40" width="320" height="432" rx="40" fill="#1d2430"/><rect x="116" y="80" width="280" height="352" rx="10" fill="#2f3b4f"/>` +
    `<g transform="rotate(-90 256 256)" ><g transform="translate(40 30) scale(0.78)">${battery(3, { color: "#6fd3ff" }).replaceAll("#222", "#e8eef7")}</g></g>` +
    `<text x="256" y="420" font-family="Helvetica, Arial" font-size="26" fill="#e8eef7" text-anchor="middle">12:41</text>`,
  "#c9ced6",
);

async function jpeg(svgText) {
  const buf = await sharp(Buffer.from(svgText)).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export async function buildPresets() {
  const sign = (k) => jpeg(svg(signs[k](256, 256, 180)));
  const [stop, yieldSign, noEntry, parking, stopScene, yieldScene, busy] = await Promise.all([
    sign("stop"), sign("yield"), sign("no_entry"), sign("parking"), jpeg(scene("stop")), jpeg(scene("yield")), jpeg(busyStreet),
  ]);
  const levels = await Promise.all([0, 1, 2, 3, 4].map((n) => jpeg(svg(battery(n)))));
  return [
    {
      id: "match-sign",
      mode: "match",
      title: "Is this the same sign?",
      instructions: "Does `photo` contain the same traffic sign as this reference picture: {reference}? Ignore size, angle, background and lighting.",
      query: stopScene,
      refs: [
        { label: "stop", description: "", image: stop },
        { label: "yield", description: "", image: yieldSign },
        { label: "parking", description: "", image: parking },
      ],
    },
    {
      id: "choice-sign",
      mode: "choice",
      title: "Which sign is it?",
      instructions: "Which traffic sign is shown in `photo`? Each option is defined by an example picture.",
      none: true,
      query: yieldScene,
      refs: [
        { label: "stop", description: "", image: stop },
        { label: "yield", description: "", image: yieldSign },
        { label: "no_entry", description: "", image: noEntry },
        { label: "parking", description: "", image: parking },
      ],
    },
    {
      id: "find-sign",
      mode: "find",
      title: "Where is this sign?",
      instructions: "the traffic sign in `photo` that matches this picture: {reference}",
      query: busy,
      refs: [
        { label: "parking", description: "", image: parking },
        { label: "yield", description: "", image: yieldSign },
        { label: "no_entry", description: "", image: noEntry },
      ],
    },
    {
      id: "score-battery",
      mode: "score",
      title: "How charged is the battery?",
      instructions: "How charged is the battery shown in `photo`? Compare the number of filled bars with the example level pictures; ignore colour, size and rotation.",
      query: await jpeg(batteryQuery),
      refs: levels.map((image, n) => ({ label: `${n} of 4 bars`, description: "", image })),
    },
  ];
}
