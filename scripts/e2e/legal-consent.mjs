/**
 * The consent gate, driven for real.
 *
 * `LegalConsentGate` blocks the whole application until the terms are accepted
 * and the privacy notice acknowledged. The defect it had was not the gate — it
 * was that reading either document used `target="_blank"`, throwing the reader
 * into a new browser tab to read OCADE's own terms, and returning them to a
 * modal they had to find their place in again.
 *
 * Asserted here rather than in a render test because "does not open a new tab"
 * and "keeps the ticks you already made" are only observable in a real browser.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-legal-")), {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
const r = {};

await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

const boxes = page.locator('input[type="checkbox"]');
r.checkboxCount = await boxes.count();
r.startUnticked =
  (await boxes.nth(0).isChecked()) === false && (await boxes.nth(1).isChecked()) === false;

const accept = page.getByRole("button", { name: /accept and continue/i }).first();
r.acceptDisabledBeforeConsent = await accept.isDisabled().catch(() => null);

await boxes.nth(0).check();
await page.waitForTimeout(200);
r.stillDisabledWithOneTicked = await accept.isDisabled().catch(() => null);

/* Reading the terms must not open a new tab, and must not lose the tick. */
const tabsBefore = ctx.pages().length;
await page
  .getByRole("button", { name: /^terms of service$/i })
  .first()
  .click();
await page.waitForTimeout(900);
r.newTabsOpened = ctx.pages().length - tabsBefore;
r.stayedOnAuthRoute = new URL(page.url()).pathname === "/auth";

const dialogs = page.locator('[role="dialog"]');
const texts = await dialogs.allInnerTexts();
r.termsDialogOpened = texts.some((t) => /Terms of service/i.test(t));
r.dialogHasScrollRegion = await page.locator('[role="region"][aria-label*="content"]').count();

await page.keyboard.press("Escape");
await page.waitForTimeout(700);
const after = await page.locator('[role="region"][aria-label*="content"]').count();
r.escapeClosedLegalDialog = after === 0;
r.tickSurvivedReading = await boxes.nth(0).isChecked();

await boxes.nth(1).check();
await page.waitForTimeout(200);
r.enabledWithBothTicked = (await accept.isDisabled().catch(() => true)) === false;

await accept.click();
await page.waitForTimeout(1500);
/*
 * The gate clearing is proved by the sign-in METHODS becoming reachable, not
 * by an email input existing: the default method is Google, and the email
 * field only appears after choosing Email. Asserting on the input reported a
 * cleared gate as still-blocking.
 */
r.gateClearedAfterAccept =
  (await page.locator('input[type="checkbox"]').count()) === 0 &&
  (await page.locator("button", { hasText: /^Email$/ }).count()) > 0;

await page
  .locator("button", { hasText: /^Email$/ })
  .first()
  .click();
await page.waitForTimeout(1000);
r.emailFieldReachable = (await page.locator('input[type="email"]').count()) > 0;

console.log(JSON.stringify(r, null, 2));
await ctx.close();
const ok =
  r.startUnticked &&
  r.acceptDisabledBeforeConsent === true &&
  r.stillDisabledWithOneTicked === true &&
  r.newTabsOpened === 0 &&
  r.stayedOnAuthRoute &&
  r.termsDialogOpened &&
  r.escapeClosedLegalDialog &&
  r.tickSurvivedReading &&
  r.enabledWithBothTicked &&
  r.gateClearedAfterAccept &&
  r.emailFieldReachable;
process.exit(ok ? 0 : 1);
