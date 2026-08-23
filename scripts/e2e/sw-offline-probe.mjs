import { chromium } from "playwright-core";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const profile = mkdtempSync(join(tmpdir(), "ocade-sw-"));
const executablePath =
  process.env.OCADE_BROWSER_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/opt/pw-browsers/chromium",
  ].find(existsSync);
if (!executablePath) throw new Error("Set OCADE_BROWSER_PATH to a Chromium-family browser.");
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(3000);

const cacheState = await page.evaluate(async () => {
  const names = await caches.keys();
  const shell = names.filter((name) => name.startsWith("ocade-shell-v")).sort().at(-1);
  if (!shell) return { shell: null, keys: [] };
  const cache = await caches.open(shell);
  return {
    shell,
    keys: (await cache.keys()).map((r) => new URL(r.url).pathname).sort(),
  };
});

await ctx.setOffline(true);
const offlineFetches = await page.evaluate(async () => {
  const out = {};
  for (const path of ["/manifest.webmanifest", "/favicon.ico"]) {
    try {
      const r = await fetch(path);
      const text = await r.text();
      out[path] = {
        status: r.status,
        ct: r.headers.get("content-type"),
        starts: text.slice(0, 40),
      };
    } catch (e) {
      out[path] = { error: String(e).slice(0, 120) };
    }
  }
  const fallback = await caches.match("/offline.html");
  out["/offline.html (cache)"] = fallback
    ? {
        status: fallback.status,
        ct: fallback.headers.get("content-type"),
        starts: (await fallback.text()).slice(0, 40),
      }
    : { error: "missing from Cache Storage" };
  return out;
});
let offlineNavigation;
try {
  const response = await page.goto(`${BASE}/offline-probe`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  offlineNavigation = {
    status: response?.status() ?? null,
    title: await page.title(),
    body: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160),
  };
} catch (error) {
  offlineNavigation = { error: String(error).slice(0, 160) };
}
await ctx.setOffline(false);
const required = ["/", "/manifest.webmanifest", "/offline.html"];
const failures = [];
if (!cacheState.shell) failures.push("no versioned shell cache was installed");
for (const path of required) {
  if (!cacheState.keys.includes(path)) failures.push(`required cache entry missing: ${path}`);
}
for (const path of ["/manifest.webmanifest", "/favicon.ico", "/offline.html (cache)"]) {
  if (offlineFetches[path]?.status !== 200) {
    failures.push(`offline fetch failed: ${path} -> ${JSON.stringify(offlineFetches[path])}`);
  }
}
if (offlineNavigation.status !== 200 || !/OCADE/i.test(offlineNavigation.body ?? "")) {
  failures.push(`offline navigation failed: ${JSON.stringify(offlineNavigation)}`);
}
console.log(
  JSON.stringify(
    { executablePath, cacheState, offlineFetches, offlineNavigation, failures },
    null,
    2,
  ),
);
await ctx.close();
if (failures.length) process.exitCode = 1;
