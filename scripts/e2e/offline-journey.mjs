/**
 * Offline Intelligence, as a person meets it.
 *
 * `PLAN.md` Phase 7 fixes two things a browser can check and nothing else can:
 * the WORDS a normal customer may see, and the fact that removal is something
 * they do on purpose. The engine behind them — parallel chunks, resume after an
 * interruption, repair of what is missing, and a revisit that fetches nothing —
 * is proven against the real transfer engine in `install-once.test.ts`, where a
 * fake ranged server can be interrupted and corrupted on demand.
 *
 * WHAT THIS DOES NOT PROVE: a real install. The artifact is served from OCADE's
 * private bucket, which this environment cannot reach, and a proof that
 * downloads nothing is not a proof of downloading. What it does prove is that
 * the surface exists, says only what it is allowed to say, and that Remove is
 * reachable and deliberate.
 *
 * Usage: node scripts/e2e/offline-journey.mjs [--base=…] [--supabase=…]
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
const EMAIL = `offline-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

/**
 * The vocabulary Phase 7 allows, and the vocabulary it forbids.
 *
 * The forbidden list is the point: the internal model, its publisher, its
 * format and the runtime that executes it are implementation facts, and a
 * first-run screen that names a third party's model is telling the person
 * something about OCADE that OCADE does not mean to say.
 */
const FORBIDDEN = /qwen|gguf|wllama|webassembly|wasm|webgpu|hugging ?face|llama\.cpp|quantis/i;

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
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

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  /* --- the surface exists at all ------------------------------------------ */

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Data Controls" }).click();
  check(
    "Offline Intelligence has a screen a person can reach",
    (await page.getByText("Offline Intelligence", { exact: true }).count()) >= 1,
  );

  const panel = await page.getByRole("dialog", { name: "Settings" }).innerText();
  check(
    "it says what state this device is in, in OCADE's own words",
    /(Preparing OCADE|Downloading \d+%|Verifying|Almost ready|Ready|Repairing|Removed|more local storage|not available|could not|cannot run)/.test(
      panel,
    ),
    panel
      .split("\n")
      .find((line) => /Preparing|Downloading|Ready|Removed|storage|not available/.test(line)) ?? "",
  );
  check(
    "it never names the model, its format, its publisher or the runtime",
    !FORBIDDEN.test(panel),
    (FORBIDDEN.exec(panel) ?? [""])[0],
  );

  /* --- removal is deliberate ---------------------------------------------- */

  check(
    "removing it is offered",
    (await page.getByRole("button", { name: "Remove" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Remove" }).click();
  check(
    "and asks before it throws away what it downloaded",
    (await page.getByRole("button", { name: "Keep" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Keep" }).click();
  check(
    "and changing your mind leaves it alone",
    (await page.getByRole("button", { name: "Keep" }).count()) === 0 &&
      (await page.getByRole("button", { name: "Remove" }).count()) === 1,
  );

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Removed"), undefined, {
    timeout: 15_000,
  });
  check("after removal it says so plainly", true);
  check(
    "and nothing puts it back until the person asks",
    (await page.getByRole("button", { name: "Install" }).count()) === 1,
  );

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Data Controls" }).click();
  await page.waitForTimeout(2500);
  check(
    "a reload does not quietly start it downloading again",
    (await page.getByRole("button", { name: "Install" }).count()) === 1,
  );

  /* --- and the rest of the product never mentions any of it ---------------- */

  await page.keyboard.press("Escape");
  const chat = await page.locator("body").innerText();
  check("Chat itself names no runtime or model", !FORBIDDEN.test(chat));
  check(
    "the only words for it are OCADE's own",
    (await page.getByRole("button", { name: "Offline", exact: true }).count()) === 1,
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
