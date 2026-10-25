/**
 * The shell, proved in a real browser rather than in a render test.
 *
 * WHAT THIS ANSWERS THAT A UNIT TEST CANNOT. Whether the routes actually
 * resolve in a browser, whether the sidebar is present at desktop width and
 * gone at phone width, whether pressing Send while signed out reaches
 * authentication, and whether the retired destinations are genuinely
 * unreachable rather than merely unlinked.
 *
 * Usage:
 *   node scripts/e2e/shell-journey.mjs [--base=http://127.0.0.1:8788] [--json]
 *
 * Requires a served production build. It reports every check and exits non-zero
 * on the first real failure, so a partial pass cannot read as a pass.
 */
import { chromium } from "playwright-core";

const baseArgument = process.argv.find((argument) => argument.startsWith("--base="));
const BASE = baseArgument ? baseArgument.slice("--base=".length) : "http://127.0.0.1:8788";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? "PASS" : "FAIL";
  process.stdout.write(`${mark}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();

  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  check(
    "chat is the home page",
    (await page.locator("h1", { hasText: "Ask OCADE" }).count()) === 1,
  );
  check("the composer is present", (await page.locator("#ocade-composer").count()) === 1);

  /*
   * THE DOCUMENT THAT RUNS INFERENCE IS THE ONE THAT HAS TO BE ISOLATED.
   *
   * This journey used to celebrate `/ocade` returning 404 — and `/ocade` was
   * the only path the isolation headers were ever applied to. Chat is `/`, so
   * the real engine ran on a document with no `SharedArrayBuffer`, on one
   * thread, and every check here passed.
   *
   * `crossOriginIsolated` is the platform's own answer, not a header read back,
   * which is the only thing worth asserting: a browser that ignores
   * `credentialless` would still send the headers and still have no threads.
   */
  check(
    "the chat document is cross-origin isolated, so the engine can use several cores",
    (await page.evaluate(() => globalThis.crossOriginIsolated === true)) === true,
  );
  check(
    "and it really has SharedArrayBuffer",
    (await page.evaluate(() => typeof SharedArrayBuffer === "function")) === true,
  );
  for (const label of ["Chat", "Library", "New chat"]) {
    check(
      `the sidebar offers ${label}`,
      (await page.locator(`nav[aria-label="Primary"] >> text=${label}`).count()) >= 1,
    );
  }
  check(
    "the intelligence selector shows only Auto, Online and Offline",
    (
      await page.locator('[role="group"][aria-label="Intelligence mode"] button').allTextContents()
    ).join("|") === "Auto|Online|Offline",
  );
  check(
    "no provider or runtime identifier is on screen",
    !/qwen|gguf|webgpu|wasm|gemini|wllama/i.test(await page.locator("body").innerText()),
  );

  // Signed out, Send must reach authentication and keep the message.
  await page.fill("#ocade-composer", "a message written before signing in");
  await page.click('button[aria-label="Send"]');
  await page.waitForURL(/\/auth/, { timeout: 10_000 });
  check("send while signed out reaches authentication", page.url().includes("/auth"));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "the pending message is kept, not discarded",
    (await page.inputValue("#ocade-composer")).length > 0,
  );

  for (const path of ["/about", "/help", "/terms", "/privacy", "/pricing"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(`${path} renders`, response?.status() === 200);
  }

  for (const path of ["/ocade", "/settings", "/projects", "/search"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(`${path} is gone`, response?.status() === 404, `status ${response?.status()}`);
  }

  /*
   * SIGN-IN IS ON THE OTHER SIDE OF THE BOUNDARY, AND STAYS THERE.
   *
   * COOP `same-origin` severs `window.opener`, so the one document that must
   * never be isolated is the one the auth SDK could open a popup from. Reaching
   * it from Chat is a client-side transition, which cannot change isolation —
   * the root route turns it into a real navigation, and this is what proves it.
   */
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await page.waitForURL(/\/auth/, { timeout: 15_000 });
  check(
    "reaching sign-in from chat leaves the isolated document behind",
    (await page.evaluate(() => globalThis.crossOriginIsolated === true)) === false,
  );

  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const small = await phone.newPage();
  small.on("pageerror", (error) => consoleErrors.push(`phone: ${String(error)}`));
  await small.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "the sidebar is a drawer on a phone",
    (await small.locator('button[aria-label="Open navigation"]').count()) === 1,
  );
  await small.click('button[aria-label="Open navigation"]');
  check(
    "the drawer opens",
    (await small.locator('button[aria-label="Close navigation"]').count()) === 1,
  );
  check(
    "the page does not scroll sideways on a phone",
    await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  /*
   * THE ENGINE SURVIVES A DEPLOY. A runtime-fetched asset (the offline engine's
   * `.wasm` above all) must land in the cache a new worker version keeps, not
   * in the versioned shell cache its activation deletes.
   */
  const assets = await small.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const asset = [...performance.getEntriesByType("resource")]
      .map((entry) => new URL(entry.name).pathname)
      .find((path) => path.startsWith("/assets/") && path.endsWith(".js"));
    if (!asset) return { asset: null, kept: false };
    // Once more through the now-controlling worker, which is what keeps it. Under load the
    // worker can be active a moment before it controls this page: a fetch then bypasses it.
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await fetch(asset);
    const cache = await caches.open("ocade-assets");
    for (let i = 0; i < 50 && !(await cache.match(asset)); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { asset, kept: Boolean(await cache.match(asset)) };
  });
  check(
    "a runtime asset is kept where a new app version will not delete it",
    assets.asset !== null && assets.kept,
    JSON.stringify(assets),
  );

  /*
   * OFFLINE, NO PAGE PRETENDS TO BE ANOTHER. A page never seen on this device
   * gets the offline page; Chat, seen before, opens as Chat.
   */
  await small.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  });
  await phone.setOffline(true);
  await small.goto(`${BASE}/terms`).catch(() => {});
  check(
    "offline, a page never opened here shows the offline page, not Chat",
    (await small.title()) === "OCADE Local Mode" &&
      (await small.getByRole("link", { name: "Open OCADE Chat" }).getAttribute("href")) === "/",
    await small.title(),
  );
  await small.goto(`${BASE}/?new=true`).catch(() => {});
  check(
    "and Chat, opened here before, still opens offline",
    await small
      .locator("#ocade-composer")
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
    `${await small.title()} | ${(
      await small
        .locator("body")
        .innerText()
        .catch(() => "")
    ).slice(0, 160)}`,
  );
  await phone.setOffline(false);

  // Reconnected, the offline page reloads itself into the page that was asked for.
  await phone.setOffline(true);
  await small.goto(`${BASE}/terms`).catch(() => {});
  await phone.setOffline(false);
  check(
    "reconnected, the offline page becomes the page asked for",
    await small
      .waitForFunction(() => document.title.startsWith("Terms"), null, { timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
    await small.title(),
  );

  check("no uncaught page errors", consoleErrors.length === 0, consoleErrors.join("; "));
} finally {
  await browser.close();
}

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ base: BASE, failures, results }, null, 2)}\n`);
}
process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
