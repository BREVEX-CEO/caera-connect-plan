/**
 * CLEAN-MACHINE PROOF.
 *
 * A brand-new browser profile: no IndexedDB, no OPFS, no Cache Storage, no
 * service worker, no localStorage, no model. No Ollama on this machine, no
 * Python native host, no desktop companion.
 *
 * What is being proved:
 *  1. The site loads and renders.
 *  2. OCADE begins preparing itself with no Install/Setup button pressed.
 *  3. No request goes to a public AI inference provider at any point.
 */
import { chromium } from "playwright-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const INFERENCE_HOSTS = [
  "api.openai.com", "ai.gateway.lovable.dev", "generativelanguage.googleapis.com",
  "api.anthropic.com", "openrouter.ai", "api.groq.com", "api.mistral.ai",
  "api.cohere.ai", "api.together.xyz", "api.deepseek.com",
];

const profile = mkdtempSync(join(tmpdir(), "ocade-clean-"));
const browser = await chromium.launchPersistentContext(profile, {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-webgpu"],
});

const requests = [];
const consoleErrors = [];
browser.on("request", (r) => requests.push(r.url()));
browser.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

const page = await browser.newPage();
const results = {};

async function step(name, fn) {
  try { results[name] = await fn(); }
  catch (e) { results[name] = { error: String(e).slice(0, 300) }; }
}

await step("load_home", async () => {
  const res = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  return {
    status: res?.status(),
    title: await page.title(),
    bodyChars: (await page.evaluate(() => document.body.innerText || "")).length,
  };
});

await step("storage_state_after_first_visit", async () =>
  page.evaluate(async () => {
    const out = { serviceWorker: false, caches: [], indexedDb: [], opfs: [], persisted: null };
    try { out.serviceWorker = !!(await navigator.serviceWorker?.getRegistration()); } catch {}
    try { out.caches = await caches.keys(); } catch {}
    try { out.indexedDb = (await indexedDB.databases()).map((d) => d.name); } catch {}
    try {
      const root = await navigator.storage.getDirectory();
      for await (const [name] of root.entries()) out.opfs.push(name);
    } catch {}
    try { out.persisted = await navigator.storage.persisted(); } catch {}
    return out;
  }),
);

await step("webgpu_available_here", async () =>
  page.evaluate(async () => {
    if (!("gpu" in navigator)) return { gpu: false, reason: "navigator.gpu absent" };
    try {
      const a = await navigator.gpu.requestAdapter();
      return { gpu: true, adapter: !!a };
    } catch (e) { return { gpu: true, adapter: false, reason: String(e) }; }
  }),
);

await step("auth_route_renders", async () => {
  const res = await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText || "");
  return { status: res?.status(), chars: text.length, hasRawError: /\bat\s+\w+\s*\(/.test(text) };
});

await step("ocade_route_when_signed_out", async () => {
  const res = await page.goto(BASE + "/ocade", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText || "");
  return { status: res?.status(), url: page.url(), chars: text.length };
});

await step("offline_reload_uses_cached_shell", async () => {
  // Give the service worker a chance to install and claim.
  await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4000);
  const reg = await page.evaluate(async () => {
    try {
      const r = await navigator.serviceWorker?.ready;
      return !!r?.active;
    } catch { return false; }
  });
  await browser.setOffline(true);
  let offlineBody = "";
  let offlineOk = false;
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
    offlineBody = await page.evaluate(() => document.body.innerText || "");
    offlineOk = offlineBody.length > 0 && !/ERR_INTERNET_DISCONNECTED/i.test(offlineBody);
  } catch (e) {
    offlineBody = String(e).slice(0, 200);
  }
  await browser.setOffline(false);
  return { serviceWorkerActive: reg, offlineOk, offlineChars: offlineBody.length,
           sample: offlineBody.slice(0, 160) };
});

const leaks = requests.filter((u) => INFERENCE_HOSTS.some((h) => u.includes(h)));
const externalHosts = [...new Set(requests.map((u) => { try { return new URL(u).host; } catch { return u; } }))]
  .filter((h) => !h.startsWith("127.0.0.1") && !h.startsWith("localhost"));

const report = {
  base: BASE,
  totalRequests: requests.length,
  inferenceLeaks: leaks,
  externalHosts,
  consoleErrors: consoleErrors.slice(0, 20),
  results,
};
writeFileSync(process.env.OUT ?? "/tmp/clean-machine.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
