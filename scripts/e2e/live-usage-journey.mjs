/** Live Supabase and production UI proof. Requires an isolated, confirmed Free test account.
 * No RPC mocks. Only the second generation's transport is deliberately aborted.
 * Usage: set OCADE_PROOF_EMAIL, OCADE_PROOF_PASSWORD, SUPABASE_URL,
 * SUPABASE_PUBLISHABLE_KEY, PLAYWRIGHT_CHROMIUM; run this file from the repository root.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const required = (name) => {
  assert(process.env[name], `${name} is required; live proof cannot be skipped`);
  return process.env[name];
};
const base = process.env.OCADE_PROOF_BASE ?? "https://ocade.in";
const url = required("SUPABASE_URL");
assert(!/localhost|127\.0\.0\.1/.test(url), "A Supabase stub cannot prove live permissions");
const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: required("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
  body: JSON.stringify({
    email: required("OCADE_PROOF_EMAIL"),
    password: required("OCADE_PROOF_PASSWORD"),
  }),
});
assert.equal(response.status, 200, "Real Supabase password authentication failed");
const session = await response.json();
assert(session.access_token && session.user?.id, "Supabase returned no authenticated session");
const browser = await chromium.launch({ executablePath: required("PLAYWRIGHT_CHROMIUM") });
const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const failures = [];
const network = [];
async function installedLease(page) {
  await page.waitForFunction(
    async () => {
      if (!(await indexedDB.databases()).some((db) => db.name === "ocade-offline-usage"))
        return false;
      return new Promise((resolve) => {
        const open = indexedDB.open("ocade-offline-usage");
        open.onsuccess = () => {
          const db = open.result;
          const read = db.transaction("leases").objectStore("leases").getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result.length > 0);
          };
          read.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        open.onerror = () => resolve(false);
      });
    },
    null,
    { timeout: 45000 },
  );
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("ocade-offline-usage");
        open.onsuccess = () => {
          const db = open.result;
          const read = db.transaction("leases").objectStore("leases").getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result[0]);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
        open.onerror = () => reject(open.error);
      }),
  );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [key, session],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_serverFn/") || response.url().includes("/functions/v1/")) {
      network.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
        bearer: !!response.request().headers().authorization,
      });
    }
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#ocade-composer");
  await page.getByText(/^28 of 28 left · resets/).waitFor();
  console.log("PASS real authentication propagates to usage server functions; Free starts at 28");
  const offline = await installedLease(page);
  assert.equal(offline.accountId, session.user.id);
  assert.equal(offline.lease.payload.allocatedHundredths, 700);
  assert(offline.lease.signature && offline.verificationKeys.length);
  console.log(
    "PASS fresh browser registers and installs a real signed seven-use offline allocation",
  );
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Usage & Limits" }).click();
  await page.getByText(/^28 of 28 left$/).waitFor();
  await page.getByRole("button", { name: "Billing", exact: true }).click();
  assert(!/could not be read/i.test(await page.getByRole("dialog").innerText()));
  await page.getByText("Your plan", { exact: true }).waitFor();
  assert((await page.getByRole("dialog").innerText()).includes("Free"));
  console.log("PASS Billing reads current Free plan");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "OCADE", exact: true }).click();
  await page.fill("#ocade-composer", "Reply with only the word READY.");
  await page.click('button[aria-label="Send"]');
  await page.getByRole("button", { name: "Regenerate", exact: true }).waitFor({ timeout: 90000 });
  await page.getByText(/^27 of 28 left · resets/).waitFor({ timeout: 20000 });
  console.log("PASS real Chat answer delivered; exactly one use charged");
  const answerCount = await page.getByRole("button", { name: "Regenerate", exact: true }).count();

  let aborted = false;
  await page.route("**/functions/v1/ocade-intelligence", (route) => {
    aborted = true;
    return route.abort("failed");
  });
  await page.fill("#ocade-composer", "Deliberate transport failure regression.");
  await page.click('button[aria-label="Send"]');
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor({ timeout: 30000 });
  assert(aborted, "Failed generation never reached the intended transport");
  assert.equal(
    await page.getByRole("button", { name: "Regenerate", exact: true }).count(),
    answerCount,
  );
  await page.unroute("**/functions/v1/ocade-intelligence");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/^27 of 28 left · resets/).waitFor({ timeout: 20000 });
  console.log("PASS failed Chat generation releases allowance through the real backend");

  const second = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await second.addInitScript(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [key, session],
  );
  const device = await second.newPage();
  await device.goto(base, { waitUntil: "domcontentloaded" });
  await device.getByText(/^27 of 28 left · resets/).waitFor();
  const secondLease = await installedLease(device);
  assert.equal(secondLease.accountId, session.user.id);
  assert.notEqual(secondLease.deviceId, offline.deviceId);
  assert.notEqual(secondLease.leaseId, offline.leaseId);
  console.log("PASS second browser session sees the same account allowance");
  assert(
    network.some(
      (request) => request.path.includes("/_serverFn/") && request.status === 200 && request.bearer,
    ),
  );
  assert(
    network.some(
      (request) =>
        request.path.includes("/functions/v1/") && request.status === 200 && request.bearer,
    ),
  );
  assert.deepEqual(failures, []);
  console.log("LIVE_USAGE_PROOF_PASSED", JSON.stringify(network));
} finally {
  await browser.close();
}
