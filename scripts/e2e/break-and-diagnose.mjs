/**
 * BREAK ONE PATH, AND SHOW THAT SOMEBODY COULD FIND OUT WHY.
 *
 * "It is observable" is the easiest claim in software to make and the hardest
 * to check, because nothing fails when it is false. So this breaks something
 * for real — an unhandled rejection on a real route in a real browser — and
 * then goes and looks at the screen a person would actually go and look at.
 *
 * It also proves the half that matters more than the log itself: that the
 * record is safe to hand to somebody. The thrown error deliberately carries an
 * email address, a session-shaped token and a Supabase key. All three must be
 * gone from the journal, from the copied text, and from the browser's storage.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const SECRETS = {
  email: "ada@example.com",
  token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZGEifQ.Zm9vYmFyYmF6cXV4Y29ycmdl",
  key: "sb_secret_abcdefghijklmnopqrstuv",
};

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-diag-")), {
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await ctx.newPage();
const r = {};

async function clearModals() {
  for (let round = 0; round < 6; round += 1) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let i = 0; i < (await boxes.count()); i += 1) {
      await boxes
        .nth(i)
        .click({ timeout: 4000 })
        .catch(() => {});
    }
    const button = dialog.getByRole("button", {
      name: /^(accept and continue|skip|done|finish|got it|close|continue)$/i,
    });
    if ((await button.count()) === 0) return;
    await button
      .first()
      .click({ timeout: 6000 })
      .catch(() => {});
    await page.waitForTimeout(400);
  }
}

/* ------------------------------------------------- nothing wrong yet ----- */
// Settings is readable signed out on purpose, so this needs no account.
await page.goto(`${BASE}/settings/diagnostics`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);
await clearModals();
r.diagnosticsReachable = (await page.getByText(/errors on this device/i).count()) > 0;
r.startsEmpty = (await page.getByText(/nothing has gone wrong/i).count()) > 0;

/* ------------------------------------------------------ break it --------- */
await page.evaluate(({ email, token, key }) => {
  // A genuine unhandled rejection: no test hook, no injected reporter. This
  // is the same path a failed fetch inside an event handler takes.
  Promise.reject(
    new Error(
      `Diagnostics probe failure for ${email} with ${token} and ${key} at /auth/callback?access_token=${token}`,
    ),
  );
}, SECRETS);
await page.waitForTimeout(1200);

/* ------------------------------- and now go and look, the way a person would */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await clearModals();

const body = await page.evaluate(() => document.body.innerText);
r.errorIsListed = /Diagnostics probe failure/.test(body);
r.whereIsNamed = /unhandled_rejection/.test(body);

const stored = await page.evaluate(() => localStorage.getItem("ocade.diagnostics.errors.v1") ?? "");
r.somethingWasStored = stored.length > 0;
r.storedEmail = stored.includes(SECRETS.email);
r.storedToken = stored.includes(SECRETS.token);
r.storedKey = stored.includes(SECRETS.key);
r.shownEmail = body.includes(SECRETS.email);
r.shownToken = body.includes(SECRETS.token);
r.shownKey = body.includes(SECRETS.key);

/* ----------------------------------------------- and it can be cleared --- */
const clear = page.getByRole("button", { name: /^clear$/i }).first();
r.clearOffered = await clear.isVisible().catch(() => false);
if (r.clearOffered) {
  await clear.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
}
r.clearedAfterwards =
  (await page.getByText(/nothing has gone wrong/i).count()) > 0 &&
  (await page.evaluate(() => localStorage.getItem("ocade.diagnostics.errors.v1"))) === null;

console.log(JSON.stringify(r, null, 2));
await ctx.close();

const failures = [];
const require_ = (ok, why) => {
  if (!ok) failures.push(why);
};

require_(r.diagnosticsReachable, "the diagnostics screen has no error journal on it");
require_(r.startsEmpty, "a fresh profile already had errors recorded");
require_(r.somethingWasStored, "a real unhandled rejection was not recorded at all");
require_(r.errorIsListed, "the failure was recorded but is not shown to the person");
require_(r.whereIsNamed, "the record does not say where the failure came from");
require_(!r.storedEmail, "an email address was written to storage");
require_(!r.storedToken, "a session token was written to storage");
require_(!r.storedKey, "an API key was written to storage");
require_(!r.shownEmail, "an email address is displayed on screen");
require_(!r.shownToken, "a session token is displayed on screen");
require_(!r.shownKey, "an API key is displayed on screen");
require_(r.clearOffered, "there is no way to clear the journal");
require_(r.clearedAfterwards, "clearing the journal left it behind");

if (failures.length) {
  console.error(`\nBREAK-AND-DIAGNOSE FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nbroke a path, found it on the diagnostics screen, and no secret survived");
