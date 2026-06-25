const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  // scroll to the partner wall
  await p.evaluate(() => {
    const img = [...document.images].find((i) => /partner-logos/.test(i.src));
    if (img) img.scrollIntoView({ block: "start" });
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "screenshots/logos-wall.png" });
  // also the funders/featured area
  await p.evaluate(() => {
    const img = [...document.images].find((i) => /funding-logos/.test(i.src));
    if (img) img.scrollIntoView({ block: "center" });
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "screenshots/logos-funders.png" });
  await b.close();
  console.log("shots saved");
})().catch((e) => { console.error(e); process.exit(1); });
