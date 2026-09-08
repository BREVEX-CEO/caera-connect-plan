/**
 * Signing in, and getting past whatever stands in front of the form.
 *
 * EXTRACTED AFTER THE THIRD COPY WENT WRONG. Each journey that needs a second
 * account grew its own version of these two steps, and each one rediscovered
 * the same two facts the hard way: the legal-consent dialog is modal and
 * intercepts every click until it is answered, and the sign-in page opens on
 * whichever method the deployment lists first, which is not necessarily the
 * one with an email field. A journey that misses either fails with a timeout
 * that says nothing about the product.
 */

/**
 * Clear whatever consent or welcome dialog is in the way.
 *
 * Waiting it out is not an option — it is modal on purpose — and clicking
 * through it is what a person does, so the journey does the same.
 */
export async function clearModals(page, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
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

/**
 * Fill the email/password form and press Sign in.
 *
 * Not by writing a session into localStorage. Standing up a fake session to
 * walk past an auth gate teaches the wrong thing and proves less — a state only
 * exists here if the real flow genuinely works.
 */
export async function signInWithPassword(page, { email, password, baseUrl } = {}) {
  // The caller navigates when it has a reason to (an invitation link carries a
  // `next`); otherwise this goes to the sign-in page itself.
  if (baseUrl) {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await page.waitForTimeout(1200);
  await clearModals(page);

  const emailTab = page.locator("button", { hasText: /^Email$/ });
  if ((await emailTab.count()) > 0) {
    await emailTab
      .first()
      .click({ timeout: 15000 })
      .catch(() => {});
  }
  await page.waitForTimeout(600);
  await clearModals(page);

  if ((await page.locator("#email").count()) === 0) {
    const shown = (await page.locator("body").innerText()).slice(0, 300).replace(/\s+/g, " ");
    throw new Error(`no sign-in form at ${page.url()} — page said: ${shown}`);
  }

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.waitForTimeout(300);
  await page
    .locator("button", { hasText: /^Sign in$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await clearModals(page);
}
