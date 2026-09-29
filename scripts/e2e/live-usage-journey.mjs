/** Live Supabase and production UI proof. Requires an isolated, confirmed Free test account.
 * No RPC mocks. Only the second generation's transport is deliberately aborted.
 *
 * DESTRUCTIVE ON THAT ACCOUNT, DELIBERATELY. Every browser this proof opens asks
 * the account for a device of its own, an account is allowed two of a kind, and
 * nothing in the product gives one back. So this resets the proof account's
 * devices before the run and removes the ones it created after it — in a
 * `finally`, because a proof that exhausts the cap on the way to failing can
 * only ever be run once.
 *
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
/** How long a first offline install may take on the machine running this. */
const OFFLINE_READY_MS = Number(process.env.OCADE_PROOF_OFFLINE_READY_MS ?? 20 * 60_000);
const url = required("SUPABASE_URL");
const publishableKey = required("SUPABASE_PUBLISHABLE_KEY");
assert(!/localhost|127\.0\.0\.1/.test(url), "A Supabase stub cannot prove live permissions");
const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: publishableKey, "content-type": "application/json" },
  body: JSON.stringify({
    email: required("OCADE_PROOF_EMAIL"),
    password: required("OCADE_PROOF_PASSWORD"),
  }),
});
assert.equal(response.status, 200, "Real Supabase password authentication failed");
const session = await response.json();
assert(session.access_token && session.user?.id, "Supabase returned no authenticated session");

/** The account's own rows, through PostgREST, with the account's own token. */
async function rest(path, init = {}) {
  const result = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  assert(result.ok, `${init.method ?? "GET"} ${path} failed: ${result.status}`);
  return result.status === 204 ? [] : result.json();
}

const deviceIds = async () =>
  (await rest(`devices?user_id=eq.${session.user.id}&select=id`)).map((row) => row.id);

async function removeDevices(ids) {
  if (ids.length === 0) return 0;
  await rest(`devices?id=in.(${ids.join(",")})`, { method: "DELETE" });
  return ids.length;
}

console.log(`cleared ${await removeDevices(await deviceIds())} device(s) left by an earlier run`);

const browser = await chromium.launch({ executablePath: required("PLAYWRIGHT_CHROMIUM") });
const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const failures = [];
const network = [];

/** The sidebar meter, which is the number the server gate will actually honour. */
async function remaining(page) {
  const meter = await page.locator("aside p", { hasText: /of \d+ left · resets/ }).innerText();
  return Number(/^(\d+) of (\d+) left/.exec(meter)[1]);
}

/** How much of the allowance is held on devices for answers with no network. */
async function heldOffline(page) {
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Billing & Usage" }).click();
  const panel = await page.getByRole("dialog", { name: "Settings" }).innerText();
  await page.keyboard.press("Escape");
  return Number(/(\d+) of this session's requests are held/.exec(panel)?.[1] ?? 0);
}

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
  const opening = await remaining(page);
  assert(opening > 8, `A proof needs a rested allowance; this account has ${opening}`);
  console.log(`PASS real authentication propagates to usage server functions; ${opening} left`);

  const offline = await installedLease(page);
  assert.equal(offline.accountId, session.user.id);
  assert.equal(offline.lease.payload.allocatedHundredths, 700);
  assert(offline.lease.signature && offline.verificationKeys.length);
  console.log(
    "PASS fresh browser registers and installs a real signed seven-use offline allocation",
  );

  /*
   * THE METER AND THE SIGNED BLOCK AGREE. A block is charged to the account when
   * it is issued, so the number that decides whether the next online request is
   * served has to come down by it. It used to be added back for display, which
   * read better and promised requests the gate would refuse.
   */
  await page.reload({ waitUntil: "domcontentloaded" });
  const afterLease = await remaining(page);
  assert.equal(afterLease, opening - 7, `${opening} then ${afterLease} after a seven-use block`);
  assert.equal(await heldOffline(page), 7);
  console.log("PASS the allowance shown is the allowance the gate will honour");

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Billing & Usage" }).click();
  await page.getByText(new RegExp(`^${afterLease} of \\d+ left$`)).waitFor();
  await page.getByRole("button", { name: "Billing & Usage", exact: true }).click();
  assert(!/could not be read/i.test(await page.getByRole("dialog").innerText()));
  await page.getByText("Your plan", { exact: true }).waitFor();
  assert((await page.getByRole("dialog").innerText()).includes("Free"));
  console.log("PASS Billing reads current Free plan");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Online", exact: true }).click();
  await page.fill("#ocade-composer", "Reply with only the word READY.");
  await page.click('button[aria-label="Send"]');
  await page.getByRole("button", { name: "Regenerate", exact: true }).waitFor({ timeout: 90000 });
  await page
    .getByText(new RegExp(`^${afterLease - 1} of \\d+ left · resets`))
    .waitFor({ timeout: 20000 });
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
  /* The meter first, which nothing remounted, and then the server's own answer. */
  await page
    .getByText(new RegExp(`^${afterLease - 1} of \\d+ left · resets`))
    .waitFor({ timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByText(new RegExp(`^${afterLease - 1} of \\d+ left · resets`))
    .waitFor({ timeout: 20000 });
  console.log("PASS failed Chat generation releases allowance through the real backend");

  /* --- one account, two browsers ------------------------------------------ */

  const second = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await second.addInitScript(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [key, session],
  );
  const device = await second.newPage();
  await device.goto(base, { waitUntil: "domcontentloaded" });
  await device.getByText(new RegExp(`^${afterLease - 1} of \\d+ left · resets`)).waitFor();
  const secondLease = await installedLease(device);
  assert.equal(secondLease.accountId, session.user.id);
  assert.notEqual(secondLease.deviceId, offline.deviceId);
  assert.notEqual(secondLease.leaseId, offline.leaseId);
  console.log("PASS second browser session sees the same account allowance");
  await second.close();

  /* --- spent with no network, and settled when it comes back -------------- */

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Privacy & Security" }).click();
  await page.getByText("Ready", { exact: true }).waitFor({ timeout: OFFLINE_READY_MS });
  await page.keyboard.press("Escape");

  const heldBefore = await heldOffline(page);
  await context.setOffline(true);
  await page.fill("#ocade-composer", "Answer here with no network: say READY.");
  await page.click('button[aria-label="Send"]');
  await page.getByRole("button", { name: "Regenerate", exact: true }).waitFor({ timeout: 180000 });
  console.log("PASS a real answer with no network, from the device's own signed block");

  await context.setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#ocade-composer");
  await page.waitForTimeout(5000);
  const heldAfter = await heldOffline(page);
  assert.equal(heldAfter, heldBefore - 1, `${heldBefore} held, then ${heldAfter} after reconnect`);
  console.log("PASS reconnect reconciles what was spent offline, exactly once");

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
  console.log(`removed ${await removeDevices(await deviceIds())} device(s) this proof created`);
}
