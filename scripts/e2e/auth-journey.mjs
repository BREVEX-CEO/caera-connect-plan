/**
 * The way in, proved in a real browser.
 *
 * What a unit test cannot answer: whether the two methods are actually on
 * screen, whether a refused address produces one OCADE sentence rather than a
 * provider's own text, and whether a deep link into the signed-in product
 * comes back after authentication rather than being dropped.
 *
 * DELIVERING a real code is deliberately NOT attempted. That needs a live
 * provider and a real inbox, and a test that pretends otherwise is fake green.
 * The stub accepts one fixed code and sends nothing anywhere, so what is
 * proved is OCADE's half of the round-trip: the navigation to the code screen,
 * the six-digit field, the sanitized refusal of a wrong code, the session, and
 * the redirect to wherever the person was going.
 *
 * That round-trip is here because it was BROKEN and nothing noticed.
 * `auth.tsx` was a parent route with no `<Outlet/>`, so `/auth/verify`,
 * `/auth/callback` and `/auth/challenge` all rendered the sign-in form
 * instead of themselves: nobody who asked for a code could enter one, and no
 * Google handshake could complete. The page title was right, which is what
 * made it invisible to anything that did not look at the body.
 *
 * Usage: node scripts/e2e/auth-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

/** Set what the project reports at `/auth/v1/settings`. */
async function reportProviders(external) {
  await fetch(`${SUPABASE}/__fixture/auth-providers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(external),
  });
}

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });

  check(
    "Google is the primary way in",
    (await page.getByRole("button", { name: "Continue with Google" }).count()) === 1,
  );
  check(
    "a code can be sent to an email address",
    (await page.locator('input[type="email"]').count()) === 1,
  );
  check(
    "no phone number is offered, because OCADE cannot send an SMS",
    (await page.locator('input[type="tel"]').count()) === 0 &&
      (await page.getByRole("tab", { name: "phone" }).count()) === 0,
  );
  check(
    "the first screen leads with a code, not a password",
    (await page.locator('input[type="password"]').count()) === 0,
  );

  // The password path, one press away, with one account-neutral refusal.
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.fill('input[type="email"]', "proof@ocade.test");
  await page.fill('input[type="password"]', "wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForSelector("text=That email and password did not match.", { timeout: 10_000 });
  check("a wrong password is refused without saying whether the account exists", true);
  await page.getByRole("button", { name: "Use an email code instead" }).click();
  await page.fill('input[type="email"]', "");
  check(
    "the terms and the privacy policy are linked from the way in",
    (await page.locator('a[href="/terms"]').count()) >= 1 &&
      (await page.locator('a[href="/privacy"]').count()) >= 1,
  );

  // An empty address is refused in OCADE's words, naming no provider.
  await page.getByRole("button", { name: "Send code" }).click();
  const emailProblem = await page.getByRole("alert").innerText();
  check("an empty email address is refused clearly", emailProblem.includes("Enter your email"));
  check(
    "no provider is named in a refusal",
    !/supabase|gotrue|resend|smtp/i.test(emailProblem),
    emailProblem,
  );

  /*
   * THE SCREEN FOLLOWS THE PROJECT, NOT A BUILD FLAG.
   *
   * `VITE_AUTH_*` flags used to decide this, each defaulting to `false`
   * in production, and nothing kept them in step with the live project: a
   * correct build could hide a working provider, and a stale one could offer a
   * provider that had been turned off. The screen asks the project now, so
   * turning a provider off at the project has to remove it from the page.
   */
  await reportProviders({ google: false, email: true });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  check(
    "a provider the project has turned off is gone, not present and refusing",
    (await page.getByRole("button", { name: "Continue with Google" }).count()) === 0,
  );
  check(
    "the channel it does have is still offered",
    (await page.locator('input[type="email"]').count()) === 1,
  );

  await reportProviders({ google: true, email: false });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  check(
    "and a channel it has turned off says so instead of pretending",
    (await page.locator('input[type="email"]').count()) === 0 &&
      (await page.locator("body").innerText()).includes("not available"),
  );

  await reportProviders({ google: true, email: true });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  check(
    "turning them back on restores them",
    (await page.getByRole("button", { name: "Continue with Google" }).count()) === 1 &&
      (await page.locator('input[type="email"]').count()) === 1,
  );

  // A deep link into the signed-in product survives the redirect.
  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/auth/, { timeout: 10_000 });
  check(
    "a deep link is carried through authentication",
    new URL(page.url()).searchParams.get("next") === "/library",
    page.url(),
  );

  /*
   * THE CODE ROUND-TRIP, END TO END.
   *
   * Asking for a code, being taken to the code screen, mistyping it, being
   * told so in OCADE's words, and then signing in. The stub accepts one fixed
   * code and delivers nothing anywhere — what is proved here is OCADE's half:
   * the navigation, the six-digit field, the sanitized refusal, the session
   * and the redirect to where the person was going.
   */
  const address = `code-${Date.now()}@ocade.test`;
  await page.goto(`${BASE}/auth?next=%2Flibrary`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', address);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.waitForURL(/\/auth\/verify/, { timeout: 15_000 });
  // The code screen is client-rendered, so the URL changes before it exists.
  await page.waitForSelector("#code", { timeout: 15_000 });
  check("asking for a code reaches the code screen", true, page.url());
  check(
    "the code screen says where the code went",
    (await page.locator("body").innerText()).includes(address),
  );

  await page.fill("#code", "000000");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  const wrongCode = await page.getByRole("alert").innerText();
  check("a wrong code is refused", wrongCode.length > 0, wrongCode);
  check(
    "and the refusal names no provider and no account",
    !/supabase|gotrue|twilio|user not found|no user/i.test(wrongCode),
    wrongCode,
  );

  await page.fill("#code", "123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/library/, { timeout: 15_000 });
  check("the right code signs in and lands where the person was going", true, page.url());
  await page.waitForSelector('aside button[aria-haspopup="menu"]', { timeout: 15_000 });
  check("and the signed-in account is on screen", true);

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
