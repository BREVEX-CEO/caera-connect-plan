import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
let phase = "start";
const events = [];
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-mf-")), {
  executablePath: "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"],
});
ctx.on("console", (m) => { if (m.type() === "error") events.push({ phase, text: m.text() }); });
ctx.on("requestfailed", (r) => {
  if (r.url().includes("manifest")) events.push({ phase, failed: r.url(), why: r.failure()?.errorText });
});
ctx.on("response", async (r) => {
  if (!r.url().includes("manifest")) return;
  events.push({ phase, url: r.url(), status: r.status(), ct: r.headers()["content-type"], fromSW: r.fromServiceWorker?.() });
});
const page = await ctx.newPage();

phase = "1-first-online";
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(2500);

phase = "2-nav-auth";
await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

phase = "3-nav-ocade";
await page.goto(BASE + "/ocade", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

phase = "4-back-home";
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);

phase = "5-offline";
await ctx.setOffline(true);
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);
await ctx.setOffline(false);
console.log(JSON.stringify(events, null, 2));
await ctx.close();
