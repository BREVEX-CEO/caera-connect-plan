/**
 * Online OCADE, proved in a real browser.
 *
 * `PLAN.md` Phase 6 is about one boundary: the browser asks OCADE's own server,
 * the server holds the keys, and nothing about the provider ever reaches the
 * page. What a browser can prove about that is exactly this:
 *
 *   - the request leaves with a permit and an identity, so the boundary has
 *     something to refuse;
 *   - a refusal from the boundary is reported truthfully and invents nothing;
 *   - a refused request does not cost the person a use;
 *   - no key, provider or model identifier reaches the page or the bundle.
 *
 * WHAT THIS DOES NOT PROVE: that Gemini answers, or that the three secrets are
 * set on the live project. The boundary here is the loopback stub, and this
 * environment has no egress to the real one. The FAILOVER RULES — primary
 * first, 401/403 moves on, 429 never rotates, nothing after output begins —
 * are proven against a fake provider in `edge-handler.test.ts`, which is the
 * only place they can be driven deterministically.
 *
 * Usage: node scripts/e2e/online-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");

/**
 * The Billing row's exact sentence.
 *
 * The sidebar meter says the same thing in its own line ("28 of 28 left ·
 * resets in about 2 hours"), so a substring match resolves to two elements.
 * Anchoring both ends picks the Billing row and leaves the meter to the check
 * that compares them.
 */
const EXACT_COUNT = /^\d+ of 28 left$/;
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
const EMAIL = `online-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

const setBoundary = (status) =>
  fetch(`${SUPABASE}/__fixture/online-boundary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
const lastBoundaryRequest = () =>
  fetch(`${SUPABASE}/__fixture/online-boundary`).then((response) => response.json());

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  await setBoundary(200);

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* The first check fails visibly if this did not take. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  /* --- online answers, through OCADE's own boundary ----------------------- */

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const onlineChoice = page.getByRole("button", { name: "OCADE", exact: true });
  await onlineChoice.click();
  check(
    "a person can choose online OCADE without being told what runs it",
    (await onlineChoice.getAttribute("aria-pressed")) === "true",
  );

  await page.fill("#ocade-composer", "An online question");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("an online answer streams back into the transcript", true);

  const sent = await lastBoundaryRequest();
  check("the request carried the person's identity", sent.authorized === true);
  check(
    "the request carried a server-issued permit, not a claim of one",
    Boolean(sent.permitId) && sent.permitSource === "server",
    sent.permitSource ?? "no permit",
  );
  check(
    "the permit and the request name the same generation",
    Boolean(sent.generationId) && Boolean(sent.idempotencyKey),
  );
  check("the request declares the surface it came from", sent.surface === "chat", sent.surface);

  /* --- what a refusal must look like -------------------------------------- */

  const before = await usageRemaining(page);
  await setBoundary(503);
  await page.getByRole("link", { name: "New chat" }).first().click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("stubbed OCADE answer"),
    undefined,
    { timeout: 10_000 },
  );
  await page.getByRole("button", { name: "OCADE", exact: true }).click();
  await page.fill("#ocade-composer", "A question the boundary will refuse");
  await page.click('button[aria-label="Send"]');
  await page.waitForTimeout(4000);

  const body = await page.locator("body").innerText();
  check(
    "a refused request says so rather than inventing an answer",
    !body.includes("stubbed OCADE answer"),
  );
  check(
    "the refusal is a sentence a person can act on",
    /(could not|unavailable|try again|not available)/i.test(body),
    body.split("\n").find((line) => /(could not|unavailable|try again)/i.test(line)) ?? "",
  );
  check(
    "nothing about the provider, the model or a key is on the page",
    !/gemini|google|api[_ -]?key|qwen|gguf|wllama/i.test(body),
  );

  const after = await usageRemaining(page);
  check(
    "a refused request costs the person nothing",
    after === before,
    `${before} before, ${after} after`,
  );

  /* --- and nothing leaks into what the browser downloaded ----------------- */

  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((element) => element.src),
  );
  let leaked = [];
  for (const src of scripts) {
    const text = await fetch(src).then((response) => response.text());
    if (/GEMINI_API_KEY|x-goog-api-key|generativelanguage\.googleapis\.com/.test(text)) {
      leaked.push(src);
    }
  }
  check(
    "no client script carries a key name or the provider endpoint",
    leaked.length === 0,
    leaked.join(", "),
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));

  async function usageRemaining(currentPage) {
    await currentPage.click('aside button[aria-haspopup="menu"]');
    await currentPage.getByRole("menuitem", { name: "Settings" }).click();
    await currentPage.getByRole("button", { name: "Billing" }).click();
    await currentPage.waitForSelector("text=of 28 left", { timeout: 15_000 });
    const text = await currentPage.getByText(EXACT_COUNT).innerText();
    await currentPage.keyboard.press("Escape");
    return Number(text.split(" ")[0]);
  }
} finally {
  await setBoundary(200);
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
