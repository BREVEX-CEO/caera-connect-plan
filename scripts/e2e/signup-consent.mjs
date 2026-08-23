/**
 * The consent gate and the in-site legal dialog, driven for real.
 *
 * Asserted here rather than in a render test because the properties that
 * matter are behavioural: that Create account is genuinely unreachable until
 * both boxes are ticked, and that opening the terms does NOT cost the person
 * what they typed — which is precisely what the old `<Link>` did.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-signup-")), {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
const r = {};

await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);

// Type an email and password so the create-account path appears.
const email = page.locator('input[type="email"]').first();
await email.fill("proof@example.test");
const pw = page.locator('input[type="password"]').first();
r.passwordFieldFound = (await pw.count()) > 0;
if (r.passwordFieldFound) await pw.fill("a-real-password-123");
await page.waitForTimeout(600);

const createBtn = page.getByRole("button", { name: /create account/i }).first();
r.createButtonVisible = await createBtn.isVisible().catch(() => false);
r.createDisabledBeforeConsent = await createBtn.isDisabled().catch(() => null);

const boxes = page.locator('input[type="checkbox"]');
r.checkboxCount = await boxes.count();
r.checkboxesStartUnticked =
  (await boxes
    .nth(0)
    .isChecked()
    .catch(() => true)) === false &&
  (await boxes
    .nth(1)
    .isChecked()
    .catch(() => true)) === false;

// Tick only one — still blocked.
await boxes.nth(0).check();
await page.waitForTimeout(250);
r.stillDisabledWithOneTicked = await createBtn.isDisabled().catch(() => null);

// Open the terms from inside the form and confirm nothing typed is lost.
await page
  .getByRole("button", { name: /^terms of service$/i })
  .first()
  .click();
await page.waitForTimeout(900);
const dialog = page.locator('[role="dialog"]').first();
r.dialogOpened = await dialog.isVisible().catch(() => false);
r.dialogHasTitle = (await dialog.innerText().catch(() => "")).includes("Terms of service");
r.dialogScrollableRegion = await page
  .locator('[role="region"][aria-label*="content"]')
  .count()
  .catch(() => 0);
r.stayedOnAuthRoute = new URL(page.url()).pathname === "/auth";

// Escape closes it.
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
r.escapeClosesDialog = !(await dialog.isVisible().catch(() => false));

// The typed values survived, which is the whole point.
r.emailPreserved = (await email.inputValue()) === "proof@example.test";
r.passwordPreserved = (await pw.inputValue()) === "a-real-password-123";
r.consentPreserved = await boxes.nth(0).isChecked();

// Tick the second — now enabled.
await boxes.nth(1).check();
await page.waitForTimeout(250);
r.enabledWithBothTicked = (await createBtn.isDisabled().catch(() => true)) === false;

console.log(JSON.stringify(r, null, 2));
await ctx.close();
const ok =
  r.createDisabledBeforeConsent === true &&
  r.checkboxesStartUnticked &&
  r.stillDisabledWithOneTicked === true &&
  r.dialogOpened &&
  r.escapeClosesDialog &&
  r.emailPreserved &&
  r.passwordPreserved &&
  r.enabledWithBothTicked;
process.exit(ok ? 0 : 1);
