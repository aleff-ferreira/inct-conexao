const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:4173/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const img404 = [];
  page.on("response", (r) => {
    const u = r.url();
    if (/\.(jpg|jpeg|png|svg|webp)(\?|$)/i.test(u) && r.status() >= 400) img404.push(`${r.status()} ${u}`);
  });

  // Public event page (partners, speakers, replay file).
  await page.goto(BASE + "#/webinars/mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia", { waitUntil: "networkidle" });
  await wait(700);
  await page.screenshot({ path: "screenshots/cms-event-page.png", fullPage: true });

  // Public group page.
  await page.goto(BASE + "#/grupos/conexao-clima-saude-unica", { waitUntil: "networkidle" });
  await wait(500);
  await page.screenshot({ path: "screenshots/cms-group-page.png", fullPage: true });

  console.log("image 4xx/5xx during render:", img404.length ? img404 : "none");

  // Admin panel (Sveltia loads from unpkg CDN; may need internet).
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  try {
    await page.goto(BASE + "admin/", { waitUntil: "networkidle", timeout: 20000 });
    await wait(3500);
    await page.screenshot({ path: "screenshots/cms-admin.png" });
    const title = await page.title();
    const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 200);
    console.log("admin title:", title);
    console.log("admin body (first 200):", JSON.stringify(bodyText));
  } catch (e) {
    console.log("admin load error:", e.message);
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
