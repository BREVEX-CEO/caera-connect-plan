/**
 * Administration, proved in a real browser: a customer never reaches it, an
 * operator finds an account and its JARVIS devices, and removing one needs a
 * second factor and a reason before anything changes.
 *
 * The database function's own refusals, key removal and audit record are
 * proven against real PostgreSQL in `admin-device-removal.test.ts`.
 *
 * Usage: node scripts/e2e/admin-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const stamp = Date.now();
const signIn = (email) =>
  fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "proof" }),
  }).then((response) => response.json());

const customer = await signIn(`customer-${stamp}@ocade.test`);
const device = await fetch(`${SUPABASE}/rest/v1/jarvis_devices`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${customer.access_token}`,
    prefer: "return=representation",
  },
  body: JSON.stringify({ name: `Office PC ${stamp}`, platform: "Windows" }),
}).then((response) => response.json());
const deviceId = device[0].id;

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const errors = [];

async function open(session, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));
  return page;
}

async function devicesFor(page) {
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Administration" }).waitFor({ timeout: 20_000 });
  await page.getByPlaceholder("Search by email, name or account id").fill(`customer-${stamp}`);
  const row = page.locator("li", { hasText: `customer-${stamp}@ocade.test` });
  await row.getByRole("button", { name: "Devices", exact: true }).click();
  await row.getByText(`Office PC ${stamp}`).waitFor({ timeout: 10_000 });
  return row;
}

try {
  /* --- a customer who guesses the URL lands back in Chat ------------------- */
  const person = await open(customer);
  await person.goto(`${BASE}/admin`, { waitUntil: "load" });
  await person.waitForTimeout(2500);
  check(
    "a customer opening /admin is returned to Chat, told nothing",
    new URL(person.url()).pathname === "/" &&
      (await person.getByRole("heading", { name: "Administration" }).count()) === 0,
  );

  /* --- an operator without a second factor is refused by the function ------ */
  const plain = await open(await signIn(`admin-${stamp}@ocade.test`));
  const row = await devicesFor(plain);
  check("the operator sees the customer's device", true);
  const remove = row.getByRole("button", { name: "Remove", exact: true });
  check("Remove waits for a reason", await remove.isDisabled());
  await row.getByPlaceholder(/Why a device is being removed/).fill("short");
  check("a reason under ten characters is not enough", await remove.isDisabled());
  await row.getByPlaceholder(/Why a device is being removed/).fill("customer reported it stolen");
  await remove.click();
  check(
    "without a second factor the removal is refused, in words",
    await plain
      .getByText("Removing a device needs a recent second factor.")
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  check("and the device is still there", (await row.getByText("Removed").count()) === 0);

  /* --- with a second factor it is removed, on a phone-sized screen too ----- */
  const strong = await open(await signIn(`admin+mfa-${stamp}@ocade.test`), {
    width: 390,
    height: 844,
  });
  const strongRow = await devicesFor(strong);
  await strongRow
    .getByPlaceholder(/Why a device is being removed/)
    .fill("customer reported it stolen");
  await strongRow.getByRole("button", { name: "Remove", exact: true }).click();
  check(
    "with a second factor and a reason the device is removed",
    await strongRow
      .getByText("Removed", { exact: true })
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  check(
    "no horizontal overflow on a phone",
    (await strong.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
  );
  const stored = await fetch(
    `${SUPABASE}/rest/v1/jarvis_devices?id=eq.${deviceId}&select=revoked_at,public_key`,
  ).then((response) => response.json());
  check("the device's key is gone on the server", Boolean(stored[0]?.revoked_at));
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the admin journey runs", false, String(error).slice(0, 300));
} finally {
  await browser.close();
}

process.stdout.write(
  failures === 0 ? "\nAdmin journey passed.\n" : `\n${failures} admin checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
