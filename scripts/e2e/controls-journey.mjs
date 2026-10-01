/**
 * THE SETTINGS CONTROLS NO OTHER JOURNEY PRESSES, PRESSED LIKE A PERSON WOULD.
 *
 * Appearance (theme, contrast, motion) that holds across a reload and another
 * device; a notification kind turned off and still off; the account export
 * downloaded and read back; a second sign-in of the same account found in the
 * list and signed out from here, its copied token then refused at the API; an
 * email change asked for; and Sign out on this device.
 *
 * Usage: node scripts/e2e/controls-journey.mjs [--base=…] [--supabase=…]
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}
async function until(condition, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await condition()) return true;
    } catch {
      /* not yet */
    }
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const EMAIL = `controls-${Date.now()}@ocade.test`;
const signIn = () =>
  fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone) Safari" },
    body: JSON.stringify({ email: EMAIL, password: "proof" }),
  }).then((r) => r.json());
const session = await signIn();

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const errors = [];
async function open(viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  await context.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    },
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  return page;
}
const settings = async (page, section) => {
  await page.goto(`${BASE}/?settings=${section}`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.waitFor();
  return dialog;
};
const htmlHas = (page, name) =>
  page.evaluate((cls) => document.documentElement.classList.contains(cls), name);

try {
  const page = await open();

  /* --- appearance ------------------------------------------------------------- */
  let dialog = await settings(page, "appearance");
  await dialog.getByRole("button", { name: "light", exact: true }).click();
  await dialog.getByRole("switch", { name: "High contrast" }).click();
  await dialog.getByRole("switch", { name: "Reduce motion" }).click();
  check(
    "theme, contrast and motion change the page at once",
    (await until(() => htmlHas(page, "light"))) &&
      (await htmlHas(page, "high-contrast")) &&
      (await htmlHas(page, "reduce-motion")),
  );
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  check(
    "and are still so after a reload",
    (await htmlHas(page, "light")) &&
      (await htmlHas(page, "high-contrast")) &&
      (await htmlHas(page, "reduce-motion")),
  );
  const other = await open({ width: 390, height: 844 });
  await other.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "and on another device, because they are the account's",
    await until(
      async () => (await htmlHas(other, "light")) && (await htmlHas(other, "high-contrast")),
    ),
  );
  dialog = await settings(page, "appearance");
  await dialog.getByRole("button", { name: "dark", exact: true }).click();
  await dialog.getByRole("switch", { name: "High contrast" }).click();
  await dialog.getByRole("switch", { name: "Reduce motion" }).click();
  check(
    "and back again",
    await until(
      async () =>
        !(await htmlHas(page, "light")) &&
        !(await htmlHas(page, "high-contrast")) &&
        !(await htmlHas(page, "reduce-motion")),
    ),
  );

  /* --- a notification kind ------------------------------------------------------ */
  dialog = await settings(page, "notifications");
  // The account's own choices load first; a press before that would be overwritten.
  await dialog.getByText("Security, account recovery and billing always reach you").waitFor();
  const results = dialog.getByRole("switch", { name: "JARVIS task results" });
  await results.click();
  check(
    "a notification kind turned off says it was saved to the account",
    await until(
      async () =>
        (await results.getAttribute("aria-checked")) === "false" &&
        (await dialog.getByText("Saved to your account.").count()) === 1,
    ),
  );
  dialog = await settings(page, "notifications");
  check(
    "and is still off when Settings opens again",
    await until(
      async () =>
        (await dialog
          .getByRole("switch", { name: "JARVIS task results" })
          .getAttribute("aria-checked")) === "false",
    ),
  );
  await dialog.getByRole("switch", { name: "JARVIS task results" }).click();

  /* --- the export ------------------------------------------------------------------ */
  dialog = await settings(page, "privacy");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
  const text = JSON.stringify(exported);
  check(
    "the account export downloads, and holds this account's data by kind",
    /^ocade-account-export-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()) &&
      text.includes(EMAIL) &&
      /jarvis|library|conversations/i.test(text),
    download.suggestedFilename(),
  );

  /* --- another sign-in of this account, signed out from here ------------------------ */
  const elsewhere = await signIn();
  dialog = await settings(page, "privacy");
  const rows = () => dialog.getByRole("button", { name: "Sign out", exact: true });
  check(
    "Advanced lists the other sign-in beside this device",
    await until(async () => (await rows().count()) >= 1),
    String(await rows().count()),
  );
  const before = await rows().count();
  await rows().first().click();
  check(
    "signing out one other session removes it from the list",
    await until(async () => (await rows().count()) === before - 1),
  );
  const copied = await fetch(`${SUPABASE}/rest/v1/rpc/ocade_staff_can`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${elsewhere.access_token}`,
    },
    body: JSON.stringify({ p_permission: "customers.read" }),
  });
  const mine = await fetch(`${SUPABASE}/rest/v1/rpc/ocade_staff_can`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ p_permission: "customers.read" }),
  });
  check(
    "its copied token is refused at the API, and this device's is not",
    copied.status === 401 && mine.status === 200,
    `${copied.status} ${mine.status}`,
  );
  const told = await fetch(`${SUPABASE}/__fixture/notifications`).then((r) => r.json());
  check(
    "and the account is told",
    told.some((row) => row.title === "A session was signed out" && row.user_id === session.user.id),
  );

  /* --- an email change, asked for ---------------------------------------------------- */
  dialog = await settings(page, "account");
  // Shown once the account has loaded.
  await dialog.getByRole("textbox", { name: "New email address" }).waitFor();
  await dialog.getByRole("textbox", { name: "New email address" }).fill(`new-${EMAIL}`);
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  check(
    "an email change says where to confirm it, and changes nothing yet",
    await until(async () => (await dialog.getByText(`Confirm at new-${EMAIL}`).count()) === 1),
    (await dialog.innerText()).split("Change your email")[1]?.slice(0, 200).replace(/\s+/g, " "),
  );

  check(
    "and the account's sections are each shown once afterwards",
    (await dialog.getByRole("textbox", { name: "New email address" }).count()) === 1 &&
      (await dialog.getByText("Two-step verification", { exact: true }).count()) === 1,
  );

  /* --- sign out here ----------------------------------------------------------------- */
  await dialog.getByRole("button", { name: "Sign out", exact: true }).last().click();
  check(
    "Sign out on this device leaves this browser signed out",
    await until(async () =>
      page.evaluate((key) => window.localStorage.getItem(key) === null, storageKey),
    ),
  );

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the controls journey runs", false, String(error).slice(0, 500));
} finally {
  await browser.close();
}

process.stdout.write(
  failures === 0 ? "\nControls journey passed.\n" : `\n${failures} controls checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
