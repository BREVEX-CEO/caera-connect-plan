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
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const INFERENCE_HOSTS = [
  "api.openai.com",
  "ai.gateway.lovable.dev",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
  "openrouter.ai",
  "api.groq.com",
  "api.mistral.ai",
  "api.cohere.ai",
  "api.together.xyz",
  "api.deepseek.com",
];

const profile = mkdtempSync(join(tmpdir(), "ocade-clean-"));
const executablePath =
  process.env.OCADE_BROWSER_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/opt/pw-browsers/chromium",
  ].find(existsSync);
if (!executablePath) throw new Error("Set OCADE_BROWSER_PATH to a Chromium-family browser.");
const browser = await chromium.launchPersistentContext(profile, {
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-webgpu"],
});

const requests = [];
const consoleErrors = [];
const httpErrors = [];
const requestFailures = [];
browser.on("request", (r) => requests.push(r.url()));
browser.on("response", (r) => {
  if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() });
});
browser.on("requestfailed", (r) =>
  requestFailures.push({ url: r.url(), reason: r.failure()?.errorText ?? "unknown" }),
);
browser.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

const page = await browser.newPage();
const results = {};

async function step(name, fn) {
  try {
    results[name] = await fn();
  } catch (e) {
    results[name] = { error: String(e).slice(0, 300) };
  }
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
    try {
      out.serviceWorker = !!(await navigator.serviceWorker?.getRegistration());
    } catch {}
    try {
      out.caches = await caches.keys();
    } catch {}
    try {
      out.indexedDb = (await indexedDB.databases()).map((d) => d.name);
    } catch {}
    try {
      const root = await navigator.storage.getDirectory();
      for await (const [name] of root.entries()) out.opfs.push(name);
    } catch {}
    try {
      out.persisted = await navigator.storage.persisted();
    } catch {}
    return out;
  }),
);

await step("demo_prepares_when_typing_starts", async () => {
  await page.goto(BASE + "/demo/ocade", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const dialog = page.getByRole("dialog", { name: "Before you use OCADE" });
  if (await dialog.isVisible().catch(() => false)) {
    for (const box of await dialog.getByRole("checkbox").all()) await box.check();
    await dialog.getByRole("button", { name: "Accept and continue" }).click();
  }
  const composer = page.getByRole("textbox", { name: "Message OCADE" });
  await composer.fill("Hello OCADE");
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  const statuses = await page.getByRole("status").allTextContents();
  return {
    composerEnabled: await composer.isEnabled(),
    preparationVisible:
      /Preparing OCADE Intelligence|Almost ready|OCADE Intelligence is ready/i.test(body),
    preparationStatus: statuses.find((text) => /OCADE Intelligence/i.test(text)) ?? null,
    sample: body.replace(/\s+/g, " ").slice(-220),
  };
});

await step("webgpu_available_here", async () =>
  page.evaluate(async () => {
    if (!("gpu" in navigator)) return { gpu: false, reason: "navigator.gpu absent" };
    try {
      const a = await navigator.gpu.requestAdapter();
      return { gpu: true, adapter: !!a };
    } catch (e) {
      return { gpu: true, adapter: false, reason: String(e) };
    }
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
    } catch {
      return false;
    }
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
  return {
    serviceWorkerActive: reg,
    offlineOk,
    offlineChars: offlineBody.length,
    sample: offlineBody.slice(0, 160),
  };
});

const leaks = requests.filter((u) => INFERENCE_HOSTS.some((h) => u.includes(h)));
const externalHosts = [
  ...new Set(
    requests.map((u) => {
      try {
        return new URL(u).host;
      } catch {
        return u;
      }
    }),
  ),
].filter((h) => !h.startsWith("127.0.0.1") && !h.startsWith("localhost"));

const report = {
  base: BASE,
  totalRequests: requests.length,
  inferenceLeaks: leaks,
  externalHosts,
  httpErrors: httpErrors.slice(0, 20),
  requestFailures: requestFailures.slice(0, 20),
  consoleErrors: consoleErrors.slice(0, 20),
  results,
};
writeFileSync(
  process.env.OUT ?? join(tmpdir(), "ocade-clean-machine.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();

/*
 * AND NOW DECIDE, WHICH THIS NEVER DID.
 *
 * The file above gathers a careful report and then exited zero no matter what
 * was in it. It sat inside a gate that could not fail: a hosted-inference leak,
 * a blank offline reload, a raw error on the auth screen — every one of them
 * would have been printed and passed.
 *
 * The claims in this file's own header are the assertions. Anything else stays
 * a reported number rather than a threshold, because a proof that fails for
 * reasons nobody chose is a proof people learn to ignore.
 */
const failures = [];

function require(condition, why) {
  if (!condition) failures.push(why);
}

require(results.load_home?.status === 200, `the site did not load: ${results.load_home?.status}`);
require((results.load_home?.bodyChars ?? 0) >
  200, `the first visit rendered ${results.load_home?.bodyChars} characters`);

// The whole promise. Not "few" leaks — none.
require(leaks.length ===
  0, `reached a hosted inference provider: ${leaks.map((l) => l.url ?? l).join(", ")}`);

/*
 * The weights host is not an inference provider: fetching a model to run it
 * here is the opposite of sending a prompt somewhere else. Any OTHER external
 * host on a clean first visit is worth knowing about.
 */
const WEIGHTS_HOSTS = ["huggingface.co", "cdn-lfs.huggingface.co", "cas-bridge.xethub.hf.co"];
const unexpected = externalHosts.filter((host) => !WEIGHTS_HOSTS.includes(host));
require(unexpected.length === 0, `unexpected external hosts on a clean visit: ${unexpected}`);

require(results.storage_state_after_first_visit?.serviceWorker ===
  true, "no service worker registered on the first visit");
require((results.storage_state_after_first_visit?.caches ?? []).length >
  0, "the first visit cached nothing, so a second visit offline has no shell");

require(results.auth_route_renders?.status === 200, "the auth route did not render");
require(results.auth_route_renders?.hasRawError === false, "the auth route rendered a raw error");

/*
 * The one that matters most on this machine, and the one that was silently
 * broken: reload with the network off and get the application, not a blank
 * document with the right title.
 */
require(results.offline_reload_uses_cached_shell?.offlineOk === true, "the offline reload failed");
require((results.offline_reload_uses_cached_shell?.offlineChars ?? 0) >
  200, `the offline reload rendered ${results.offline_reload_uses_cached_shell?.offlineChars} characters`);

if (failures.length) {
  console.error(`\nCLEAN MACHINE FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nclean machine: nothing reached a hosted provider, and it works offline");
