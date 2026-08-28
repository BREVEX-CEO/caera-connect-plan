/**
 * SIGNING IN MUST NOT DISTURB AN INSTALLATION IN PROGRESS.
 *
 * WHY THIS IS THE RISK. Cross-origin isolation is what buys the compatibility
 * engine several processor cores, and COOP `same-origin` is what buys the
 * isolation. COOP severs `window.opener` — so if this product signed in through
 * a popup, isolating the inference routes would break sign-in. The design's
 * answer is that it does not: the sign-in route is deliberately left
 * un-isolated, and the provider hop is a full-document navigation.
 *
 * That answer is a claim about behaviour, and `isolation-and-threads.mjs`
 * checks only the headers around it. This walks the journey.
 *
 * The second risk is quieter and worse. Preparation begins on its own, before
 * anybody signs in. A person who then signs in mid-download must come back to
 * the SAME installation — not a restarted one, and certainly not a second
 * downloader racing the first for the same bytes. Sign-in replaces the whole
 * document twice over, so nothing about that survival is automatic.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT. The application is the production build.
 * The journey, the routes, the isolation, the redirect and the durable install
 * state are all the product's own. The identity provider is the loopback
 * fixture in scripts/fixtures/stub-supabase.mjs — it models the two hops a real
 * provider makes and authenticates nobody, which is enough because what is
 * under test is the SHAPE of the journey, not an identity check. No live
 * credential exists in this repository or environment, and none is invented.
 *
 * The weights are served by this harness for the first stretch and then
 * withheld, which is what makes durable progress observable without moving a
 * gigabyte: the transfer itself is proven at real weight by
 * model-install-production-proof.mts.
 *
 * Run: node scripts/e2e/auth-journey-isolation.mjs
 */
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const PORT = Number(process.env.OCADE_PREVIEW_PORT ?? 8109);
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

/**
 * How far the weights are actually served before the tap closes.
 *
 * Enough that the installer writes real bytes, hashes them and persists real
 * checkpoints — which is the state the journey has to preserve — and small
 * enough that the harness never moves the gigabyte the real artifact weighs.
 */
const SERVED_LIMIT = 48 * 1024 * 1024;

const results = [];
const check = (ok, what, detail) => {
  results.push({ ok, what, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

/** What the platform says about this document. Asked, never inferred. */
const ISOLATION_PROBE = () => ({
  crossOriginIsolated: globalThis.crossOriginIsolated === true,
  path: window.location.pathname,
});

/**
 * Everything the installation left on this device that outlives a document.
 *
 * Read from storage rather than from the running authority on purpose: a
 * journey that navigates away three times destroys the authority three times,
 * so what survives is exactly what is durable, and that is the only honest
 * measure of "the same installation came back".
 */
const DURABLE_STATE = async () => {
  const keys = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /ocade\.(install|model|vault|transfer)/i.test(key)) {
        keys[key] = localStorage.getItem(key);
      }
    }
  } catch {
    /* Storage a browser refuses to open is reported as empty, not as a crash. */
  }

  // Every file the vault has staged or activated, with its size. A restart
  // from zero shows up here as a staging file that got smaller.
  const files = {};
  const walk = async (directory, prefix) => {
    for await (const [name, handle] of directory.entries()) {
      const path = `${prefix}/${name}`;
      if (handle.kind === "directory") await walk(handle, path);
      else files[path] = (await handle.getFile()).size;
    }
  };
  try {
    await walk(await navigator.storage.getDirectory(), "");
  } catch {
    /* No OPFS, no files. */
  }
  return { keys, files, bytes: Object.values(files).reduce((a, b) => a + b, 0) };
};

/**
 * Get past the consent gate the way a person does.
 *
 * OCADE will not begin anything — including preparing itself — until the
 * prelaunch terms and the privacy notice have been accepted, and the gate sits
 * over the whole screen while that is outstanding. A harness that skipped it
 * would be testing a product state no user is ever in.
 */
async function acceptConsent(page) {
  const gate = page.getByRole("button", { name: /accept and continue/i });
  if ((await gate.count()) === 0) return false;
  for (const box of await page.locator('input[type="checkbox"], [role="checkbox"]').all()) {
    try {
      if (!(await box.isChecked())) await box.check({ timeout: 3000 });
    } catch {
      /* A box that is not the gate's own is not this function's business. */
    }
  }
  await gate.first().click({ timeout: 10_000 });
  await page.waitForTimeout(1200);
  return true;
}

/** Deterministic filler so a range served twice would be byte-identical. */
function fillerFor(start, length) {
  const out = Buffer.alloc(length);
  for (let offset = 0; offset < length; offset += 32) {
    const digest = createHash("sha256")
      .update(String(Math.floor((start + offset) / 32)))
      .digest();
    digest.copy(out, offset, 0, Math.min(32, length - offset));
  }
  return out;
}

async function main() {
  const served = await startServedBuild({ port: PORT, outDir: ".output-authjourney" });
  const base = served.base;
  /*
   * A REAL BROWSER PROFILE ON DISK, AND IT IS NOT A CONVENIENCE.
   *
   * Chromium hands an ephemeral context a fixed ~0.93 GB storage quota, which
   * is less than this engine needs — so against a throwaway context OCADE
   * correctly refuses to prepare and says the device is out of room. That is
   * the product working, and a harness that ran there would prove only that it
   * had misconfigured the browser. A profile on disk gets the quota a real
   * visitor's browser gets, which is what makes preparation reachable at all.
   */
  const profile = mkdtempSync(join(tmpdir(), "ocade-journey-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: EXECUTABLE,
    args: ["--no-sandbox"],
  });

  /** Every range the application asked for, in order, across the whole journey. */
  const ranges = [];
  let totalBytes = 0;

  try {
    /*
     * THE WEIGHTS, SERVED BY THIS HARNESS.
     *
     * The application asks its own origin for the artifact first, so this is
     * where a real transfer would come from on a self-hosting deployment. Every
     * request is recorded before it is answered, which is what makes "no range
     * was ever fetched twice" checkable at the end.
     */
    await context.route("**/models/**", async (route) => {
      const request = route.request();
      const size = 1_117_320_736;

      if (request.method() === "HEAD") {
        return route.fulfill({
          status: 200,
          headers: {
            "content-length": String(size),
            "accept-ranges": "bytes",
            "content-type": "application/octet-stream",
          },
          body: "",
        });
      }

      const header = request.headers()["range"] ?? "";
      const match = /bytes=(\d+)-(\d*)/.exec(header);
      const start = match ? Number(match[1]) : 0;
      const end = match && match[2] ? Number(match[2]) : size - 1;
      const record = { start, end, at: Date.now(), served: false };
      ranges.push(record);

      if (start >= SERVED_LIMIT) {
        /*
         * Beyond the tap the request is left hanging rather than refused. A
         * refusal would send the installer down its source ladder to the
         * publisher's host, which this sandbox cannot reach, and the journey
         * under test would become a journey about a network failure.
         */
        return;
      }

      const stop = Math.min(end, SERVED_LIMIT - 1);
      const body = fillerFor(start, stop - start + 1);
      totalBytes += body.length;
      record.served = true;
      return route.fulfill({
        status: 206,
        headers: {
          "content-range": `bytes ${start}-${stop}/${size}`,
          "content-length": String(body.length),
          "accept-ranges": "bytes",
          "content-type": "application/octet-stream",
        },
        body,
      });
    });

    const page = context.pages()[0] ?? (await context.newPage());

    /* ------------------------------------ 1. preparation starts by itself */

    console.log("\n1. Preparation starts on its own, before anybody signs in");
    await page.goto(`${base}/demo/ocade`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const gated = await acceptConsent(page);
    check(gated, "the consent gate is answered before anything else happens");
    await page.waitForTimeout(12_000);

    const beforeIsolation = await page.evaluate(ISOLATION_PROBE);
    check(beforeIsolation.crossOriginIsolated, "the inference route is isolated");
    check(
      ranges.length > 0,
      "the installer asked for weights unprompted",
      `${ranges.length} ranges`,
    );

    const before = await page.evaluate(DURABLE_STATE);
    check(
      before.bytes > 0,
      "and wrote real bytes to durable storage",
      `${(before.bytes / (1024 * 1024)).toFixed(1)} MiB across ${Object.keys(before.files).length} file(s)`,
    );
    const rangesBeforeAuth = ranges.length;

    /* ------------------------------------------- 2. auth is not isolated */

    console.log("\n2. The sign-in document is not isolated, so a provider hop survives");
    await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await acceptConsent(page);
    const authIsolation = await page.evaluate(ISOLATION_PROBE);
    check(!authIsolation.crossOriginIsolated, "sign-in is NOT isolated", authIsolation.path);

    const googleButton = page.getByRole("button", { name: /google/i });
    check((await googleButton.count()) > 0, "and offers the provider control");

    /* ------------------------------- 3. the provider hop is a navigation */

    console.log("\n3. Signing in navigates the document; it never opens a popup");
    let popups = 0;
    context.on("page", () => {
      popups += 1;
    });
    /*
     * DOCUMENT REQUESTS, NOT COMMITTED NAVIGATIONS.
     *
     * The provider answers with a 302, and a redirect never commits a
     * document — so `framenavigated` sees only where the browser came to rest
     * and reports the provider hop as though it had not happened. Watching for
     * top-level document REQUESTS sees every hop the browser actually made,
     * which is the thing being claimed.
     */
    const navigated = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") navigated.push(request.url());
    });

    await googleButton.first().click();
    await page
      .waitForURL(/\/(demo|ocade|onboarding|auth\/callback)/, { timeout: 45_000 })
      .catch(() => null);
    await page.waitForTimeout(4000);

    check(popups === 0, "no popup window was opened", `${popups} popup(s)`);
    check(
      navigated.some((url) => url.includes("/auth/v1/authorize")),
      "the whole document went to the provider",
      navigated.find((url) => url.includes("/auth/v1/authorize"))?.slice(0, 60) ??
        "(no provider hop)",
    );
    check(
      navigated.some((url) => url.includes("/auth/callback")),
      "and came back to the application's own callback",
    );

    const session = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) ?? "";
        if (/^sb-.*-auth-token$/.test(key)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
            return { signedIn: !!parsed?.access_token, email: parsed?.user?.email ?? null };
          } catch {
            return { signedIn: false, email: null };
          }
        }
      }
      return { signedIn: false, email: null };
    });
    check(session.signedIn, "the journey ends signed in", session.email ?? "(no address)");

    /* ------------------------- 4. the installation is the one it started */

    console.log("\n4. The installation that was running is the one that comes back");
    await page.goto(`${base}/demo/ocade`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await acceptConsent(page);
    await page.waitForTimeout(10_000);

    const afterIsolation = await page.evaluate(ISOLATION_PROBE);
    check(
      afterIsolation.crossOriginIsolated,
      "the inference route is isolated again after sign-in",
    );

    const after = await page.evaluate(DURABLE_STATE);
    check(
      after.bytes >= before.bytes,
      "no durable progress was lost across sign-in",
      `${(before.bytes / (1024 * 1024)).toFixed(1)} MiB before, ${(after.bytes / (1024 * 1024)).toFixed(1)} MiB after`,
    );

    const restarted = ranges.slice(rangesBeforeAuth).some((r) => r.start === 0);
    check(
      !restarted || before.bytes === 0,
      "and the transfer did not begin again from the first byte",
      `${ranges.length - rangesBeforeAuth} range(s) requested after sign-in`,
    );

    /*
     * NO BYTES FETCHED TWICE, WHICH IS WHAT "ONE DOWNLOAD" ACTUALLY MEANS —
     * AND THE RULE HAS TO BE STATED CAREFULLY OR IT FORBIDS CORRECT WORK.
     *
     * The installer fetches several ranges at once by design, so concurrency
     * proves nothing either way. And a range that was IN FLIGHT when the
     * document was destroyed genuinely has to be asked for again: nothing was
     * durably written, so re-requesting it is the resume working, not a
     * duplicate. Forbidding that was this harness's own first mistake.
     *
     * What must never happen is re-fetching bytes that were already DELIVERED
     * and checkpointed. That is the signature of the real defect — a second
     * installer, another tab's authority, a restart that forgot its progress —
     * and it is what this forbids.
     */
    const delivered = new Set();
    const refetched = [];
    for (const range of ranges) {
      const key = `${range.start}-${range.end}`;
      if (delivered.has(key)) refetched.push(key);
      if (range.served) delivered.add(key);
    }
    check(
      refetched.length === 0,
      "no byte range that was already delivered was ever fetched again",
      `${ranges.length} request(s), ${delivered.size} delivered, ${(totalBytes / (1024 * 1024)).toFixed(1)} MiB`,
    );

    /*
     * And the work redone after sign-in is bounded by what was genuinely
     * unfinished. A resume that re-requests a couple of interrupted chunks is
     * correct; one that re-requests the whole transfer is a restart wearing a
     * resume's clothes.
     */
    const redoneAfterAuth = ranges.slice(rangesBeforeAuth).filter((r) => r.start < SERVED_LIMIT);
    check(
      redoneAfterAuth.length * 16 * 1024 * 1024 < before.bytes || redoneAfterAuth.length === 0,
      "and resuming redid less work than it kept",
      `${redoneAfterAuth.length} already-served range(s) re-requested after sign-in`,
    );
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
    await served.stop();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(70));
  console.log(
    failed.length === 0
      ? `ALL ${results.length} AUTH-JOURNEY CHECKS PASSED.`
      : `${failed.length} of ${results.length} FAILED:\n${failed.map((f) => `  - ${f.what}${f.detail ? ` (${f.detail})` : ""}`).join("\n")}`,
  );
  console.log("=".repeat(70) + "\n");
  process.exit(failed.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
