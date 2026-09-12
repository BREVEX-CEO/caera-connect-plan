/**
 * The shell, proved in a real browser rather than in a render test.
 *
 * WHAT THIS ANSWERS THAT A UNIT TEST CANNOT. Whether the routes actually
 * resolve in a browser, whether the sidebar is present at desktop width and
 * gone at phone width, whether pressing Send while signed out reaches
 * authentication, and whether the retired destinations are genuinely
 * unreachable rather than merely unlinked.
 *
 * Usage:
 *   node scripts/e2e/shell-journey.mjs [--base=http://127.0.0.1:8788] [--json]
 *
 * Requires a served production build. It reports every check and exits non-zero
 * on the first real failure, so a partial pass cannot read as a pass.
 */
import { chromium } from "playwright-core";

const baseArgument = process.argv.find((argument) => argument.startsWith("--base="));
const BASE = baseArgument ? baseArgument.slice("--base=".length) : "http://127.0.0.1:8788";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? "PASS" : "FAIL";
  process.stdout.write(`${mark}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();

  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  check(
    "chat is the home page",
    (await page.locator("h1", { hasText: "Ask OCADE" }).count()) === 1,
  );
  check("the composer is present", (await page.locator("#ocade-composer").count()) === 1);
  for (const label of ["Chat", "Library", "Cowork", "New chat"]) {
    check(
      `the sidebar offers ${label}`,
      (await page.locator(`nav[aria-label="Primary"] >> text=${label}`).count()) >= 1,
    );
  }
  check(
    "the intelligence selector shows only Auto, OCADE and Offline",
    (await page.locator("button[aria-pressed]").allTextContents()).join("|") ===
      "Auto|OCADE|Offline",
  );
  check(
    "no provider or runtime identifier is on screen",
    !/qwen|gguf|webgpu|wasm|gemini|wllama/i.test(await page.locator("body").innerText()),
  );

  // Signed out, Send must reach authentication and keep the message.
  await page.fill("#ocade-composer", "a message written before signing in");
  await page.click('button[aria-label="Send"]');
  await page.waitForURL(/\/auth/, { timeout: 10_000 });
  check("send while signed out reaches authentication", page.url().includes("/auth"));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "the pending message is kept, not discarded",
    (await page.inputValue("#ocade-composer")).length > 0,
  );

  for (const path of ["/about", "/help", "/terms", "/privacy"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(`${path} renders`, response?.status() === 200);
  }

  for (const path of ["/pricing", "/ocade", "/settings", "/projects", "/search"]) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(`${path} is gone`, response?.status() === 404, `status ${response?.status()}`);
  }

  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const small = await phone.newPage();
  await small.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "the sidebar is a drawer on a phone",
    (await small.locator('button[aria-label="Open navigation"]').count()) === 1,
  );
  await small.click('button[aria-label="Open navigation"]');
  check(
    "the drawer opens",
    (await small.locator('button[aria-label="Close navigation"]').count()) === 1,
  );
  check(
    "the page does not scroll sideways on a phone",
    await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  check("no uncaught page errors", consoleErrors.length === 0, consoleErrors.join("; "));
} finally {
  await browser.close();
}

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ base: BASE, failures, results }, null, 2)}\n`);
}
process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
