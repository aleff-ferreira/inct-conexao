const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:4173/";
const OUT = "screenshots/webinars";

const targets = [
  { name: "groups-hub", hash: "#/grupos" },
  { name: "group-page", hash: "#/grupos/conexao-clima-saude-unica" },
];
const widths = [320, 375, 390, 414, 428, 768, 1280];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const t of targets) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await page.goto(BASE + t.hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
      rows.push(`${t.name.padEnd(12)} ${String(w).padStart(4)}  diff=${o.doc - o.win}${o.doc - o.win > 1 ? "  <-- OVERFLOW" : ""}`);
      if (w === 390 || w === 1280) await page.screenshot({ path: `${OUT}/${t.name}-${w}.png`, fullPage: true });
      await page.close();
    }
  }
  // nav check
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  const navHasGrupos = await p.$$eval(".desktop-nav a", (els) => els.some((e) => /grupos/i.test(e.textContent || "")));
  await p.close();
  await browser.close();
  console.log(rows.join("\n"));
  console.log("nav has Grupos:", navHasGrupos);
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
