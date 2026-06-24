const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:4173/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const assert = (n, c) => { results.push(!!c); console.log(`${c ? "OK " : "XX "} ${n}`); };
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("reqfail: " + r.url()));

  const go = async (hash, sel) => { await page.goto(BASE + hash, { waitUntil: "networkidle" }); await wait(400); return page.$(sel); };

  assert("home renders", await go("", ".hero"));
  assert("webinars hub renders", await go("#/webinars", ".webinar-hub-hero"));
  assert("event page renders", await go("#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia", ".webinar-stage"));
  assert("groups hub renders", await go("#/grupos", ".webinar-card"));
  assert("group page renders", await go("#/grupos/conexao-clima-saude-unica", ".webinar-event-hero"));

  // /#/admin no longer exists -> should land on home, not a broken admin page
  await page.goto(BASE + "#/admin", { waitUntil: "networkidle" });
  await wait(400);
  assert("/#/admin harmlessly shows home (no admin UI)", (await page.$(".hero")) && !(await page.$(".admin-shell")) && !(await page.$(".admin-login")));

  // no operator link in footer
  await page.goto(BASE, { waitUntil: "networkidle" });
  await wait(300);
  assert("footer has NO operator-access link", !(await page.$(".footer-operator-link")));

  // no network calls to any supabase/external backend
  const externalCalls = errors.filter((e) => /supabase|rest\/v1|auth\/v1/.test(e));
  assert("no backend/supabase calls", externalCalls.length === 0);
  assert("no console/page/network errors", errors.length === 0);
  if (errors.length) console.log("  errors:", errors.slice(0, 6));

  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
