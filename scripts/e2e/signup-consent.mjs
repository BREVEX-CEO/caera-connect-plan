/**
 * THE SIGN-UP PATH, AFTER THE CONSENT GATE.
 *
 * `legal-consent.mjs` proves the gate itself: two boxes, both required, the
 * legal text readable without losing a tick, and no way past it. This proves
 * the half that comes after — that having accepted, a NEW visitor can actually
 * reach account creation, and that the create control is the one for signing
 * up rather than the one for signing in.
 *
 * WHY THIS WAS REWRITTEN. The previous version went straight to /auth and
 * looked for a "Create account" button with consent checkboxes beside it. That
 * screen no longer exists: consent is a modal shown before the form, and the
 * form starts on "I have an account". So the probe typed into fields behind a
 * dialog, found the dialog's own checkboxes, and reported a product failure
 * that was entirely its own. A probe written against a screen that has been
 * replaced does not fail loudly — it fails plausibly, which is worse.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-signup-")), {
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
const r = {};

await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

/* ---------------------------------------------------- the gate is there -- */
const dialog = page.locator("[role=dialog], [role=alertdialog]").first();
r.consentGateShown = await dialog.isVisible().catch(() => false);

const boxes = dialog.locator('input[type="checkbox"], [role=checkbox]');
r.consentBoxes = await boxes.count();

const accept = dialog.getByRole("button", { name: /accept and continue/i }).first();
r.acceptDisabledBeforeConsent = await accept.isDisabled().catch(() => null);

for (let i = 0; i < r.consentBoxes; i += 1) {
  await boxes
    .nth(i)
    .click({ timeout: 5000 })
    .catch(() => {});
}
await page.waitForTimeout(300);
r.acceptEnabledAfterConsent = (await accept.isDisabled().catch(() => true)) === false;
await accept.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1000);
r.gateCleared = !(await dialog.isVisible().catch(() => false));

/* ------------------------------------------- and then signing up works -- */
/*
 * `role="radio"`, not a button. The two intent controls are a radiogroup on
 * purpose — they are a choice, not an action — so asking for a button by that
 * name finds nothing and the probe carries on in the wrong mode.
 */
const newHere = page.getByRole("radio", { name: /i am new here/i }).first();
r.signupChoiceOffered = await newHere.isVisible().catch(() => false);
if (r.signupChoiceOffered) await newHere.click({ timeout: 8000 });
await page.waitForTimeout(500);

const emailChoice = page.locator("button", { hasText: /^Email$/ }).first();
if (await emailChoice.isVisible().catch(() => false)) {
  await emailChoice.click({ timeout: 8000 });
  await page.waitForTimeout(400);
}

const email = page.locator("#email");
const password = page.locator("#password");
r.emailFieldReachable = await email.isVisible().catch(() => false);
r.passwordFieldReachable = await password.isVisible().catch(() => false);
if (r.emailFieldReachable) await email.fill("proof@example.test");
if (r.passwordFieldReachable) await password.fill("a-real-password-123");
await page.waitForTimeout(400);

/*
 * The label is what tells the visitor which thing they are about to do, and
 * choosing "I am new here" has to change it. A screen that says "Sign in"
 * after somebody said they have no account is how people end up believing
 * they already have one.
 */
const createButton = page.getByRole("button", { name: /^create account$/i }).first();
r.createAccountOffered = await createButton.isVisible().catch(() => false);
r.createAccountEnabled = (await createButton.isDisabled().catch(() => true)) === false;

/*
 * A DISABLED PRIMARY ACTION MUST SAY WHY.
 *
 * Account creation is gated on verified production mail delivery — a real
 * dependency this environment does not have, and refusing rather than sending
 * a confirmation nobody receives is the right behaviour. What would NOT be
 * right is a dimmed button and no explanation, which reads as a broken page.
 * So the assertion is: enabled, or disabled with a visible reason.
 */
const status = await page
  .locator("[role=status]")
  .allTextContents()
  .catch(() => []);
r.disabledReasonShown = status.some((text) => /mail delivery|new email accounts/i.test(text));
r.createAccountUsableOrExplained = r.createAccountEnabled || r.disabledReasonShown;
/*
 * The submit control, not the intent control — the intent one is a radio and
 * keeps its own label. There must be no button still offering to sign in.
 */
r.signInButtonAbsent =
  (await page.getByRole("button", { name: /^sign in$/i }).count()) === 0;
r.stayedOnAuthRoute = new URL(page.url()).pathname === "/auth";

console.log(JSON.stringify(r, null, 2));
await ctx.close();

const ok =
  r.consentGateShown &&
  r.consentBoxes >= 2 &&
  r.acceptDisabledBeforeConsent === true &&
  r.acceptEnabledAfterConsent &&
  r.gateCleared &&
  r.signupChoiceOffered &&
  r.emailFieldReachable &&
  r.passwordFieldReachable &&
  r.createAccountOffered &&
  r.createAccountUsableOrExplained &&
  r.signInButtonAbsent &&
  r.stayedOnAuthRoute;

if (!ok) console.error("SIGN-UP AFTER CONSENT FAILED");
process.exit(ok ? 0 : 1);
