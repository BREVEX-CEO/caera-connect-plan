/**
 * CROSS-ORIGIN ISOLATION AND REAL THREADS, IN A REAL BROWSER.
 *
 * Configuration is not proof. Headers can be written correctly and still not
 * isolate a document — a missing COEP, a value the browser does not implement,
 * a client-side navigation that never created a new document. All three produce
 * a page that looks right and silently runs on one core.
 *
 * So this asserts what the PLATFORM reports, against the production build:
 *
 *   - `crossOriginIsolated === true` on the inference routes;
 *   - `SharedArrayBuffer` genuinely constructible there;
 *   - `crossOriginIsolated === false` on the auth route, which must never be
 *     isolated because the sign-in SDK has a popup branch;
 *   - the sign-in page still renders and its provider buttons still work;
 *   - the thread plan resolves to more than one thread on this machine;
 *   - a client-side navigation into an inference route still ends up isolated,
 *     because the one-shot upgrade turns it into a real one.
 *
 * WHAT IT DOES NOT DO: load a gigabyte of weights to watch four threads decode.
 * `wllama`'s own `isMultithread()`/`getNumThreads()` are the ground truth for
 * that and they need a loaded model; the separate real-inference harness covers
 * it. What is proven here is the thing that was actually missing — the headers,
 * the isolation they produce, and that auth is left out of it.
 *
 * Run: node scripts/e2e/isolation-and-threads.mjs
 */
import { chromium } from "playwright-core";
import { startServedBuild } from "./served-build.mjs";

const PORT = Number(process.env.OCADE_PREVIEW_PORT ?? 8107);
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
const check = (ok, what, detail) => {
  results.push({ ok, what, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

/** What the platform says about this document. Asked, never inferred. */
const ISOLATION_PROBE = () => ({
  crossOriginIsolated: globalThis.crossOriginIsolated === true,
  sharedArrayBuffer: typeof SharedArrayBuffer === "function",
  // Constructing one is the real test: the symbol can exist on a page that is
  // not isolated, where the constructor throws.
  sharedArrayBufferUsable: (() => {
    try {
      return new SharedArrayBuffer(8).byteLength === 8;
    } catch {
      return false;
    }
  })(),
  cores: navigator.hardwareConcurrency ?? null,
});

async function main() {
  const served = await startServedBuild({ port: PORT, outDir: ".output-isolation" });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
  const base = `http://127.0.0.1:${PORT}`;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    /* ------------------------------------------- headers on the wire ---- */

    console.log("\n1. The headers actually reach the browser");
    const isolatedResponse = await page.goto(`${base}/demo/ocade`, {
      waitUntil: "domcontentloaded",
    });
    const isolatedHeaders = isolatedResponse?.headers() ?? {};
    check(
      isolatedHeaders["cross-origin-opener-policy"] === "same-origin",
      "an inference route sends COOP: same-origin",
      isolatedHeaders["cross-origin-opener-policy"],
    );
    check(
      isolatedHeaders["cross-origin-embedder-policy"] === "credentialless",
      "and COEP: credentialless",
      isolatedHeaders["cross-origin-embedder-policy"],
    );

    /* ----------------------------------------- isolation, as reported --- */

    console.log("\n2. The document is genuinely isolated");
    await page.waitForTimeout(1500);
    const isolated = await page.evaluate(ISOLATION_PROBE);
    check(isolated.crossOriginIsolated, "crossOriginIsolated === true", String(isolated));
    check(isolated.sharedArrayBuffer, "SharedArrayBuffer exists");
    check(
      isolated.sharedArrayBufferUsable,
      "and can actually be constructed — the symbol alone is not the test",
    );

    /* ----------------------------------------------- threads follow ----- */

    console.log("\n3. That produces a real thread plan");
    const plan = await page.evaluate(() => {
      /*
       * The shipped module is inside a content-hashed chunk with no stable URL
       * to import from a test, so the plan is recomputed here from the same
       * inputs and the same rule. `wasm-threads.test.ts` is what holds the rule
       * itself honest; this only needs to know whether THIS machine, in THIS
       * document, would get more than one thread.
       */
      const cores = navigator.hardwareConcurrency ?? 0;
      const isolatedNow = globalThis.crossOriginIsolated === true;
      const sab = typeof SharedArrayBuffer === "function";
      const mobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
      if (!isolatedNow || !sab || cores < 2) return { threads: 1, cores };
      let threads = Math.floor(cores / 2);
      if (mobile) threads = Math.min(threads, 4);
      return { threads: Math.max(1, Math.min(8, threads)), cores };
    });
    check(
      plan.threads > 1,
      "more than one thread is available on this machine",
      `${plan.threads} threads from ${plan.cores} cores`,
    );

    /* ------------------------------------------- auth is NOT isolated --- */

    console.log("\n4. AUTHENTICATION IS NOT ISOLATED");
    const authResponse = await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded" });
    const authHeaders = authResponse?.headers() ?? {};
    check(
      authHeaders["cross-origin-opener-policy"] === "same-origin-allow-popups",
      "the sign-in route keeps opener-friendly COOP",
      authHeaders["cross-origin-opener-policy"],
    );
    check(
      authHeaders["cross-origin-embedder-policy"] === undefined,
      "and sends no COEP at all",
      authHeaders["cross-origin-embedder-policy"] ?? "(absent)",
    );

    await page.waitForTimeout(1200);
    const authIsolated = await page.evaluate(ISOLATION_PROBE);
    check(
      !authIsolated.crossOriginIsolated,
      "the sign-in document is NOT isolated, so window.opener survives",
    );

    const authText = await page.locator("body").innerText();
    check(
      /sign in|continue with|email|create an account/i.test(authText),
      "the sign-in page still renders",
      `${authText.length} characters`,
    );
    // The provider buttons are the thing COOP would have broken.
    const providerButtons = await page
      .getByRole("button", { name: /google|apple|continue|sign in/i })
      .count();
    check(providerButtons > 0, "and still offers its sign-in controls", `${providerButtons} found`);

    /* --------------------------------- client-side entry still isolates - */

    console.log("\n5. Arriving by a client-side route change still ends up isolated");
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const landing = await page.evaluate(ISOLATION_PROBE);
    check(!landing.crossOriginIsolated, "the landing page itself is not isolated");

    /*
     * Pushing history is exactly what a router transition does, and it is the
     * case the one-shot upgrade exists for: the document does not change, so
     * isolation cannot appear without a real navigation.
     */
    /*
     * The guard responds by performing a REAL navigation, which destroys this
     * execution context — so the wait is for the navigation, not a timeout. An
     * earlier version probed straight afterwards and got "Execution context was
     * destroyed", which was the harness failing to notice that the thing it was
     * testing for had happened.
     */
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null),
      page.evaluate(() => {
        history.pushState({}, "", "/demo/ocade");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }),
    ]);
    await page.waitForTimeout(1500);
    const afterUpgrade = {
      ...(await page.evaluate(ISOLATION_PROBE)),
      path: await page.evaluate(() => window.location.pathname),
    };
    check(afterUpgrade.path === "/demo/ocade", "still on the inference route", afterUpgrade.path);
    check(
      afterUpgrade.crossOriginIsolated,
      "and the one-shot upgrade made it isolated",
      JSON.stringify(afterUpgrade),
    );

    /* --------------------------------------- the upgrade cannot loop ---- */

    console.log("\n6. The upgrade never loops");
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });
    await page.goto(`${base}/demo/ocade`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    check(
      navigations <= 2,
      "an already-isolated route does not renavigate",
      `${navigations} navigation(s)`,
    );

    await context.close();
  } finally {
    await browser.close();
    await served.stop();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(70));
  if (failed.length === 0) {
    console.log(`ALL ${results.length} ISOLATION AND THREAD CHECKS PASSED.`);
  } else {
    console.log(`${failed.length} of ${results.length} CHECKS FAILED:`);
    for (const f of failed) console.log(`  - ${f.what}${f.detail ? ` (${f.detail})` : ""}`);
  }
  console.log("=".repeat(70) + "\n");
  process.exit(failed.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
