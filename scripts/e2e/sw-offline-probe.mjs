import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const profile = mkdtempSync(join(tmpdir(), "ocade-sw-"));
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(3000);

const cachedKeys = await page.evaluate(async () => {
  const cache = await caches.open("ocade-shell-v7");
  return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
});

await ctx.setOffline(true);
const offlineFetches = await page.evaluate(async () => {
  const out = {};
  for (const path of ["/manifest.webmanifest", "/favicon.ico", "/offline.html"]) {
    try {
      const r = await fetch(path);
      const text = await r.text();
      out[path] = { status: r.status, ct: r.headers.get("content-type"), starts: text.slice(0, 40) };
    } catch (e) { out[path] = { error: String(e).slice(0, 120) }; }
  }
  return out;
});
await ctx.setOffline(false);
console.log(JSON.stringify({ cachedKeys, offlineFetches }, null, 2));
await ctx.close();
