/**
 * Produce a real signed-in, onboarded browser state, by using the product.
 *
 * Not by writing a session into localStorage. Standing up a fake session to
 * walk past an auth gate teaches the wrong thing and proves less: this fills
 * the email/password form, presses Sign in, and then answers all five
 * onboarding steps, so a state file only exists if those flows genuinely work.
 *
 * Writes a Playwright storage state other audits reuse. The Supabase it signs
 * in against is the loopback fixture — see scripts/fixtures/stub-supabase.mjs
 * for exactly what that does and does not prove.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const OUT = process.env.OCADE_STORAGE_STATE_OUT ?? "/tmp/ocade-onboarded-state.json";
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? "audit@ocade.test";
const PASSWORD = process.env.OCADE_AUDIT_PASSWORD ?? "AuditPassword123!";

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext();
const page = await context.newPage();

async function clearModals() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let i = 0; i < (await boxes.count()); i += 1) {
      await boxes
        .nth(i)
        .click({ timeout: 5000 })
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
      .click({ timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(600);
  }
}

await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);
await clearModals();

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
console.log(`signed in, landed on ${new URL(page.url()).pathname}`);

// Onboarding: five steps, each ending in Continue, the last in Enter workspace.
for (let step = 1; step <= 8; step += 1) {
  if (new URL(page.url()).pathname !== "/onboarding") break;
  await page.evaluate(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    document
      .querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([disabled])")
      .forEach((el) => {
        if (el.value) return;
        setter.call(el, el.type === "email" ? "audit@ocade.test" : "Audit Tester");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
  });
  await page.waitForTimeout(400);
  const next = page
    .locator("button", { hasText: /^(Continue|Next|Finish|Enter workspace)$/i })
    .first();
  if ((await next.count()) === 0) break;
  const label = (await next.textContent()).trim();
  await next.click({ timeout: 12000 }).catch(() => {});
  console.log(`  onboarding step ${step}: ${label}`);
  await page.waitForTimeout(1600);
}

const landed = new URL(page.url()).pathname;
if (landed === "/onboarding") {
  console.error("onboarding did not complete");
  await browser.close();
  process.exit(1);
}
console.log(`onboarding complete, landed on ${landed}`);
// Save the once-per-account welcome dismissal into the shared state. Without
// this, every later audit context opens the tour again, and a setup dialog that
// is still resolving can briefly prevent the ordinary Skip click from reaching
// it.
await page.waitForTimeout(500);
await clearModals();
await context.storageState({ path: OUT });
console.log(`storage state written to ${OUT}`);
await browser.close();
