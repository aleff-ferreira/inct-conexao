const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:4173/";
const OUT = "screenshots/webinars";

const shots = [
  { name: "teaser", hash: "", selector: ".webinar-teaser-section", widths: [1280, 390] },
  { name: "speakers", hash: "#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia", selector: ".webinar-speaker-grid", widths: [1280] },
  { name: "stage-upcoming", hash: "#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia", selector: ".webinar-stage-section", widths: [1280, 390] },
  { name: "question", hash: "#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia", selector: ".webinar-question", widths: [1280, 390] },
];

(async () => {
  const browser = await chromium.launch();
  for (const s of shots) {
    for (const w of s.widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
      await page.goto(BASE + s.hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const el = await page.$(s.selector);
      if (el) await el.screenshot({ path: `${OUT}/clip-${s.name}-${w}.png` });
      else console.log("not found:", s.selector, "@", w);
      await page.close();
    }
  }
  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
