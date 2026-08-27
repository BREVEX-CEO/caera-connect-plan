/**
 * ONLINE → OFFLINE → ONLINE, in a real browser, against the running app.
 *
 * The transitions are driven by Chromium's own network emulation, so
 * `navigator.onLine` really flips and the `offline`/`online` events really
 * fire — the same signals the product listens to. Nothing here stubs the hook.
 *
 * WHAT IS ASSERTED. That the app notices; that a page loaded while offline
 * still renders rather than showing a browser error; that the parts which do
 * not need the network keep working; and that coming back online is noticed
 * too. What it does NOT assert is that a local model answers offline — no
 * weights can be downloaded in this sandbox, and claiming that from a UI state
 * would be exactly the kind of unearned claim this audit exists to remove.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
// Without authenticated storage, exercise the product's genuine no-account
// surface. Visiting /ocade in that case only measures the auth/configuration
// gate and used to misreport its concise, truthful failure page as an offline
// rendering defect because it contained fewer than 200 characters.
const START_ROUTE = STATE ? "/ocade" : "/demo/ocade";
const SETTINGS_ROUTE = STATE ? "/settings/appearance" : "/demo/settings";
const SURFACE = STATE ? "authenticated workspace" : "no-account demo";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();

async function clearModals() {
  for (let i = 0; i < 6; i += 1) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let b = 0; b < (await boxes.count()); b += 1) {
      await boxes
        .nth(b)
        .click({ timeout: 4000 })
        .catch(() => {});
    }
    const button = dialog.getByRole("button", {
      name: /^(accept and continue|skip|done|finish|got it|close)$/i,
    });
    if ((await button.count()) === 0) return;
    await button
      .first()
      .click({ timeout: 6000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
}

const onLine = () => page.evaluate(() => navigator.onLine);
/**
 * Transitions the page itself observed, so the assertion is the app's view.
 *
 * Recorded in sessionStorage rather than on `window`, and re-armed on every
 * navigation: a document-scoped array is wiped by the very page loads this
 * test performs, which made a transition that WAS observed look like one that
 * was missed.
 */
const WATCHER = () => {
  const push = (kind) => {
    const seen = JSON.parse(sessionStorage.getItem("__net") ?? "[]");
    seen.push(kind);
    sessionStorage.setItem("__net", JSON.stringify(seen));
  };
  if (!window.__netArmed) {
    window.__netArmed = true;
    window.addEventListener("online", () => push("online"));
    window.addEventListener("offline", () => push("offline"));
  }
};
async function watchEvents() {
  await page.addInitScript(WATCHER);
  await page.evaluate(WATCHER);
}
const seenEvents = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("__net") ?? "[]"));

try {
  await page.addInitScript(WATCHER);
  await page.goto(`${BASE}${START_ROUTE}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1800);
  await clearModals();
  await watchEvents();

  check("starts online", (await onLine()) === true);
  const onlineBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  check(
    `${SURFACE} rendered while online`,
    onlineBody.length > 200,
    `${onlineBody.length} characters: ${JSON.stringify(onlineBody.slice(0, 120))}`,
  );

  /* ------------------------------------------------------------ offline -- */
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  check("the page observes going offline", (await onLine()) === false);
  check(
    "an offline event reached the app",
    (await seenEvents()).includes("offline"),
    JSON.stringify(await seenEvents()),
  );

  const offlineText = (await page.evaluate(() => document.body.innerText)).length;
  check(
    `${SURFACE} still renders with the network down`,
    offlineText > 200,
    `${offlineText} characters`,
  );

  // A client-side route change must not need the network. Use the product's
  // real link; page.goto() would perform a document navigation and test only
  // the service worker's fallback rather than the warm app router.
  if (STATE) {
    await page
      .goto(`${BASE}${SETTINGS_ROUTE}`, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(() => {});
  } else {
    await page
      .getByRole("link", { name: "Settings" })
      .click({ timeout: 10000 })
      .catch(() => {});
  }
  await page.waitForTimeout(1200);
  await clearModals();
  const settingsBody = (await page.evaluate(() => document.body.innerText))
    .replace(/\s+/g, " ")
    .trim();
  check(
    "settings is reachable offline from a warm page",
    page.url().endsWith(SETTINGS_ROUTE) && settingsBody.length > 200,
    `${page.url()} — ${settingsBody.length} characters: ${JSON.stringify(settingsBody.slice(0, 120))}`,
  );

  // Local preferences must keep working with no network at all.
  const wrote = await page.evaluate(() => {
    try {
      localStorage.setItem("ocade.offline.probe", "kept");
      return localStorage.getItem("ocade.offline.probe");
    } catch {
      return null;
    }
  });
  check("local preferences still write and read offline", wrote === "kept", String(wrote));

  /* ------------------------------------------------------------- online -- */
  await context.setOffline(false);
  await page.waitForTimeout(1200);
  check("the page observes coming back online", (await onLine()) === true);
  check(
    "an online event reached the app",
    (await seenEvents()).includes("online"),
    JSON.stringify(await seenEvents()),
  );

  await page.goto(`${BASE}${START_ROUTE}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await clearModals();
  const backText = (await page.evaluate(() => document.body.innerText)).length;
  check(
    `${SURFACE} reloads cleanly once the network is back`,
    backText > 200,
    `${backText} characters`,
  );

  /* ------------------------------------------------------ offline again -- */
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  check("a second offline transition is observed too", (await onLine()) === false);
  const survived = await page.evaluate(() => localStorage.getItem("ocade.offline.probe"));
  check("what was stored offline survived the round trip", survived === "kept", String(survived));

  const order = await seenEvents();
  check(
    "the app saw the transitions in order",
    order.join(",") === "offline,online,offline",
    order.join(","),
  );
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} offline-transition checks passed`,
);
if (failed.length) process.exitCode = 1;
