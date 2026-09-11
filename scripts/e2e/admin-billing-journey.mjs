/**
 * THE BILLING CONSOLE, AND THE TWO DOORS IN FRONT OF A GRANT — PLAN.md §G/§H.
 *
 * §G asks for "a billing and seat overview and payment-event state"; §H adds
 * that "Admin grants are separate entitlements, never fake payments", made only
 * with "authorized role, recent AAL2, reason, start/end where applicable,
 * immutable audit and revoke state".
 *
 * WHAT CANNOT BE ESTABLISHED BY READING SOURCE, and is therefore what this
 * drives:
 *
 *   That an ordinary account is sent away from the route rather than shown an
 *   empty screen.
 *
 *   That the console renders and its five reads SETTLE. A table stuck on its
 *   spinner looks identical to source inspection and is the shape a read that
 *   quietly failed takes.
 *
 *   That a grant attempted with the role but WITHOUT a second factor is
 *   refused — by the database, whose message the screen passes on — and that no
 *   grant row appears. This is the check most likely to rot: the form is easy
 *   to change, and a refusal that stopped happening would still render.
 *
 *   That the same grant succeeds once a second factor is verified, appears in
 *   the audit list with its reason, and can be revoked WITHOUT the record of it
 *   disappearing.
 *
 * WHAT IS MODELLED: Supabase, in `stub-supabase.mjs`, including the grant
 * functions' own order of checks — role, factor, reason, window, self-grant.
 * A fixture that skipped to the insert would let a screen that had lost one of
 * those checks pass a browser run.
 */
import { chromium } from "playwright-core";
import { clearModals, signInWithPassword } from "./sign-in.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const STUB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? "audit@ocade.test";
const PASSWORD = process.env.OCADE_AUDIT_PASSWORD ?? "Audit-Passw0rd!";
const CUSTOMER_EMAIL = "grantee@ocade.test";

const problems = [];
const note = (line) => console.log(`  ${line}`);
const fail = (line) => {
  problems.push(line);
  console.error(`  FAIL  ${line}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
const EXPECTED = [
  {
    pattern: /localhost:11434|ERR_CONNECTION_REFUSED/,
    why: "the local-engine probe, with no Ollama in this sandbox",
  },
  {
    pattern: /403 \(Forbidden\)|rest\/v1\/rpc\/ocade_grant_entitlement/,
    why: "the deliberate grant attempt with no second factor, which must be refused",
  },
];
const expected = (line) => EXPECTED.find((entry) => entry.pattern.test(line));

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
page.on("requestfailed", (request) => {
  const failure = request.failure()?.errorText ?? "";
  if (/ERR_ABORTED|net::ERR_ABORTED/.test(failure)) return;
  failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
});

const settle = (ms = 1500) => page.waitForTimeout(ms);

/** How many grants the fixture holds, read directly rather than from the screen. */
async function grantCount() {
  const response = await fetch(`${STUB}/rest/v1/ocade_entitlement_grants?select=id`, {
    headers: { apikey: "stub", authorization: "Bearer stub" },
  });
  if (!response.ok) return -1;
  const rows = await response.json();
  return Array.isArray(rows) ? rows.length : -1;
}

try {
  console.log("\nSTEP 1 — an ordinary account is sent away from the billing console");
  await page.goto(`${BASE}/admin/billing`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);

  if (new URL(page.url()).pathname === "/admin/billing") {
    fail("an account with no admin role reached the billing console");
  } else if (!/access-denied/.test(page.url())) {
    fail(`an ordinary account was sent somewhere unexpected: ${page.url()}`);
  } else {
    note("an ordinary account is sent to the access-denied screen");
    if ((await page.getByText(/requires the admin role/i).count()) === 0) {
      fail("the refusal does not say what is missing");
    } else {
      note("and is told which role it needs, rather than being shown a blank page");
    }
  }

  /*
   * AN ACCOUNT TO GRANT TO, MADE THE REAL WAY.
   *
   * Signing one up rather than writing a row means the email lookup on the
   * grant form is exercised against a profile that exists for the same reason
   * a customer's would.
   */
  console.log("\nSTEP 2 — a second account exists, so there is somebody to grant to");
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await signInWithPassword(customer, {
    email: CUSTOMER_EMAIL,
    password: PASSWORD,
    baseUrl: BASE,
  });
  await customer.waitForTimeout(3000);
  await clearModals(customer);
  note(`a second account exists: ${CUSTOMER_EMAIL}`);

  console.log("\nSTEP 3 — with the role, the console renders and every read settles");
  const granted = await fetch(`${STUB}/__fixture/grant-admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!granted.ok) fail(`the audit account could not be made an administrator: ${granted.status}`);

  await page.goto(`${BASE}/admin/billing`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4500);

  if (new URL(page.url()).pathname !== "/admin/billing") {
    fail(`an administrator was still sent away: ${page.url()}`);
  } else {
    note("an administrator reaches the console");
  }

  for (const heading of [
    /provider subscriptions/i,
    /entitlement grants/i,
    /payment events/i,
    // The accessible name carries the row count too, so this is not anchored.
    /invoices/i,
    /seats per organization/i,
  ]) {
    if ((await page.getByRole("heading", { name: heading }).count()) === 0) {
      fail(`the console is missing the panel matching ${heading}`);
    }
  }

  await settle(2500);
  const stillLoading = await page.getByText(/^Loading/i).count();
  if (stillLoading > 0) fail(`${stillLoading} panel(s) never finished loading`);
  else note("every panel settled rather than sitting on a spinner");

  console.log("\nSTEP 4 — the screen says a grant is not a payment");
  if ((await page.getByText(/never a payment/i).count()) === 0) {
    fail("the grant panel does not say a grant is not a payment");
  } else {
    note("the grant panel says what a grant is, and what it is not");
  }

  console.log("\nSTEP 5 — an email finds the account, and the grant is made against its id");
  await page.locator("#grant-email").fill(CUSTOMER_EMAIL);
  await page.getByRole("button", { name: /find account/i }).click({ timeout: 15000 });
  await settle(2500);

  const foundLine =
    (await page
      .getByText(/^Granting to /)
      .textContent()
      .catch(() => "")) ?? "";
  if (!/[0-9a-f-]{36}/i.test(foundLine)) {
    fail(`the lookup did not resolve the email to an account id: ${foundLine.slice(0, 120)}`);
  } else {
    note("the email resolved to the account's permanent id, which is what a grant names");
  }

  await page.locator("#grant-tier").selectOption("max");
  await page.locator("#grant-days").fill("14");
  await page.locator("#grant-reason").fill("Covering an outage on a paid account.");
  await settle(400);

  console.log("\nSTEP 6 — without a second factor the database refuses, and nothing is written");
  const before = await grantCount();
  await page.getByRole("button", { name: /grant entitlement/i }).click({ timeout: 15000 });
  await settle(3000);

  /*
   * THE DATABASE'S EXACT SENTENCE, not the words "second factor".
   *
   * The panel's own copy explains that a grant needs one, so a looser match
   * was satisfied by static text and reported a refusal that had not
   * happened — which a break test caught by disabling the check in the
   * fixture and watching only the row count notice.
   */
  const refusal = await page
    .getByText(/Granting an entitlement needs a recent second factor\./)
    .count();
  if (refusal === 0) {
    fail("a grant was attempted with no second factor and the screen reported no refusal");
  } else {
    note("the refusal is the database's own sentence, passed on rather than reworded");
  }
  const after = await grantCount();
  if (after !== before) {
    fail(`a grant was written despite the refusal: ${before} then ${after}`);
  } else {
    note("and no grant row exists — the refusal is the database's, not the screen's");
  }

  console.log("\nSTEP 7 — a verified second factor raises the session, and the grant lands");
  await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);
  await clearModals(page);
  const nameField = page.getByLabel(/a name for this authenticator app/i);
  if ((await nameField.count()) === 0) {
    fail("the security screen offers no way to enrol a second factor");
  } else {
    await nameField.fill("Audit phone");
    await page
      .getByRole("button", { name: /set up two-step sign-in|add another app/i })
      .first()
      .click({ timeout: 15000 });
    await settle(2500);
    await page.getByLabel(/six-digit code from your authenticator app/i).fill("123456");
    await page.getByRole("button", { name: /turn on two-step sign-in/i }).click({ timeout: 15000 });
    await settle(3500);
    note("a second factor was verified, so the session now carries aal2");
  }

  await page.goto(`${BASE}/admin/billing`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4000);
  await page.locator("#grant-email").fill(CUSTOMER_EMAIL);
  await page.getByRole("button", { name: /find account/i }).click({ timeout: 15000 });
  await settle(2000);
  await page.locator("#grant-tier").selectOption("max");
  await page.locator("#grant-days").fill("14");
  await page.locator("#grant-reason").fill("Covering an outage on a paid account.");
  await page.getByRole("button", { name: /grant entitlement/i }).click({ timeout: 15000 });
  await settle(3500);

  if ((await grantCount()) !== before + 1) {
    fail("with a second factor verified, the grant still did not land");
  } else {
    note("the grant was recorded");
  }
  if ((await page.getByText(/Covering an outage on a paid account\./).count()) === 0) {
    fail("the grant does not appear in the audit list with the reason it was given for");
  } else {
    note("and appears in the list with the reason somebody wrote");
  }

  console.log("\nSTEP 8 — revoking keeps the record that access was given");
  const revokeButton = page.getByRole("button", { name: /^revoke$/i }).first();
  if ((await revokeButton.count()) === 0) {
    fail("a live grant offers no way to revoke it");
  } else {
    page.once("dialog", (dialog) => void dialog.accept("Granted in error during a test run."));
    await revokeButton.click({ timeout: 15000 });
    await settle(3500);

    if ((await grantCount()) !== before + 1) {
      fail("revoking deleted the grant — the evidence a dispute needs is gone");
    } else {
      note("the row is still there; only its state changed");
    }
    if ((await page.getByText(/Covering an outage on a paid account\./).count()) === 0) {
      fail("the revoked grant disappeared from the audit list");
    } else {
      note("and the revoked grant is still listed, which is what an audit is for");
    }
  }

  await customerContext.close();
} catch (error) {
  fail(`the journey threw: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("\nCONSOLE AND NETWORK");
let accounted = 0;
for (const line of [...consoleErrors, ...failedRequests]) {
  if (expected(line)) {
    accounted += 1;
    continue;
  }
  fail(`unexplained: ${line.slice(0, 220)}`);
}
if (consoleErrors.length + failedRequests.length === accounted) {
  note("nothing unexplained in the console or on the network");
}

await browser.close();
console.log(
  `\n${problems.length === 0 ? "ADMIN BILLING JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
