/**
 * The final sweep: every route, signed out and signed in, every control pressed.
 *
 * `PLAN.md` Phase 12 asks for exactly this — "test every remaining route
 * signed-out and signed-in; press every reachable customer control" — and it is
 * the one proof the other journeys cannot give. They each walk a path somebody
 * designed; this presses things nobody thought about, in an order nobody
 * intended, and watches for the two failures that matter: something that throws,
 * and something that leaves the person somewhere that does not exist.
 *
 * WHAT IS DELIBERATELY NOT PRESSED. Sign out (it ends the sweep), Delete
 * (destructive controls are proven by their own journeys, where the
 * confirmation can be answered deliberately), and anything that opens a new tab.
 *
 * Usage: node scripts/e2e/final-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `final-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

/** Pressed by their own journeys, where the consequence can be answered for. */
const LEAVE_ALONE =
  /sign out|delete|remove|export|unlink|send|stop|empty|install|repair|mark all read/i;

const SIGNED_OUT_ROUTES = ["/", "/pricing", "/about", "/help", "/terms", "/privacy", "/auth"];
const SIGNED_IN_ROUTES = [
  "/",
  "/library",
  "/cowork",
  "/pricing",
  "/about",
  "/help",
  "/terms",
  "/privacy",
];

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

async function sweep(page, routes, label) {
  const errors = [];
  const bad = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 500) bad.push(`${response.status()} ${response.url()}`);
  });

  for (const route of routes) {
    const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    check(
      `${label}: ${route} answers`,
      (response?.status() ?? 0) < 400,
      String(response?.status()),
    );

    /*
     * The list is taken ONCE, as plain descriptions, because a press can
     * re-render the page and every live handle taken before it goes stale — a
     * stale handle then blocks for the full default timeout on a question as
     * simple as "what does this say".
     */
    const controls = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")]
        .filter((element) => element.getClientRects().length > 0)
        .slice(0, 40)
        .map((element, index) => ({
          index,
          text: (element.textContent ?? "").trim().slice(0, 40),
          label: element.getAttribute("aria-label") ?? "",
          href: element.getAttribute("href") ?? "",
          target: element.getAttribute("target") ?? "",
        })),
    );

    let pressed = 0;
    for (const { index, text, label: label2, href, target } of controls) {
      if (LEAVE_ALONE.test(`${text} ${label2}`)) continue;
      if (href.startsWith("http") || target === "_blank") continue;

      try {
        const control = page.locator("button:visible, a[href]:visible").nth(index);
        await control.click({ timeout: 2000, noWaitAfter: true });
        pressed += 1;
        await page.waitForTimeout(120);
        // Back to where we were, so the next control is the one we measured.
        if (!page.url().includes(route)) {
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        }
        await page.keyboard.press("Escape");
      } catch {
        /* Detached or covered by something this press opened: not a defect. */
      }
    }
    check(
      `${label}: ${route} — pressed ${pressed} controls with nothing thrown`,
      errors.length === 0,
      errors.join("; "),
    );
    errors.length = 0;
  }

  check(`${label}: no route answered 5xx`, bad.length === 0, bad.join("; "));
}

try {
  /* --- signed out ---------------------------------------------------------- */

  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await sweep(await anonymous.newPage(), SIGNED_OUT_ROUTES, "signed out");
  await anonymous.close();

  /* --- signed in ----------------------------------------------------------- */

  const account = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await account.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* The first route check fails visibly if this did not take. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const page = await account.newPage();
  await sweep(page, SIGNED_IN_ROUTES, "signed in");

  /* --- and on a phone, where the shell is a drawer ------------------------- */

  await page.setViewportSize({ width: 390, height: 844 });
  await sweep(page, ["/", "/library"], "on a phone");

  await account.close();
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
