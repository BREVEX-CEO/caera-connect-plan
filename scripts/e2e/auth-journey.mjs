/**
 * The way in, proved in a real browser.
 *
 * What a unit test cannot answer: whether the three methods are actually on
 * screen, whether the country picker carries real calling codes, whether a
 * refused phone number produces one OCADE sentence rather than a provider's
 * own text, and whether a deep link into the signed-in product comes back
 * after authentication rather than being dropped.
 *
 * Sending a real code is deliberately NOT attempted. It needs a live provider
 * and a real inbox, and a test that pretends otherwise is the "fake green"
 * `docs/RULES.md` #15 forbids. The send path is covered by the surface tests;
 * what is proved here is everything up to the provider boundary.
 *
 * Usage: node scripts/e2e/auth-journey.mjs [--base=http://127.0.0.1:8788]
 */
import { chromium } from "playwright-core";

const baseArgument = process.argv.find((argument) => argument.startsWith("--base="));
const BASE = baseArgument ? baseArgument.slice("--base=".length) : "http://127.0.0.1:8788";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

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
    "a code can be sent to an email address or a phone number",
    (await page.getByRole("tab", { name: "email" }).count()) === 1 &&
      (await page.getByRole("tab", { name: "phone" }).count()) === 1,
  );
  check(
    "there is no password field on the way in",
    (await page.locator('input[type="password"]').count()) === 0,
  );
  check(
    "the terms and the privacy policy are linked from the way in",
    (await page.locator('a[href="/terms"]').count()) >= 1 &&
      (await page.locator('a[href="/privacy"]').count()) >= 1,
  );

  // Email: an empty address is refused in OCADE's words.
  await page.getByRole("tab", { name: "email" }).click();
  await page.getByRole("button", { name: "Send code" }).click();
  const emailProblem = await page.getByRole("alert").innerText();
  check("an empty email address is refused clearly", emailProblem.includes("Enter your email"));

  // Phone: the picker is real, and a short number never reaches a provider.
  await page.getByRole("tab", { name: "phone" }).click();
  const options = await page.locator("select option").allTextContents();
  check(
    "the country picker carries real calling codes",
    options.length > 10 && options.some((entry) => entry.includes("+91")),
  );
  await page.fill('input[type="tel"]', "12");
  await page.getByRole("button", { name: "Send code" }).click();
  const phoneProblem = await page.getByRole("alert").innerText();
  check("a number that cannot be valid is refused here", phoneProblem.includes("too short"));
  check(
    "no provider is named in a refusal",
    !/supabase|twilio|gotrue/i.test(phoneProblem),
    phoneProblem,
  );

  // A deep link into the signed-in product survives the redirect.
  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/auth/, { timeout: 10_000 });
  check(
    "a deep link is carried through authentication",
    new URL(page.url()).searchParams.get("next") === "/library",
    page.url(),
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
