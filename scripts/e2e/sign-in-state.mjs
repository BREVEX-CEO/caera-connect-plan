/**
 * Produce a real signed-in browser state, by using the product.
 *
 * Not by writing a session into localStorage. Standing up a fake session to
 * walk past an auth gate teaches the wrong thing and proves less: this fills
 * the email/password form and presses Sign in, so a state file only exists if
 * that flow genuinely works.
 *
 * IT NO LONGER WALKS A SETUP WIZARD. There is not one: `docs/APP_FLOW.md`
 * sends a new account to Chat, and this asserts that — landing anywhere in the
 * `/onboarding` family is now a failure rather than five Continues to press.
 *
 * Writes a Playwright storage state other audits reuse. The Supabase it signs
 * in against is the loopback fixture — see scripts/fixtures/stub-supabase.mjs
 * for exactly what that does and does not prove.
 */
import { chromium } from "playwright-core";
import { clearModals } from "./sign-in.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const OUT = process.env.OCADE_STORAGE_STATE_OUT ?? "/tmp/ocade-signed-in-state.json";
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? "audit@ocade.test";
const PASSWORD = process.env.OCADE_AUDIT_PASSWORD ?? "AuditPassword123!";

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);
await clearModals(page);

await page
  .locator("button", { hasText: /^Email$/ })
  .first()
  .click({ timeout: 15000 });
await page.waitForTimeout(600);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.waitForTimeout(300);
await page
  .locator("button", { hasText: /^Sign in$/ })
  .first()
  .click({ timeout: 15000 });
await page.waitForTimeout(3500);

const signedIn = await page.evaluate(() =>
  Object.keys(localStorage).some((k) => /auth-token/.test(k)),
);
if (!signedIn) {
  console.error(`sign-in failed; still at ${page.url()}`);
  await browser.close();
  process.exit(1);
}
const landed = new URL(page.url()).pathname;
console.log(`signed in, landed on ${landed}`);
if (landed.startsWith("/onboarding")) {
  console.error("sign-in still routes through a setup wizard");
  await browser.close();
  process.exit(1);
}
// Save the once-per-account welcome dismissal into the shared state. Without
// this, every later audit context opens the tour again, and a setup dialog that
// is still resolving can briefly prevent the ordinary Skip click from reaching
// it.
await page.waitForTimeout(500);
await clearModals(page);
await context.storageState({ path: OUT });
console.log(`storage state written to ${OUT}`);
await browser.close();
