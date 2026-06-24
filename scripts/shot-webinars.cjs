const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:4173/";
const OUT = "screenshots/webinars";

const targets = [
  { name: "home", hash: "" },
  { name: "hub", hash: "#/webinars" },
  { name: "event-upcoming", hash: "#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia" },
  { name: "event-replay", hash: "#/webinars/mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia" },
  { name: "event-404", hash: "#/webinars/nao-existe" },
];

const widths = [320, 375, 390, 414, 428, 768, 1280];
const shotWidths = new Set([390, 1280]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const rows = [];

  for (const t of targets) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(BASE + t.hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(450);

      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        // find widest offender
        let worst = null;
        const els = document.querySelectorAll("body *");
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.right > winW + 1) {
            if (!worst || r.right > worst.right) {
              worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 40) };
            }
          }
        }
        return { docW, winW, overflow: docW - winW, worst };
      });

      rows.push({ target: t.name, w, ...overflow });

      if (shotWidths.has(w)) {
        await page.screenshot({ path: `${OUT}/${t.name}-${w}.png`, fullPage: true });
      }
      await page.close();
    }
  }

  await browser.close();

  console.log("\n=== Horizontal overflow check (overflow>1px is a problem) ===");
  for (const r of rows) {
    const flag = r.overflow > 1 ? "  <-- OVERFLOW" : "";
    const worst = r.worst ? `  worst: <${r.worst.tag}.${r.worst.cls}> right=${r.worst.right}` : "";
    console.log(`${r.target.padEnd(16)} ${String(r.w).padStart(4)}px  doc=${r.docW} win=${r.winW} diff=${r.overflow}${flag}${r.overflow > 1 ? worst : ""}`);
  }
  console.log("\ndone");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
