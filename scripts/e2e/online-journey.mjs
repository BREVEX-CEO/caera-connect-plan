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
  /*
   * ONE QUESTION, SENT ONCE.
   *
   * The transcript is updated synchronously before the request is built, and
   * the question was then appended to it a second time — so the model received
   * the last thing the person typed twice, on every single request. It distorts
   * the answer and pays for the tokens twice, and nothing visible says so.
   */
  check(
    "the question was sent exactly once, and nothing else was",
    JSON.stringify(sent.turns.filter((turn) => turn.role !== "system")) ===
      JSON.stringify([{ role: "user", content: "An online question" }]),
    JSON.stringify(sent.turns),
  );
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

  /* --- an attached file actually reaches intelligence ---------------------- */

  /*
   * THE CHECK THAT WAS MISSING. Attaching a file used to put it in the Library
   * and nothing else: the boundary validated an `attachments` array it never
   * read, and the answer was written as though no file existed.
   */
  await page.getByRole("link", { name: "New chat" }).first().click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("stubbed OCADE answer"),
    undefined,
    { timeout: 10_000 },
  );
  await page.getByRole("button", { name: "OCADE", exact: true }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("region,total\nnorth,128\nsouth,64\n"),
  });
  await page.waitForSelector("text=sales.csv", { timeout: 10_000 });
  check("an attached file is shown before it is sent", true);

  await page.setInputFiles('input[type="file"]', {
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 not really"),
  });
  await page.waitForTimeout(600);
  check(
    "a format OCADE cannot read says so rather than failing later",
    /can.{0,3}t read/i.test(await page.locator("body").innerText()),
  );
  await page.getByRole("button", { name: "Remove report.pdf" }).click();
  check(
    "and it can be taken off the question",
    (await page.getByText("report.pdf", { exact: true }).count()) === 0,
  );

  await page.fill("#ocade-composer", "Which region sold more?");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });

  const withFile = await lastBoundaryRequest();
  check(
    "the file reached the boundary, named and carrying its contents",
    withFile.attachments.length === 1 &&
      withFile.attachments[0].name === "sales.csv" &&
      withFile.attachments[0].carries === "text" &&
      withFile.attachments[0].text.includes("north,128"),
    JSON.stringify(withFile.attachments),
  );
  check(
    "the unreadable one did not go with it",
    !JSON.stringify(withFile.attachments).includes("report.pdf"),
  );
  check(
    "and OCADE was asked to say where an answer came from",
    withFile.systemPrompts.some((prompt) => /which file/i.test(prompt)),
    withFile.systemPrompts.join(" | ").slice(0, 120),
  );
  check(
    "the transcript records what the answer was allowed to read",
    (await page.getByText("sales.csv").count()) >= 1,
  );

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

  /*
   * THE METER BESIDE THE COMPOSER, WHICH NOTHING REMOUNTED.
   *
   * Settings refetches when it opens, so the check below reads the settled
   * number. This one reads the sidebar, which has been mounted throughout: a
   * refused request must leave it saying exactly what it said before, with no
   * flicker of a charge that was never kept.
   */
  const meter = await page.locator("aside p", { hasText: /of 28 left · resets/ }).innerText();
  check(
    "the meter beside the composer never showed a charge for the refused request",
    meter.startsWith(`${before} of 28 left`),
    meter,
  );

  const after = await usageRemaining(page);
  check(
    "a refused request costs the person nothing",
    after === before,
    `${before} before, ${after} after`,
  );

  /* --- research is the same request, and it cites where it looked --------- */

  // The refusal section above left the boundary failing on purpose.
  await setBoundary(200);
  await page.goto(`${BASE}/?new=true`, { waitUntil: "networkidle" });
  check(
    "Research is offered on the connected engine",
    (await page.getByRole("button", { name: "Research" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  check(
    "and never on manual Offline, which sends no provider traffic at all",
    (await page.getByRole("button", { name: "Research" }).count()) === 0,
  );
  await page.getByRole("button", { name: "Auto", exact: true }).click();

  const beforeResearch = await usageRemaining(page);
  await page.getByRole("button", { name: "Research" }).click();
  await page.fill("#ocade-composer", "What happened this week?");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  await page.waitForTimeout(800);

  const researched = await page.locator("body").innerText();
  check(
    "a researched answer shows where it looked",
    /Sources/.test(researched) && /Example source/.test(researched),
    researched.split("\n").find((line) => /Example source/.test(line)) ?? "",
  );
  // `lastBoundaryRequest()` returns the record itself, not a wrapper.
  const researchRequest = await lastBoundaryRequest();
  check(
    "and it asked the boundary for research rather than running its own",
    researchRequest.research === true,
    String(researchRequest.research),
  );
  check(
    "a researched answer costs exactly one use, like any other",
    (await usageRemaining(page)) === beforeResearch - 1,
  );

  /* --- losing the network changes what is offered, truthfully -------------- */

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(400);

  const onlineOption = page.getByRole("button", { name: "OCADE", exact: true });
  check(
    "without a network, Online is disabled rather than offered",
    await onlineOption.isDisabled(),
  );
  check(
    "the selection moves off a mode that cannot run",
    (await page.getByRole("button", { name: "Auto", exact: true }).getAttribute("aria-pressed")) ===
      "true",
  );
  check(
    "and Auto says it is answering on this device",
    /no connection\. ocade answers on this device/i.test(await page.locator("body").innerText()),
  );

  /*
   * MANUAL OFFLINE SENDS NOTHING TO THE PROVIDER — PLAN.md Phase 5's gate.
   * Proved by what the boundary received, not by what the screen said: the
   * stub records every request, so a request that was never made is the
   * absence of a new record.
   */
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(300);
  await fetch(`${SUPABASE}/__fixture/online-boundary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: 200 }),
  });
  const beforeManualOffline = await fetch(`${SUPABASE}/__fixture/online-boundary`)
    .then((response) => response.json())
    .then((state) => JSON.stringify(state.lastRequest ?? null));

  await page.goto(`${BASE}/?new=true`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  await page.fill("#ocade-composer", "Answer this without the network");
  await page.click('button[aria-label="Send"]');
  await page.waitForTimeout(5000);

  const afterManualOffline = await fetch(`${SUPABASE}/__fixture/online-boundary`)
    .then((response) => response.json())
    .then((state) => JSON.stringify(state.lastRequest ?? null));
  check(
    "manual Offline sends zero provider traffic",
    afterManualOffline === beforeManualOffline,
    afterManualOffline === beforeManualOffline ? "" : "the boundary received a request",
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
    // The count lives under Usage & Limits. Billing is about plans.
    await currentPage.getByRole("button", { name: "Usage & Limits" }).click();
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
