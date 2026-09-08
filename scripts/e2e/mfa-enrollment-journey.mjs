/**
 * THE TWO-STEP SIGN-IN JOURNEY, IN A REAL BROWSER.
 *
 * Source inspection can tell you the gate exists. It cannot tell you that a
 * person can actually get through it — that the QR screen renders, that a code
 * is accepted, that the redirect after enrollment does not bounce, and above
 * all that an enrolled account is genuinely STOPPED on its way into the
 * product. That last one is the whole feature, and it is exactly the kind of
 * thing that passes every unit test and fails on the screen.
 *
 * WHAT IS REAL HERE: OCADE's own code, all of it. The route guard, the
 * assurance read, the redirect, the enrollment panel, the QR rendering, the
 * challenge screen and the recovery branch are the shipped modules running in
 * Chromium against the production build.
 *
 * WHAT IS MODELLED: Supabase. `scripts/fixtures/stub-supabase.mjs` serves the
 * MFA wire shapes — factors on the user object, `aal`/`amr` in the token, a
 * challenge that only raises assurance once verified. It does NOT do TOTP
 * arithmetic, so any six digits pass and `000000` is the wrong answer. That is
 * honest about what is proven: OCADE does not compute TOTP codes, Supabase
 * does, so what is under test here is OCADE's handling of accept and refuse.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

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

/*
 * Every console error and failed request, collected throughout.
 *
 * A journey that reaches the right screens while throwing in the console is
 * not a passing journey — it is a defect that has not surfaced yet.
 */
const consoleErrors = [];
const failedRequests = [];

/**
 * Noise this journey deliberately CAUSES, or that the sandbox cannot avoid.
 *
 * Named one at a time, with the reason, rather than filtered by a broad
 * pattern. A blanket ignore is how a real defect gets absorbed by an audit that
 * still reports a pass; each entry here is a claim that has to stay true.
 */
const EXPECTED = [
  {
    // STEP 3 types a deliberately wrong code. Supabase answers 422, and the
    // browser logs the failed response. That IS the test.
    pattern: /422 \(Unprocessable Entity\)/,
    why: "the deliberate wrong-code step",
  },
  {
    // OCADE probes for a local Ollama on every load. Nothing is listening in
    // this sandbox, and refusing to probe would be a worse product.
    pattern: /localhost:11434|ERR_CONNECTION_REFUSED/,
    why: "the local-engine probe, with no Ollama in this sandbox",
  },
];

function expected(line) {
  return EXPECTED.find((entry) => entry.pattern.test(line));
}

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
page.on("requestfailed", (request) => {
  const failure = request.failure()?.errorText ?? "";
  // Aborts are the app cancelling its own work, not a failure of the product.
  if (/ERR_ABORTED|net::ERR_ABORTED/.test(failure)) return;
  failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
});

async function settle(ms = 1200) {
  await page.waitForTimeout(ms);
}

try {
  /* ------------------------------------------------------------ enroll -- */
  console.log("\nSTEP 1 — the Security page offers two-step sign-in");
  await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(2500);

  const heading = page.getByRole("heading", { name: /two-step sign-in/i });
  if ((await heading.count()) === 0) {
    fail("the Security page does not show a two-step sign-in section");
  } else {
    note("two-step sign-in section is present");
  }

  const setUp = page.getByRole("button", { name: /set up two-step sign-in|add another app/i });
  if ((await setUp.count()) === 0) {
    fail("there is no control to begin enrollment");
  } else {
    await page.getByLabel(/a name for this authenticator app/i).fill("Audit phone");
    await setUp.first().click({ timeout: 15000 });
    await settle(2500);
  }

  console.log("\nSTEP 2 — the set-up screen shows BOTH a QR code and a typeable secret");
  const qr = page.getByRole("img", { name: /set-up code/i });
  if ((await qr.count()) === 0) {
    fail("no QR code rendered for the authenticator app");
  } else {
    /*
     * The square must actually contain modules. An SVG that renders as an empty
     * box passes any "is it there" check and scans as nothing.
     */
    const modules = await qr.first().locator("rect").count();
    if (modules < 50) fail(`the QR code has only ${modules} rectangles — it is not a real code`);
    else note(`QR code rendered with ${modules} modules`);
  }

  const secret = await page.locator("code").first().textContent();
  if (!secret || secret.trim().length < 10) {
    // A camera is not available to everybody; the secret is the equal route in.
    fail("no typeable secret shown alongside the QR code");
  } else {
    note(`manual secret offered (${secret.trim().length} characters)`);
  }

  console.log("\nSTEP 3 — a WRONG code is refused, and says what to do");
  const codeBox = page.getByLabel(/six-digit code from your authenticator app/i);
  await codeBox.fill("000000");
  await page.getByRole("button", { name: /turn on two-step sign-in/i }).click({ timeout: 15000 });
  await settle(2000);

  const refusal = page.getByRole("alert");
  if ((await refusal.count()) === 0) {
    fail("a wrong code produced no visible refusal");
  } else {
    const text = (await refusal.first().textContent()) ?? "";
    if (!/code/i.test(text)) fail(`the refusal does not mention the code: ${text.slice(0, 80)}`);
    else note(`wrong code refused: "${text.trim().slice(0, 70)}"`);
  }

  console.log("\nSTEP 4 — a correct code turns it on");
  await codeBox.fill("123456");
  await page.getByRole("button", { name: /turn on two-step sign-in/i }).click({ timeout: 15000 });
  await settle(3000);

  const status = await page.getByText(/^On — 1 authenticator app\.?$/i).count();
  if (status === 0) {
    const body = await page.locator("body").innerText();
    fail(`after verifying, the page does not report two-step sign-in as on: ${body.slice(0, 200)}`);
  } else {
    note("two-step sign-in reported as on, with the factor listed");
  }

  /* -------------------------------------------------- recovery codes --- */
  console.log("\nSTEP 5 — recovery codes are offered, or truthfully unavailable");
  const recoveryButton = page.getByRole("button", { name: /create recovery codes/i });
  if ((await recoveryButton.count()) > 0) {
    await recoveryButton.first().click({ timeout: 15000 });
    await settle(2500);
    const shown = await page.locator("li.rounded").count();
    const unavailable = await page.getByRole("alert").count();
    if (shown >= 10) {
      note(`${shown} recovery codes shown once`);
      const warning = await page.getByText(/only time they are shown/i).count();
      if (warning === 0) fail("the codes are shown without saying they are shown only once");
    } else if (unavailable > 0) {
      /*
       * A deployment with no pepper cannot issue codes, and OCADE says so
       * rather than issuing ones it cannot check later. That is the correct
       * outcome here, not a failure — this sandbox has no pepper configured.
       */
      const text = (await page.getByRole("alert").first().textContent()) ?? "";
      note(`recovery codes truthfully unavailable: "${text.trim().slice(0, 90)}"`);
    } else {
      fail("pressing 'Create recovery codes' produced neither codes nor an explanation");
    }
  } else {
    note("no recovery-code control offered on this deployment");
  }

  /* ------------------------------------------------------ the gate ----- */
  console.log("\nSTEP 6 — THE POINT: an aal1 session on an enrolled account is STOPPED");
  /*
   * A fresh context reuses the stored sign-in but not the raised assurance —
   * exactly the state somebody is in when they sign in tomorrow. If the guard
   * does not stop this, MFA is an ornament and a stolen password still reaches
   * every screen.
   */
  const secondContext = await browser.newContext(STATE ? { storageState: STATE } : {});
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`${BASE}/ocade`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await secondPage.waitForTimeout(4000);

  const landed = new URL(secondPage.url()).pathname;
  if (!landed.startsWith("/challenge")) {
    fail(`an enrolled account reached ${landed} without confirming a code`);
  } else {
    note(`stopped at ${landed} and asked to confirm`);

    const prompt = await secondPage.getByRole("heading", { name: /confirm it is you/i }).count();
    if (prompt === 0) fail("the challenge route rendered no prompt");

    // And the way out for somebody who lost their phone is right here.
    const lost = await secondPage.getByRole("button", { name: /lost my phone/i }).count();
    if (lost === 0) fail("no recovery route offered on the challenge screen");
    else note("recovery route offered to somebody without their phone");

    console.log("\nSTEP 7 — confirming the code lets them through");
    await secondPage.getByLabel(/six-digit code/i).fill("123456");
    await secondPage.getByRole("button", { name: /^confirm$/i }).click({ timeout: 15000 });
    await secondPage.waitForTimeout(5000);
    const after = new URL(secondPage.url()).pathname;
    if (after.startsWith("/challenge")) {
      fail("a correct code did not get past the challenge — the gate loops");
    } else {
      note(`confirmed, and continued to ${after}`);
    }
  }
  await secondContext.close();
} catch (error) {
  fail(`the journey threw: ${error instanceof Error ? error.message : String(error)}`);
}

/* ------------------------------------------------------------- report -- */
console.log("\nCONSOLE AND NETWORK");
let accounted = 0;
for (const line of [...consoleErrors, ...failedRequests]) {
  const known = expected(line);
  if (known) {
    accounted += 1;
    continue;
  }
  fail(`unexplained: ${line.slice(0, 220)}`);
}
if (accounted > 0)
  note(`${accounted} expected message(s): ${EXPECTED.map((e) => e.why).join("; ")}`);
if (consoleErrors.length + failedRequests.length === accounted) {
  note("nothing unexplained in the console or on the network");
}

await browser.close();

console.log(
  `\n${problems.length === 0 ? "MFA ENROLLMENT JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
