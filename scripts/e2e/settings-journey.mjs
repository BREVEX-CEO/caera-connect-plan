/**
 * Settings and Data Controls, proved in a real browser.
 *
 * `PLAN.md` Phase 9's gate has two halves: account-scoped settings survive a
 * refresh and a device change, and no raw secret, model or runtime identifier
 * is exposed. Both are browser questions, so both are asked here.
 *
 * THE DEVICE CHANGE IS A SECOND BROWSER CONTEXT, not a second machine — a fresh
 * context has its own storage and its own service worker, which is the part
 * that could carry a preference across by accident. If the setting is still
 * there, it came from the account.
 *
 * WHAT IS PROVEN ELSEWHERE. That protected categories cannot be muted, that
 * quiet hours never hold a security alert and that a stale stored preference
 * cannot silence one — `notification-preferences.test.ts`, against the rules
 * themselves. This proves the screen carries them faithfully.
 *
 * Usage: node scripts/e2e/settings-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const CATEGORY_NAMES = [
  "Account",
  "Appearance",
  "Notifications",
  "Privacy & Security",
  "Billing & Usage",
];

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `settings-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

/** Never on a customer's screen: the engine, the model, the vendor, the keys. */
const FORBIDDEN =
  /qwen|gguf|wllama|webassembly|webgpu|gemini|google ?ai|generativelanguage|api[_ -]?key|service[_ -]?role|supabase|paddle|sb_secret/i;

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

async function signedInContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* A failed write shows up as a signed-out shell on the first check. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  return context;
}

async function openSettings(page, category) {
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: category, exact: true }).click();
}

try {
  const context = await signedInContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  /* --- the six categories PLAN.md names ----------------------------------- */

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const categories = await dialog.locator("nav button").allInnerTexts();
  check(
    "Settings offers exactly the five categories the design system names",
    categories.join("|") === "Account|Appearance|Notifications|Privacy & Security|Billing & Usage",
    categories.join("|"),
  );

  /* --- Account ------------------------------------------------------------ */

  await page.getByRole("button", { name: "Account", exact: true }).click();
  check("Account says who is signed in", (await dialog.innerText()).includes(EMAIL));
  check(
    "and offers to change the email without claiming it has changed",
    (await page.getByLabel("New email address").count()) === 1 &&
      (await dialog.innerText()).includes("has not changed yet") === false,
  );
  check(
    "deleting the account is typed, not clicked",
    (await page.getByRole("button", { name: "Delete", exact: true }).count()) === 1,
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  check(
    "and asks for the exact phrase",
    (await page.getByLabel("Type DELETE MY ACCOUNT to confirm").count()) === 1,
  );
  await page.getByRole("button", { name: "Keep" }).click();

  /* --- Notifications: a choice that reaches the account -------------------- */

  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await page.waitForSelector("text=Optional notifications", { timeout: 15_000 });
  check(
    "security and account recovery are shown as always on",
    (await dialog.getByText("Always on").count()) === 2,
  );

  await dialog.getByRole("switch", { name: "Quiet hours" }).click();
  await page.waitForSelector("text=Saved to your account", { timeout: 15_000 });
  check("changing a setting says where it got to", true);

  /* --- it survives a refresh, and another device --------------------------- */

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await openSettings(page, "Notifications");
  await page.waitForSelector("text=Held between", { timeout: 15_000 });
  check("the setting is still there after a refresh", true);
  await page.keyboard.press("Escape");

  const second = await signedInContext();
  const otherDevice = await second.newPage();
  await otherDevice.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await openSettings(otherDevice, "Notifications");
  await otherDevice.waitForSelector("text=Held between", { timeout: 15_000 });
  check("and on another device, because it is the account's rather than the browser's", true);
  await second.close();

  /* --- Data Controls ------------------------------------------------------- */

  await openSettings(page, "Privacy & Security");
  const data = await dialog.innerText();
  check(
    "Data Controls covers conversations, Library, an export and Offline Intelligence",
    ["Conversations", "Library", "Export your data", "Offline Intelligence"].every((label) =>
      data.includes(label),
    ),
    data.split("\n").slice(0, 3).join(" / "),
  );

  /* --- Advanced ------------------------------------------------------------ */

  await page.getByRole("button", { name: "Privacy & Security", exact: true }).click();
  // The list is a server read; waiting for the heading only proves the section
  // mounted, not that the sessions arrived.
  await page.waitForSelector("text=this device", { timeout: 15_000 });
  const advanced = await dialog.innerText();
  check("Advanced shows where the account is signed in", /this device/i.test(advanced));
  check(
    "and offers to end the other sessions",
    (await page.getByRole("button", { name: "Sign out everywhere else" }).count()) === 1,
  );
  check(
    "without naming an engine, a model, a provider or a key",
    !FORBIDDEN.test(advanced),
    (FORBIDDEN.exec(advanced) ?? [""])[0],
  );

  /* --- and nothing anywhere in Settings names one -------------------------- */

  for (const category of [
    "Account",
    "Appearance",
    "Notifications",
    "Privacy & Security",
    "Billing & Usage",
  ]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await page.waitForTimeout(400);
    const text = await dialog.innerText();
    check(
      `${category} exposes no secret, model or runtime identifier`,
      !FORBIDDEN.test(text),
      (FORBIDDEN.exec(text) ?? [""])[0],
    );
  }

  /* --- every category is reachable on a phone and a tablet ---------------- */

  /*
   * `PLAN.md` Phase 10 asks for Settings exercised on representative desktop,
   * tablet and phone viewports. The desktop panel is a two-column dialog; on a
   * phone it is a full-height sheet whose category list scrolls above the
   * content. A category that cannot be reached, or a panel that scrolls
   * sideways, is a control that does not exist on the device most people use.
   */
  for (const [label, width, height] of [
    ["tablet", 820, 1180],
    ["phone", 375, 812],
  ]) {
    const small = await signedInContext();
    const view = await small.newPage();
    await view.setViewportSize({ width, height });
    await view.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // On a phone the sidebar is a drawer, so the account menu is not on screen
    // until it is opened. On a tablet it is already there.
    const drawer = view.locator('button[aria-label="Open navigation"]');
    if (await drawer.isVisible().catch(() => false)) await drawer.click();
    // Two asides exist at phone width — the drawer and the one behind it — so
    // the visible one is the only one a person could press.
    await view.locator('aside button[aria-haspopup="menu"]:visible').first().click();
    await view.getByRole("menuitem", { name: "Settings" }).click();

    let reachable = 0;
    for (const category of CATEGORY_NAMES) {
      const button = view.getByRole("button", { name: category, exact: true });
      if ((await button.count()) === 0) continue;
      await button.click();
      await view.waitForTimeout(250);
      reachable += 1;
    }
    check(
      `every Settings category is reachable at ${label} width`,
      reachable === CATEGORY_NAMES.length,
      `${reachable} of ${CATEGORY_NAMES.length}`,
    );
    check(
      `Settings does not scroll sideways at ${label} width`,
      await view.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );
    await small.close();
  }

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
