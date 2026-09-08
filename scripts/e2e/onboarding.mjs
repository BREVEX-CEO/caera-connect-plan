/**
 * Answer the onboarding steps the way a person would, in whatever browser.
 *
 * EXTRACTED BECAUSE A SECOND COPY WENT WRONG IMMEDIATELY. The organization
 * journey needs a second account to reach the product, so it grew its own
 * "press Continue five times" loop — which pressed a Continue that is disabled
 * until the step has been answered, and hung. The working version fills the
 * step's fields FIRST, and that detail is exactly the kind that does not
 * survive being retyped.
 *
 * The fill is deliberately blunt: any empty, enabled text input gets a
 * plausible value. Onboarding asks different questions in different builds, and
 * a walker that knew each one would break every time a question changed —
 * which would report as a broken product rather than as a stale script.
 */

/**
 * @param page a Playwright page sitting on /onboarding
 * @param options.email the address to type into any email field
 * @param options.log where to report each step, or null for silence
 * @returns the path the browser landed on when onboarding finished
 */
export async function completeOnboarding(page, { email, log = console.log } = {}) {
  for (let step = 1; step <= 8; step += 1) {
    if (new URL(page.url()).pathname !== "/onboarding") break;
    await page.evaluate((address) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      document
        .querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([disabled])")
        .forEach((el) => {
          if (el.value) return;
          setter.call(el, el.type === "email" ? address : "Audit Tester");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }, email);
    await page.waitForTimeout(400);
    const next = page
      .locator("button", { hasText: /^(Continue|Next|Finish|Enter workspace)$/i })
      .first();
    if ((await next.count()) === 0) break;
    const label = (await next.textContent()).trim();
    await next.click({ timeout: 12000 }).catch(() => {});
    log?.(`  onboarding step ${step}: ${label}`);
    await page.waitForTimeout(1600);
  }
  return new URL(page.url()).pathname;
}
