/**
 * Draws the MEKURI icons, favicon and share image from the same type and
 * colours as the app, in the Playwright Chromium, and writes them into place.
 *
 *   node scripts/render-brand.mjs
 *
 * Needs the network once, for the Google Fonts it sets them in.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Shippori+Mincho+B1:wght@500;600&display=block">`;
const INK = "#0f1218", BRASS = "#c2a46e", IVORY = "#ede6da", DIM = "#a39c90";

// The mark: two cards, the back one a faint outline, the front one with an M.
function mark(size, { stroke = 1.25, faint = 0.4 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="24" y="16" width="42" height="60" rx="5" stroke="${BRASS}" stroke-opacity="${faint}" stroke-width="${stroke}" transform="rotate(-9 45 46)"/>
  <rect x="30" y="20" width="42" height="60" rx="5" fill="${INK}" stroke="${BRASS}" stroke-width="${stroke}" transform="rotate(5 51 50)"/>
  <text x="51" y="59" text-anchor="middle" transform="rotate(5 51 50)" font-family="Cormorant Garamond" font-size="27" font-weight="500" fill="${BRASS}">M</text>
</svg>`;
}

function iconPage(px, { radius = 0, scale = 0.86, stroke, faint, letterOnly = false, bg = INK } = {}) {
  const inner = letterOnly
    ? `<span style="font-family:'Cormorant Garamond';font-weight:600;font-size:${px * 0.86}px;line-height:1;color:${BRASS};transform:translateY(-4%)">M</span>`
    : mark(Math.round(px * scale), { stroke, faint });
  return `<!doctype html><html><head>${FONTS}<style>html,body{margin:0;background:transparent}
  .i{width:${px}px;height:${px}px;display:grid;place-items:center;background:${bg};border-radius:${radius}px;overflow:hidden;
  background-image:radial-gradient(70% 60% at 50% 30%, rgba(237,230,218,.07), transparent 70%)}</style></head>
  <body><div class="i">${inner}</div></body></html>`;
}

function ogPage() {
  const back = (from, to, rot, x, y, z, label = "") => `<div style="position:absolute;left:${x}px;top:${y}px;width:176px;height:246px;border-radius:14px;transform:rotate(${rot}deg);z-index:${z};
    background:radial-gradient(130% 90% at 28% 12%, rgba(255,248,235,.07), transparent 60%), linear-gradient(160deg, ${from}, ${to});box-shadow:0 30px 50px -24px rgba(0,0,0,.95);">
    <div style="position:absolute;inset:10px;border:1px solid rgba(194,164,110,.55);border-radius:9px"></div>
    <div style="position:absolute;inset:14px;border:1px solid rgba(194,164,110,.2);border-radius:7px"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
      <span style="font-family:'Cormorant Garamond';font-weight:500;font-size:46px;line-height:1;color:${BRASS}">M</span>
      ${label ? `<span style="font-family:'Shippori Mincho B1';font-weight:500;font-size:14px;letter-spacing:.3em;padding-left:.3em;color:#f1e3bc">${label}</span>` : ""}
    </div></div>`;
  const front = `<div style="position:absolute;left:800px;top:150px;width:224px;height:314px;border-radius:16px;background:#f2ece2;padding:9px;box-sizing:border-box;transform:rotate(4deg);z-index:3;box-shadow:0 34px 60px -24px rgba(0,0,0,.95)">
    <div style="height:100%;box-sizing:border-box;border:1px solid rgba(168,132,74,.45);border-radius:9px;padding:14px 16px 14px;display:flex;flex-direction:column;justify-content:space-between;color:#7a5f2e">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-family:'Cormorant Garamond';font-style:italic;font-weight:500;font-size:17px">No. 7</span><span style="font-family:'Shippori Mincho B1';font-size:10px;letter-spacing:.3em">雑談</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px"><p style="margin:0;text-align:center;font-family:'Shippori Mincho B1';font-weight:600;font-size:19px;line-height:1.6;color:#1e2230">最近の<br>「小さな幸せ」は？</p><span style="width:26px;height:1px;background:#a8844a"></span></div>
      <span style="text-align:center;font-family:'Cormorant Garamond';font-weight:500;font-size:14px">M</span>
    </div></div>`;
  return `<!doctype html><html><head>${FONTS}<style>html,body{margin:0}</style></head><body>
  <div style="position:relative;width:1200px;height:630px;overflow:hidden;background:
    radial-gradient(60% 70% at 72% 45%, rgba(237,230,218,.06), transparent 70%),
    radial-gradient(140% 100% at 50% 40%, transparent 55%, rgba(0,0,0,.5)), ${INK};color:${IVORY}">
    <div style="position:absolute;inset:28px;border:1px solid rgba(237,230,218,.12);border-radius:4px"></div>
    <div style="position:absolute;left:104px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:26px">
      <h1 style="margin:0;font-family:'Cormorant Garamond';font-weight:500;font-size:104px;line-height:1;letter-spacing:.26em">MEKURI</h1>
      <div style="display:flex;align-items:center;gap:22px"><span style="width:52px;height:1px;background:${BRASS}"></span>
        <span style="font-family:'Shippori Mincho B1';font-weight:500;font-size:24px;letter-spacing:.5em;color:${IVORY}">めくり</span></div>
      <p style="margin:14px 0 0;font-family:'Shippori Mincho B1';font-weight:500;font-size:30px;letter-spacing:.12em;color:#d9d1c3">めくるたび、話がほどける。</p>
      <p style="margin:0;font-family:'Cormorant Garamond';font-style:italic;font-weight:500;font-size:22px;letter-spacing:.08em;color:${DIM}">talk cards for the table</p>
    </div>
    ${back("#665023", "#463619", -14, 700, 178, 1)}
    ${back("#2f4d44", "#1f342d", 16, 948, 196, 2)}
    ${front}
  </div></body></html>`;
}

/** An .ico holding PNG images (every browser since IE Vista reads them). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const o = 6 + i * 16;
    header.writeUInt8(size % 256, o);
    header.writeUInt8(size % 256, o + 1);
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(data.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}

const browser = await chromium.launch();
async function shot(html, w, h, transparent = true) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  return png;
}

// Home-screen icons: opaque and square (the phone rounds them).
writeFileSync("public/icons/icon-512.png", await shot(iconPage(512), 512, 512, false));
writeFileSync("public/icons/icon-192.png", await shot(iconPage(192), 192, 192, false));
writeFileSync("src/app/apple-icon.png", await shot(iconPage(180), 180, 180, false));
// Maskable: the mark well inside the 80% safe circle.
writeFileSync("public/icons/icon-maskable-512.png", await shot(iconPage(512, { scale: 0.62 }), 512, 512, false));
// Browser tabs: a rounded tile, so it reads on light and dark tab bars. At 16
// and 32px the two cards blur together, so those carry the M alone.
writeFileSync("src/app/icon.png", await shot(iconPage(256, { radius: 56, scale: 0.9 }), 256, 256));
writeFileSync(
  "src/app/favicon.ico",
  ico([
    { size: 16, data: await shot(iconPage(16, { radius: 3, letterOnly: true }), 16, 16) },
    { size: 32, data: await shot(iconPage(32, { radius: 7, letterOnly: true }), 32, 32) },
    { size: 48, data: await shot(iconPage(48, { radius: 10, scale: 0.98, stroke: 3, faint: 0.5 }), 48, 48) },
  ]),
);
writeFileSync("src/app/opengraph-image.png", await shot(ogPage(), 1200, 630, false));
await browser.close();
