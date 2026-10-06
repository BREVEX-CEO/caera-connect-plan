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
import { readFileSync } from "node:fs";
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
  await page.getByRole("button", { name: "Privacy & Security" }).click();
  check(
    "Offline Intelligence has a screen a person can reach",
    (await page.getByText("Offline Intelligence", { exact: true }).count()) >= 1,
  );

  const panel = await page.getByRole("dialog", { name: "Settings" }).innerText();
  const stateLine =
    panel
      .split("\n")
      .find((line) =>
        /Preparing|Downloading|Verifying|Almost ready|Ready|Repairing|Removed|storage|not available|could not|cannot run/.test(
          line,
        ),
      ) ?? "";
  check(
    "it says what state this device is in, in OCADE's own words",
    /(Preparing OCADE|Downloading \d+%|Verifying|Almost ready|Ready|Repairing|Removed|more local storage|not available|could not|cannot run)/.test(
      panel,
    ),
    stateLine,
  );
  /*
   * "NOT AVAILABLE" IS NOT A PASSING STATE WHEN A RELEASE IS PUBLISHED.
   *
   * The check above accepts it, which let this journey go green on a build that
   * could never install anything — the exact production defect the mission
   * opened with, reported as healthy. A published release means the deployment
   * CAN install, so the only honest reasons to say otherwise are about this
   * device.
   */
  check(
    "and it does not claim the release is unavailable when one is published",
    !/not available in this version/i.test(panel),
    stateLine,
  );
  check(
    "it never names the model, its format, its publisher or the runtime",
    !FORBIDDEN.test(panel),
    (FORBIDDEN.exec(panel) ?? [""])[0],
  );

  /* --- Thinking is offered only where it can be kept ---------------------- */

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(
    "Thinking is not offered while Auto is selected",
    (await page.getByRole("button", { name: "Thinking" }).count()) === 0,
  );
  await page.getByRole("button", { name: "Online", exact: true }).click();
  check(
    "nor while Online is selected, where the boundary has no such parameter",
    (await page.getByRole("button", { name: "Thinking" }).count()) === 0,
  );
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  check(
    "and is offered on Offline, where the artifact carries both modes",
    (await page.getByRole("button", { name: "Thinking" }).count()) === 1,
  );
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Privacy & Security" }).click();

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
  await page.getByRole("button", { name: "Privacy & Security" }).click();
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

  /* --- the only door to the artifact ------------------------------------- */

  /*
   * THE DELIVERY BOUNDARY, ASKED DIRECTLY. The bucket is private and has no
   * public access, so this handler is the whole of the way in. What it must
   * refuse is worth more than what it serves: an unsigned request, a request
   * signed for a different release, and an id shaped to reach for another
   * object.
   */
  const release = JSON.parse(readFileSync("release/OCADE_OFFLINE_RELEASE.json", "utf8")).releaseId;
  const status = async (path) => (await page.request.get(`${BASE}${path}`)).status();

  check(
    "an unsigned request for the bytes is refused",
    (await status(`/api/offline/bytes/${release}`)) === 403,
  );
  check(
    "so is one carrying a signature somebody made up",
    (await status(`/api/offline/bytes/${release}?e=${Date.now() + 60_000}&s=${"0".repeat(64)}`)) ===
      403,
  );
  check(
    "an expiry in the past is refused even with a signature-shaped parameter",
    (await status(`/api/offline/bytes/${release}?e=1&s=${"0".repeat(64)}`)) === 403,
  );
  check(
    "a release id that is not one does not reach for an object at all",
    (await status("/api/offline/bytes/../../secret")) === 404 ||
      (await status("/api/offline/bytes/ocr-nope")) === 404,
  );

  /* --- losing local storage is a recoverable event, not a broken product --- */

  /*
   * WHAT SURVIVES WHEN THE BROWSER THROWS THE LOCAL STATE AWAY.
   *
   * A person clears site data, a private window ends, a phone reclaims storage
   * under pressure — all of them delete IndexedDB and localStorage while the
   * account is untouched. Supabase is the canonical authority for a
   * conversation, so the transcript must come back; the device identity and the
   * signed offline block are local and must be re-established rather than
   * mourned. What must NOT happen is a screen stuck on a promise it can no
   * longer keep.
   *
   * The session key is put back deliberately: signing out is a different test.
   * This is the storage under the session going, not the session itself.
   */
  // Something to lose: this journey never sends, and a recovery check against an
  // account with no history would pass without proving anything came back.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill("#ocade-composer", "Written before the storage was lost");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  await page.waitForTimeout(600);

  // Each deletion's real outcome: a blocked or failed one is not storage loss (F-141).
  const deletions = await page.evaluate(async (key) => {
    const session = window.localStorage.getItem(key);
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (session) window.localStorage.setItem(key, session);
    const databases = (await indexedDB.databases?.()) ?? [];
    return Promise.all(
      databases.map(
        (database) =>
          new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(database.name);
            request.onsuccess = () => resolve("deleted");
            request.onerror = () => resolve("failed");
            request.onblocked = () => resolve("blocked");
          }),
      ),
    );
  }, storageKey(SUPABASE));
  check(
    "local storage really was lost before recovery is judged",
    deletions.every((outcome) => outcome === "deleted"),
    deletions.join(","),
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const recovered = await page.locator("body").innerText();
  check(
    "after local storage is lost the account is still signed in",
    (await page.locator('aside button[aria-haspopup="menu"]').count()) === 1,
  );
  check(
    "the conversations come back from the account rather than from this device",
    (await page.locator("aside ul li").count()) >= 1,
    `${await page.locator("aside ul li").count()} rows`,
  );
  await page.locator("aside ul li button").first().click();
  await page.waitForSelector("text=Written before the storage was lost", { timeout: 20_000 });
  check("and the transcript inside one is readable again", true);
  check(
    "and nothing is left promising something it cannot deliver",
    !/Opening this conversation…|Reading your allowance…/.test(recovered),
    recovered.split("\n").find((line) => /Opening|Reading your/.test(line)) ?? "",
  );
  check(
    "the composer still works after the loss",
    (await page.locator("#ocade-composer").isEnabled()) === true,
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
