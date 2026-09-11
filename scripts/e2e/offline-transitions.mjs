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
/*
 * Without authenticated storage, exercise the product's genuine PUBLIC
 * surface. Visiting /ocade in that case only measures the auth gate and used to
 * misreport its concise, truthful failure page as an offline rendering defect
 * because it contained fewer than 200 characters.
 *
 * These pointed at `/demo/ocade` and `/demo/settings` until the demo was
 * removed. That did not fail the way a broken target usually does: the routes
 * 404, the 404 page renders perfectly well offline, and eleven of the twelve
 * checks went on passing against it. The audit was measuring OCADE's
 * not-found page and reporting it as the product working offline — which is
 * the exact shape of unearned proof this file's header warns about.
 */
const START_ROUTE = STATE ? "/ocade" : "/";
/*
 * The second page this journey routes to without a network.
 *
 * Signed in, it is the notification history — reached by pressing the bell,
 * which is a real in-app link a person actually uses. It used to be
 * `/settings/appearance`, reached by pressing the bell first to get somewhere
 * that showed the settings rail; the bell then pointed at the activity log,
 * because there was no notification history to point at yet. There is now, and
 * one click is a better test of the warm router than two.
 */
/*
 * THE SECOND PAGE THIS WALKS TO WHILE OFFLINE.
 *
 * It was `/ocade/notifications`, reached by clicking the bell. `PLAN.md` §4
 * folded the notification history into Tasks — "notifications into Tasks.
 * Preferences remain in Settings, which is a choice." — so the bell points at
 * `/ocade/tasks` and the old href is not in the document to click. The check
 * is about the app router working with the network down, not about which
 * screen it lands on, so it follows the link that now exists.
 */
const SETTINGS_ROUTE = STATE ? "/ocade/tasks" : "/pricing";
const SURFACE = STATE ? "authenticated workspace" : "public site";

/**
 * The two public pages the signed-out walk warms, and the order matters.
 *
 * Signed out there is no shell to return to: the root sends a RETURNING
 * visitor to Sign in, so `goBack()` landed on `/auth` and the offline click
 * found no link at all. The walk warms a pair instead, and the pair is chosen
 * because the second genuinely links to the first — the public header on
 * `/about` carries "Contact", which is `/support`. A crossing whose link does
 * not exist reports an unreachable page when nothing was ever clicked.
 */
const WARM_TARGET = "/support";
const WARM_ORIGIN = "/about";

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
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
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
    if ((await button.count()) === 0) {
      await page.waitForTimeout(500);
      continue;
    }
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
/*
 * A DOCUMENT THAT FAILED TO LOAD HAS NO READABLE STORAGE.
 *
 * `chrome-error://chromewebdata/` is an opaque origin, so reading
 * `sessionStorage` there throws `SecurityError` — which killed this run with an
 * uncaught exception AFTER a check had already failed, hiding the rest of the
 * journey behind a stack trace about storage. The failure is worth reporting;
 * the crash is not.
 */
const seenEvents = () =>
  page
    .evaluate(() => {
      try {
        return JSON.parse(sessionStorage.getItem("__net") ?? "[]");
      } catch {
        return [];
      }
    })
    .catch(() => []);

try {
  await page.addInitScript(WATCHER);
  await page.goto(`${BASE}${START_ROUTE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
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

  /*
   * VISIT THE SECOND PAGE WHILE THE NETWORK IS STILL THERE.
   *
   * Its route chunk is content-hashed and lazily loaded, so the service worker
   * holds it only after it has been fetched once — which is exactly the state a
   * person is in before their connection drops. Coming back here offline then
   * tests the runtime cache rather than testing whether a page nobody has
   * opened was precached.
   */
  if (STATE) {
    await page
      .locator(`a[href="${SETTINGS_ROUTE}"]`)
      .first()
      .click({ timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1800);
    await clearModals();
    check(
      `${SETTINGS_ROUTE} loads online first, so the offline visit is a warm one`,
      new URL(page.url()).pathname === SETTINGS_ROUTE,
      page.url(),
    );
  }
  /*
   * NO `goBack()` HERE, AND THE REASON IS A PRODUCT RULE.
   *
   * `PLAN.md`: a returning, previously-seen, signed-out visitor at the root
   * goes to Sign in. So going back landed on `/auth`, which carries no link to
   * `/pricing`, the offline click hit nothing, and the check reported the page
   * as unreachable when it had never been asked for. The signed-out walk stays
   * on the public pages instead: warm a second one, and cross between them
   * offline.
   */
  if (!STATE) {
    /*
     * Warmed by navigating, not by clicking: warming only has to FETCH the
     * route's chunk, and the offline crossing below is the part that must go
     * through the app router.
     */
    for (const route of [WARM_TARGET, WARM_ORIGIN]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      await clearModals();
      check(
        `${route} loads online first, so the offline visit is a warm one`,
        new URL(page.url()).pathname === route,
        page.url(),
      );
    }
  } else {
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    await clearModals();
  }
  await watchEvents();

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

  /*
   * A CLIENT-SIDE ROUTE CHANGE MUST NOT NEED THE NETWORK — for a route this
   * browser has already loaded. Use the product's real link; `page.goto()`
   * would perform a document navigation and test the service worker's fallback
   * rather than the warm app router.
   *
   * WARM IS THE WHOLE CLAIM, and signed out this check was making a different
   * one. Route chunks are content-hashed and lazily loaded, so the worker
   * caches one only after it has been fetched once; a public page the visitor
   * has NEVER opened cannot be there, and the navigation failed to
   * `chrome-error://chromewebdata/` — reported as "offline navigation is
   * broken" when what it had found was "a page nobody has visited is not in the
   * cache". Precaching every public route to satisfy it would make every first
   * visit pay for pages most people never open.
   *
   * So the second page is visited ONLINE first, which is what a person does
   * before losing their connection, and the offline navigation then proves the
   * thing worth proving: a route this browser has seen is served from the cache
   * with no network at all. The signed-in path was already warm — the rail's
   * destinations load with the shell — and behaves identically.
   */
  const crossingTo = STATE ? SETTINGS_ROUTE : WARM_TARGET;
  await page
    .locator(`a[href="${crossingTo}"]`)
    .first()
    .click({ timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await clearModals();
  const settingsBody = (await page.evaluate(() => document.body.innerText))
    .replace(/\s+/g, " ")
    .trim();
  check(
    "a second page is reachable offline from a warm one, through the app router",
    new URL(page.url()).pathname === crossingTo && settingsBody.length > 200,
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

  await page.goto(`${BASE}${START_ROUTE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
