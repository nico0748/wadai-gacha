/**
 * Draws the MEKURI share image (src/app/opengraph-image.png) from the same
 * type and colours as the app, in the Playwright Chromium. The icons and
 * favicon come from Nico's icon instead: scripts/export-icons.py.
 *
 *   node scripts/render-brand.mjs
 *
 * Needs the network once, for the Google Fonts it sets them in.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Shippori+Mincho+B1:wght@500;600&display=block">`;
const INK = "#0f1218", BRASS = "#c2a46e", IVORY = "#ede6da", DIM = "#a39c90";

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

const browser = await chromium.launch();
async function shot(html, w, h, transparent = true) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  return png;
}

writeFileSync("src/app/opengraph-image.png", await shot(ogPage(), 1200, 630, false));
await browser.close();
