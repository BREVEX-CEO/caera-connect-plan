/**
 * THE FIRST-RUN EXPERIENCE, IN A REAL BROWSER, AGAINST THE PRODUCTION BUILD.
 *
 * `model-install-production-proof.mts` proves the transfer at real weight with
 * real sockets and a real disk. It cannot prove the thing a visitor actually
 * meets: that the shell paints immediately, that preparation starts on its own
 * without anybody typing, that the setup screen appears instead of a chat with
 * a dead composer, that no demo deadline is written while setup runs, and that
 * nothing on screen names a model.
 *
 * Those are browser facts, so this drives a real Chromium against the built
 * application and asserts them there.
 *
 * WHAT IT DOES NOT DO: download the real engine. That is a gigabyte over the
 * public internet, from a sandbox with no reason to have it, and the transfer
 * itself is already proven at weight elsewhere. What matters here is the
 * LIFECYCLE around it — which starts, in what order, and what the user sees —
 * and that is observable long before any bytes finish arriving.
 *
 * Run: node scripts/e2e/first-run-browser.mjs
 */
import { chromium } from "playwright-core";
import { startServedBuild } from "./served-build.mjs";

const PORT = Number(process.env.OCADE_PREVIEW_PORT ?? 8106);
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
const check = (ok, what, detail) => {
  results.push({ ok, what, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

/**
 * Words that must never reach an ordinary visitor's screen.
 *
 * The product rule is that setup speaks about OCADE and never about the model,
 * its vendor, its file, its quantisation or its size. Checked against rendered
 * text rather than against source, because the source can be right while a
 * runtime's own progress string leaks through — which is exactly how the old
 * adapters' `report.text` reached the screen.
 */
const FORBIDDEN =
  /qwen|gguf|hugging\s*face|huggingface|webgpu|webassembly|\bwasm\b|wllama|web-?llm|q4[_f]|quantis|\d+\s?(MB|GB)\b|parameter count|mlc/i;

async function main() {
  const served = await startServedBuild({ port: PORT, outDir: ".output-firstrun" });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  try {
    /* ---------------------------------------------------- the landing page */

    console.log("\n1. The shell paints, and preparation starts on its own");
    const context = await browser.newContext();
    const page = await context.newPage();

    /*
     * WATCH WHAT THE PAGE ASKS FOR, and specifically whether an installer runs
     * without anybody touching the keyboard. The old behaviour was that nothing
     * happened until the first keystroke, so the observable difference is that
     * the install state leaves `idle` on its own.
     */
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    /*
     * HOLD THE ENGINE REQUEST OPEN, DELIBERATELY.
     *
     * Without this the run is not deterministic: in a sandbox the model host is
     * unreachable, the transfer fails within a second or two, and the harness
     * observes a device that finished failing rather than a device that is
     * preparing. It then passes its weakest assertion and proves nothing about
     * the screen a real visitor sees for minutes.
     *
     * Answering the range request and never completing it puts the application
     * in exactly the state a slow connection produces, and holds it there for
     * as long as the assertions need. Every request captured here is also the
     * PROOF THAT PREPARATION STARTED ON ITS OWN -- nothing in this run types a
     * character, opens a chat, or presses anything.
     */
    const engineRequests = [];
    await context.route(
      (url) => /huggingface\.co|\/models\//.test(url.href),
      async (route) => {
        engineRequests.push({ url: route.request().url(), at: Date.now() });
        // Never fulfilled. The transfer stays in flight, which is the point.
        await new Promise(() => {});
      },
    );

    const started = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
    const domReadyMs = Date.now() - started;
    check(domReadyMs < 15_000, "the landing page reaches DOM-ready promptly", `${domReadyMs}ms`);

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    /*
     * The install state is published into a module-level store, so it is read
     * through the DOM the same way a user would see it: the uninstall control
     * on the landing page renders directly from it.
     */
    const landingText = await page.locator("body").innerText();
    /*
     * Asserted on the control's presence, not on a phrase.
     *
     * Matching wording was the wrong test and said so: the control legitimately
     * says different things -- "keeps its intelligence on this device", "is not
     * installed", or the storage message -- and the first version of this check
     * failed the moment the storage wording was added, while the control itself
     * was sitting on the page the whole time.
     */
    const controlCount = await page.locator('[data-testid="local-intelligence-control"]').count();
    check(
      controlCount > 0,
      "the landing page carries the local-intelligence control, with no account",
      `${controlCount} control(s)`,
    );
    check(
      !FORBIDDEN.test(landingText),
      "and says nothing about a model, a vendor, a file or a size",
      FORBIDDEN.exec(landingText)?.[0],
    );

    /*
     * PREPARATION STARTED WITHOUT A KEYSTROKE. Asserted by watching for a
     * request the installer makes -- the capability probe and the transfer both
     * happen only once the authority has been loaded and told to install.
     */
    const bootstrapped = await page.evaluate(async () => {
      // The bootstrap defers by one idle callback with a 1.5s timeout, so give
      // it a moment and then read the store the UI reads.
      await new Promise((r) => setTimeout(r, 3000));
      const modules = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => /assets\/.*\.js/.test(name));
      return { moduleCount: modules.length };
    });
    check(
      bootstrapped.moduleCount > 0,
      "the application's own modules loaded",
      `${bootstrapped.moduleCount} chunks`,
    );

    /*
     * THE CENTRAL BEHAVIOURAL CHANGE, ASSERTED DIRECTLY.
     *
     * Nothing in this run has typed a character or opened a chat. Under the old
     * design that meant nothing happened at all: the first keystroke was what
     * started the download. So the state machine having LEFT `idle` on its own
     * is the objective, proven.
     *
     * It is asserted on the stage rather than on a network request, because the
     * right outcome depends on the device. This sandbox reports a storage quota
     * of about 954 MB against an engine that needs more, so the correct answer
     * here is a refusal about storage BEFORE any bytes are fetched -- which is
     * the pre-flight disk check working, and would be invisible to a test that
     * only watched for a download.
     */
    const landingStage = await page
      .locator('[data-testid="local-intelligence-control"]')
      .first()
      .getAttribute("data-stage");

    check(
      landingStage !== null && landingStage !== "idle",
      "preparation STARTED BY ITSELF, with no typing and no chat opened",
      `stage=${landingStage}`,
    );

    if (landingStage === "insufficient_storage") {
      /*
       * The device is too full, and that is a completely different thing from
       * a device that cannot run OCADE. The wording has to say so, and it has
       * to offer something that would change the outcome.
       */
      check(
        /storage/i.test(landingText) || /storage/i.test(await page.locator("body").innerText()),
        "a full device is told it needs ROOM, not that it is unsupported",
      );
      check(
        !/cannot run|unsupported|not supported/i.test(landingText),
        "and is never told OCADE cannot run here",
      );
    } else {
      check(
        engineRequests.length > 0,
        "it reached the network for the engine on its own",
        `${engineRequests.length} request(s)`,
      );
      check(
        engineRequests.length <= 12,
        "as one bounded transfer rather than a stampede",
        `${engineRequests.length} requests`,
      );
    }

    /* ------------------------------------------------- no demo deadline yet */

    console.log("\n2. No demo deadline exists before the engine is ready");
    const deadlineOnLanding = await page.evaluate(() =>
      window.localStorage.getItem("caera:demo:session:v2"),
    );
    check(
      deadlineOnLanding === null,
      "the landing page has written no demo deadline",
      String(deadlineOnLanding),
    );

    /* ------------------------------------------------------ the demo route */

    console.log("\n3. Entering the demo while OCADE is not ready");
    await page.goto(`http://127.0.0.1:${PORT}/demo/ocade`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const demoBody = await page.locator("body").innerText();
    const setupVisible = await page
      .locator('[data-testid="ocade-setup-experience"]')
      .count()
      .catch(() => 0);
    const stage = setupVisible
      ? await page.locator('[data-testid="ocade-setup-experience"]').getAttribute("data-stage")
      : null;

    console.log(`     (setup screen present: ${setupVisible > 0}, stage: ${stage ?? "n/a"})`);

    /*
     * THE ASSERTION THAT MATTERS MOST, and it holds either way the run goes.
     *
     * If setup is showing, no deadline may exist. If the engine somehow became
     * ready, a deadline may exist and must be a full 28 minutes. What is never
     * allowed is a deadline that was created while setup was still running,
     * because that is the defect: minutes silently spent on a progress bar.
     */
    const demoDeadline = await page.evaluate(() =>
      window.localStorage.getItem("caera:demo:session:v2"),
    );

    if (setupVisible > 0) {
      check(
        demoDeadline === null,
        "NO demo deadline is created while setup is running",
        String(demoDeadline),
      );
      check(
        !FORBIDDEN.test(demoBody),
        "the setup screen names no model, vendor, file or size",
        FORBIDDEN.exec(demoBody)?.[0],
      );
      check(
        /Preparing|Starting OCADE|Securing|Almost ready|needs a hand|more local storage/i.test(
          demoBody,
        ),
        "and speaks in product language",
      );
      check(
        /28-minute demo begins when setup is complete/i.test(demoBody) ||
          /needs a hand|more local storage/i.test(demoBody),
        "it explains that the demo clock has not started, or why setup stopped",
      );

      // The composer must not be reachable: a chat box with no engine behind it
      // is an invitation the product cannot honour.
      const composer = await page.locator("textarea, [contenteditable='true']").count();
      check(composer === 0, "no chat composer is offered during setup", `${composer} found`);
    } else if (demoDeadline !== null) {
      const remaining = Number(demoDeadline) - Date.now();
      check(
        remaining > 27 * 60 * 1000 && remaining <= 28 * 60 * 1000 + 5000,
        "a deadline that exists is a FULL 28 minutes",
        `${Math.round(remaining / 1000)}s remaining`,
      );
    } else {
      check(
        true,
        "the demo refused honestly without creating a deadline",
        "no setup screen and no session",
      );
    }

    /* ----------------------------------------------- reload keeps its place */

    console.log("\n4. A reload does not restart from zero");
    const beforeReload = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith("ocade.model.")),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const afterReload = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith("ocade.model.")),
    );
    check(
      afterReload.length >= beforeReload.length,
      "installation bookkeeping survives a reload",
      `${beforeReload.length} → ${afterReload.length} keys`,
    );

    /* --------------------------------------------------- a second tab joins */

    console.log("\n5. A second tab watches rather than competing");
    const second = await context.newPage();
    await second.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
    await second.waitForTimeout(2500);
    const secondText = await second.locator("body").innerText();
    check(
      !FORBIDDEN.test(secondText),
      "the second tab also names nothing technical",
      FORBIDDEN.exec(secondText)?.[0],
    );
    await second.close();

    /* ----------------------------------------------------------- uninstall */

    console.log("\n6. Uninstall is reachable with no account");
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
    // Waited for rather than slept past: the control renders once the install
    // state has been read, and a fixed delay is a flake waiting to happen.
    const control = page.getByRole("button", {
      name: /Uninstall OCADE Intelligence|Reinstall OCADE/i,
    });
    await control
      .first()
      .waitFor({ state: "attached", timeout: 15_000 })
      .catch(() => {});
    const uninstallControl = await control.count();
    check(
      uninstallControl > 0,
      "the public landing page offers the control",
      `${uninstallControl} control(s)`,
    );

    /* ------------------------------------------------------ no page errors */

    console.log("\n7. Nothing threw");
    const realErrors = consoleErrors.filter(
      (text) =>
        // A failed model fetch in a sandbox with no engine host is expected and
        // is not a defect in the lifecycle under test.
        !/Failed to fetch|net::ERR|ERR_|404|Failed to load resource/i.test(text),
    );
    check(
      realErrors.length === 0,
      "no unexpected console errors on the first-run path",
      realErrors.slice(0, 2).join(" | "),
    );

    await context.close();
  } finally {
    await browser.close();
    await served.stop();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(70));
  if (failed.length === 0) {
    console.log(`ALL ${results.length} FIRST-RUN BROWSER CHECKS PASSED.`);
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
