#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const baseUrl = process.env.OCADE_E2E_BASE_URL ?? "http://127.0.0.1:4173";
const explicit = process.env.OCADE_CHROME_PATH;
const candidates = [
  explicit,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  chromium.executablePath(),
].filter(Boolean);
const executablePath = candidates.find((path) => existsSync(path));
if (!executablePath) {
  throw new Error("No Chromium/Chrome executable found. Set OCADE_CHROME_PATH for the real browser evidence run.");
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,UseSkiaRenderer",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const context = await browser.newContext({ serviceWorkers: "allow" });
context.setDefaultTimeout(240_000);

const pages = await Promise.all([0, 1, 2].map(() => context.newPage()));
const url = `${baseUrl.replace(/\/$/, "")}/demo/ocade`;

async function open(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#ocade-composer").waitFor({ state: "visible", timeout: 120_000 });
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });
}
await Promise.all(pages.map(open));

async function sendAndWait(page, label) {
  const composer = page.locator("#ocade-composer");
  await composer.waitFor({ state: "visible" });
  const before = await page.locator('article[aria-label="OCADE reply"]').count();
  await composer.fill(`Reply with exactly ${label} and no other words.`);
  await composer.press("Enter");
  await page.waitForFunction(
    ({ count, expected }) => {
      const replies = [...document.querySelectorAll('article[aria-label="OCADE reply"]')];
      if (replies.length <= count) return false;
      const latest = replies[replies.length - 1]?.textContent ?? "";
      return latest.includes(expected);
    },
    { count: before, expected: label },
    { timeout: 240_000 },
  );
}

// The first send elects the leader and creates the real model instance. The
// next two messages are sent from separate same-origin tabs and must relay.
await sendAndWait(pages[0], "OCADE_TAB_ONE_OK");
await sendAndWait(pages[1], "OCADE_TAB_TWO_OK");
await sendAndWait(pages[2], "OCADE_TAB_THREE_OK");

const tabDiagnostics = await Promise.all(
  pages.map((page) => page.evaluate(() => window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__ ?? null)),
);
const leaders = tabDiagnostics.filter((row) => row?.role === "leader");
const followers = tabDiagnostics.filter((row) => row?.role === "follower");
const modelInstances = tabDiagnostics.reduce((sum, row) => sum + (row?.modelInstances ?? 0), 0);
const localRequests = tabDiagnostics.reduce((sum, row) => sum + (row?.localRequests ?? 0), 0);
const relayedRequests = tabDiagnostics.reduce((sum, row) => sum + (row?.relayedRequests ?? 0), 0);

if (leaders.length !== 1) throw new Error(`Expected exactly one Web-Locks leader, observed ${leaders.length}.`);
if (followers.length !== 2) throw new Error(`Expected two follower tabs, observed ${followers.length}.`);
if (modelInstances !== 1) throw new Error(`Expected exactly one proven model instance, observed ${modelInstances}.`);
if (localRequests < 3) throw new Error(`Leader processed only ${localRequests} requests; expected at least three.`);
if (relayedRequests < 2) throw new Error(`Follower relay count was ${relayedRequests}; expected at least two.`);

// Close followers so the leader owns the only remaining page, then prove the
// *next visit* with the network disabled. The SW must deliver the app shell and
// the browser model/runtime must come from local persisted storage.
await pages[1].close();
await pages[2].close();
const page = pages[0];
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
await page.locator("#ocade-composer").waitFor({ state: "visible", timeout: 120_000 });
await sendAndWait(page, "OCADE_OFFLINE_SECOND_VISIT_OK");

const offlineDiagnostics = await page.evaluate(() => ({
  online: navigator.onLine,
  engine: window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__ ?? null,
  controlledByServiceWorker: Boolean(navigator.serviceWorker?.controller),
}));
if (offlineDiagnostics.online !== false) throw new Error("Browser context did not enter offline mode.");
if (!offlineDiagnostics.controlledByServiceWorker) throw new Error("Offline reload was not controlled by the OCADE service worker.");
if (offlineDiagnostics.engine?.modelInstances !== 1) throw new Error("Offline second visit did not run exactly one local model instance.");

const evidence = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  baseUrl,
  browserExecutable: executablePath,
  multiTab: {
    tabs: 3,
    leaders: leaders.length,
    followers: followers.length,
    modelInstances,
    localRequests,
    relayedRequests,
    diagnostics: tabDiagnostics,
    result: "PASS",
  },
  offlineSecondVisit: {
    networkDisabled: true,
    serviceWorkerControlled: offlineDiagnostics.controlledByServiceWorker,
    localModelInstances: offlineDiagnostics.engine?.modelInstances ?? null,
    responseMarker: "OCADE_OFFLINE_SECOND_VISIT_OK",
    result: "PASS",
  },
};

const out = process.env.OCADE_E2E_EVIDENCE_FILE ?? "release/OCADE_LOCAL_ONLY_BROWSER_EVIDENCE.json";
writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));

await browser.close();
