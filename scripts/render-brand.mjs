/**
 * Draws the MEKURI share image (src/app/opengraph-image.png) in the Playwright
 * Chromium: the name set in the app's type beside Nico's three-card icon.
 * Run scripts/export-icons.py first if the icon changed; it writes the
 * cut-out (docs/brand/mekuri_mark.png) this reads.
 *
 *   node scripts/render-brand.mjs
 *
 * Needs the network once, for the Google Fonts it sets them in.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Shippori+Mincho+B1:wght@500;600&display=block">`;
const INK = "#0f1218", BRASS = "#c2a46e", IVORY = "#ede6da", DIM = "#a39c90";

/** Nico's three cards, cut out of the icon by scripts/export-icons.py. */
const MARK = `data:image/png;base64,${readFileSync("docs/brand/mekuri_mark.png").toString("base64")}`;

function ogPage() {
  return `<!doctype html><html><head>${FONTS}<style>html,body{margin:0}</style></head><body>
  <div style="position:relative;width:1200px;height:630px;overflow:hidden;background:
    radial-gradient(38% 52% at 75% 50%, rgba(237,230,218,.07), transparent 70%),
    radial-gradient(140% 100% at 50% 40%, transparent 55%, rgba(0,0,0,.5)), ${INK};color:${IVORY}">
    <div style="position:absolute;inset:28px;border:1px solid rgba(237,230,218,.12);border-radius:4px"></div>
    <div style="position:absolute;left:104px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:26px">
      <h1 style="margin:0;font-family:'Cormorant Garamond';font-weight:500;font-size:104px;line-height:1;letter-spacing:.26em">MEKURI</h1>
      <div style="display:flex;align-items:center;gap:22px"><span style="width:52px;height:1px;background:${BRASS}"></span>
        <span style="font-family:'Shippori Mincho B1';font-weight:500;font-size:24px;letter-spacing:.5em;color:${IVORY}">めくり</span></div>
      <p style="margin:14px 0 0;font-family:'Shippori Mincho B1';font-weight:500;font-size:30px;letter-spacing:.12em;color:#d9d1c3">めくるたび、話がほどける。</p>
      <p style="margin:0;font-family:'Cormorant Garamond';font-style:italic;font-weight:500;font-size:22px;letter-spacing:.08em;color:${DIM}">talk cards for the table</p>
    </div>
    <img src="${MARK}" alt="" style="position:absolute;left:712px;top:132px;width:380px;filter:drop-shadow(0 28px 36px rgba(0,0,0,.55))">
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
