/**
 * What OCADE costs, proved in a real browser.
 *
 * `/pricing` is PUBLIC, so the first thing this proves is that somebody with no
 * account can read it. Then the two controls that decide what a person sees —
 * the weekly/monthly toggle and the currency selector — and then the one
 * property that matters most about a pricing page: that the numbers on it are
 * the numbers the product enforces, not a second copy that drifted.
 *
 * WHAT IT DELIBERATELY DOES NOT PROVE: a completed purchase. OCADE has no
 * payment provider configured, so this asserts the honest sentence rather than
 * a checkout that does not exist. A test that pretended otherwise would be the
 * same lie as a button that pretended otherwise.
 *
 * Usage: node scripts/e2e/pricing-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `pricing-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  /* --- signed out: anybody can read it ------------------------------------ */

  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await anonymous.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  const response = await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
  check("pricing opens without an account", response?.status() === 200, `${response?.status()}`);

  for (const tier of ["free", "pro", "max"]) {
    check(
      `${tier} is on the page`,
      (await page.locator(`section[aria-labelledby="plan-${tier}"]`).count()) === 1,
    );
  }

  /* --- the approved catalogue, exactly ------------------------------------ */

  // Region detection follows the host timezone; choose the currency being asserted.
  await page.selectOption("select", "USD");

  const price = (tier) =>
    page.locator(`section[aria-labelledby="plan-${tier}"] span.text-\\[28px\\]`).innerText();

  check("Free is free", (await price("free")) === "Free", await price("free"));
  check("Pro is $28 a month", (await price("pro")) === "$28", await price("pro"));
  check("Max is $88 a month", (await price("max")) === "$88", await price("max"));

  await page.getByRole("button", { name: "weekly" }).click();
  check("Pro weekly is $8", (await price("pro")) === "$8", await price("pro"));
  check("Max weekly is $28", (await price("max")) === "$28", await price("max"));
  check("Free has no cadence to switch", (await price("free")) === "Free", await price("free"));

  /* --- currency is a choice, not an assumption ---------------------------- */

  await page.selectOption("select", "INR");
  check("Pro weekly in rupees is ₹288", (await price("pro")).includes("288"), await price("pro"));
  await page.getByRole("button", { name: "monthly" }).click();
  check(
    "Max monthly in rupees is ₹5,888",
    (await price("max")).includes("5,888"),
    await price("max"),
  );
  await page.selectOption("select", "GBP");
  check("and pounds are pounds", (await price("max")).startsWith("£"), await price("max"));

  /* --- the allowance sold is the allowance enforced ----------------------- */

  const body = await page.locator("main").innerText();
  check("Free is sold as 28 questions a window", body.includes("28 questions every 6 hours 28"));
  check(
    "Pro is sold as 140 and 700",
    body.includes("140 questions") && body.includes("700 questions"),
  );
  check(
    "Max is sold as ten times Pro",
    body.includes("1,400 questions") && body.includes("7,000 questions"),
    body.split("\n").find((line) => /questions every/.test(line) && /1,?400/.test(line)) ?? "",
  );

  /* --- nothing is pretended ----------------------------------------------- */

  check(
    "paid plans are described as not open, with nothing charged",
    /paid plans are not open yet, and nothing is charged/i.test(body),
  );
  check(
    "a signed-out visitor is asked to make an account rather than to pay",
    (await page.getByRole("link", { name: "Create an account" }).count()) >= 1,
  );

  /* --- signed in: the page knows which plan you are on -------------------- */

  const signedIn = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await signedIn.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const member = await signedIn.newPage();
  member.on("pageerror", (error) => pageErrors.push(String(error)));
  await member.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
  await member.waitForSelector("text=Your plan", { timeout: 15_000 });

  const free = member.locator('section[aria-labelledby="plan-free"]');
  check("a free account is told Free is its plan", (await free.innerText()).includes("Your plan"));
  const pro = await member.locator('section[aria-labelledby="plan-pro"]').innerText();
  check(
    "and told the truth about paid plans rather than offered a checkout that cannot work",
    pro.includes("not open yet"),
    pro.split("\n").pop() ?? "",
  );

  /* --- the way to the plans, from where a person meets the limit ---------- */

  await member.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await member.click('aside button[aria-haspopup="menu"]');
  await member.getByRole("menuitem", { name: "Settings" }).click();
  await member.getByRole("button", { name: "Billing & Usage" }).click();
  await member.getByRole("link", { name: "See plans" }).click();
  await member.waitForURL(/\/pricing$/, { timeout: 15_000 });
  check("Billing leads to the plans", member.url().endsWith("/pricing"));

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
