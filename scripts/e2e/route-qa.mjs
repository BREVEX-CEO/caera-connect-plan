/**
 * EVERY ROUTE, IN A REAL BROWSER, THE WAY A CUSTOMER MEETS IT.
 *
 * The unit suite renders routes in jsdom and the settings audit walks one
 * section tree. Neither answers the question a person actually asks: if I type
 * this address, or refresh here, or open it on a phone — does a working page
 * appear, or a blank screen with a stack trace in the console?
 *
 * So this visits every navigable route in Chromium, at desktop AND phone width,
 * signed out and signed in, and records what a customer would see:
 *
 *   * did anything render at all, or is the page effectively empty;
 *   * did a raw developer error reach the screen — a stack trace, "undefined is
 *     not a function", a webpack/vite overlay — which is never acceptable in
 *     front of a user even when the underlying failure is real;
 *   * did the page scroll SIDEWAYS on a phone, which is the single most common
 *     mobile defect and is invisible on a desktop run;
 *   * did the console or the network report failures, and to where.
 *
 * WHAT IT DELIBERATELY TOLERATES. A route that is genuinely gated — sign-in
 * required, admin only — is not a failure; being sent somewhere sensible with
 * an explanation is the correct behaviour, and the check is that SOMETHING
 * coherent rendered, not that the page was reached.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

/**
 * Where a failing route's evidence is written.
 *
 * Beside the run rather than into the repository: this is diagnostic output for
 * one run, not a tracked artefact, and a captured page can carry the fixture's
 * session state.
 */
const EVIDENCE_DIRECTORY = process.env.OCADE_ROUTE_QA_EVIDENCE ?? ".route-qa-evidence";
mkdirSync(EVIDENCE_DIRECTORY, { recursive: true });

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const LABEL = STATE ? "SIGNED IN" : "SIGNED OUT";

/*
 * Every navigable route. API endpoints, MCP transports and .well-known
 * documents are deliberately absent — they are not pages, and "it did not
 * render a heading" is a meaningless thing to say about a JSON endpoint.
 */
/*
 * THE ROUTE LIST COMES FROM THE APP, NOT FROM MEMORY.
 *
 * It was hand-written first, and it was wrong in both directions: it invented
 * /support, /security, /callback and /verify — which are child segments of
 * /settings and /auth, not addresses — so four "routes" were really the 404
 * page passing a check that something rendered. And it MISSED real ones:
 * /demo/control, /demo/ocade, /demo/settings, /auth/callback, /auth/verify.
 *
 * Reading TanStack's generated route tree means the audit covers what the
 * application actually serves, and keeps covering it when routes are added.
 */
const generated = readFileSync("src/routeTree.gen.ts", "utf8");
const byFullPath = /interface FileRoutesByFullPath \{([\s\S]*?)\n\}/.exec(generated);
if (!byFullPath) {
  console.error("could not read the route tree; run `npm run routes:generate` first");
  process.exit(1);
}
const ROUTES = [
  ...new Set(
    [...byFullPath[1].matchAll(/^\s*'([^']+)':/gm)]
      .map((m) => m[1])
      /*
       * NORMALISE THE TRAILING SLASH RATHER THAN DROPPING IT.
       *
       * This used to drop every path ending in "/", on the assumption that
       * TanStack always lists an index route twice — once as "/x" and once as
       * "/x/". That is true only while a plain "/x" route also exists. When
       * `/support` became an index route with a sibling `$slug`, the tree
       * stopped listing a bare "/support" at all, the filter silently removed
       * it, and the Help Center home dropped out of the audit — 74 routes where
       * the run before had 75, with nothing to say it had lost one.
       *
       * Collapsing the slash and letting the Set dedupe keeps the original
       * intent (one entry per address) without the assumption.
       */
      .map((path) => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path))
      // Not pages: API endpoints, the MCP transport, well-known documents and
      // generated text files. "It rendered no heading" says nothing about JSON.
      .filter(
        (path) =>
          !path.startsWith("/api/") &&
          !path.startsWith("/.mcp") &&
          !path.startsWith("/.well-known") &&
          !path.startsWith("/.lovable") &&
          path !== "/mcp" &&
          path !== "/robots.txt" &&
          path !== "/sitemap.xml" &&
          // A bare $param cannot be visited without inventing a value, and the
          // concrete siblings above already cover the layout it renders.
          !path.includes("$"),
      ),
  ),
  // Deliberately not a route: a 404 must be a designed page, not a crash.
  "/this-route-does-not-exist",
];

/*
 * A FILTER, SO ONE ROUTE CAN BE INVESTIGATED WITHOUT WAITING FOR SEVENTY-THREE.
 *
 * Every false failure this harness has produced was diagnosed by re-running it,
 * and re-running it costs a full pass. `OCADE_ROUTE_FILTER` is a substring — or
 * a comma-separated list of them — matched against the route path, so a single
 * suspect route can be re-measured in seconds. It narrows the run and nothing
 * else: the checks, the waits and the thresholds are identical, so a route that
 * passes under the filter passes in the full pass for the same reasons.
 */
const ROUTE_FILTER = (process.env.OCADE_ROUTE_FILTER ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const SELECTED = ROUTE_FILTER.length
  ? ROUTES.filter((route) => ROUTE_FILTER.some((needle) => route.includes(needle)))
  : ROUTES;
if (ROUTE_FILTER.length && !SELECTED.length) {
  console.error(`no route matches ${ROUTE_FILTER.join(", ")}`);
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Text that must never reach a customer, however broken the page is. */
const DEVELOPER_LEAKS = [
  /undefined is not a function/i,
  /cannot read propert(y|ies) of (undefined|null)/i,
  /\bat\s+\w+\s+\(https?:\/\/[^)]+:\d+:\d+\)/, // a stack frame
  /ReferenceError|TypeError:|SyntaxError:/,
  /vite.*error overlay/i,
  /\[plugin:.*\]/,
  /Objects are not valid as a React child/i,
];

/** The same leaks as DEVELOPER_LEAKS, as strings, for post-click checking. */
const DEV_LEAK_SOURCE = DEVELOPER_LEAKS.map((r) => r.source);

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
];

const summary = [];
let totalPressed = 0;

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ...(STATE ? { storageState: STATE } : {}),
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const failedRequests = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
    });
    page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message.slice(0, 160)}`));
    page.on("requestfailed", (r) =>
      failedRequests.push({ url: r.url(), reason: r.failure()?.errorText ?? "?" }),
    );

    /*
     * WHOLE-DOCUMENT NAVIGATIONS, COUNTED.
     *
     * A click can replace the document rather than route within it, and OCADE
     * does exactly that in one place on purpose: `isolation-upgrade.ts` calls
     * `location.replace` once per session to obtain a cross-origin-isolated
     * document, because isolation is decided when a document is CREATED and a
     * client-side route change into an inference route would otherwise leave
     * the engine on one core.
     *
     * That reload aborts every in-flight chunk and starts the heaviest route in
     * the product from nothing. `/settings/devices` reported "0 chars left"
     * because the settle budget was measured from the click, not from the
     * document that click produced — the page was mid-reload when the fifteen
     * seconds ran out, and the harness called a working upgrade a broken page.
     *
     * Counting the navigations lets the settle loop restart its budget for a
     * document it has not yet waited for. Bounded, so a page reloading in a
     * loop still fails rather than being waited on forever.
     */
    let documentLoads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documentLoads += 1;
    });

    for (const route of SELECTED) {
      consoleErrors.length = 0;
      failedRequests.length = 0;
      const where = `${route} [${viewport.name}]`;

      let landed = "";
      try {
        try {
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        } catch (error) {
          /*
           * A ROUTE THAT REDIRECTS IS NOT A ROUTE THAT FAILED.
           *
           * `/auth/callback` exists to send a signed-in visitor onward, so the
           * moment it mounts it navigates — and Playwright reports the `goto`
           * that was still in flight as "interrupted by another navigation".
           * The old code let that throw, which failed the redirecting route AND
           * every route after it in the same page, because each subsequent
           * `goto` was interrupted by the redirect still settling. One correct
           * product behaviour was turning into fifty red lines whose number
           * depended on timing.
           *
           * So an interruption is waited out rather than recorded: whatever the
           * browser settled on is the page a person would be looking at, and
           * every assertion below runs against that. Any other navigation
           * failure is still a real one and still rethrows.
           */
          if (!/interrupted by another navigation/i.test(String(error))) throw error;
          await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
        }
        landed = new URL(page.url()).pathname;
      } catch (error) {
        check(`${where} loads`, false, String(error).slice(0, 120));
        continue;
      }

      const measure = () =>
        page.evaluate(() => ({
          path: location.pathname,
          text: document.body?.innerText ?? "",
          // Horizontal overflow is measured against the DOCUMENT, not an
          // element: a single wide child is exactly the defect, and it only
          // shows up here.
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          headings: document.querySelectorAll("h1,h2,h3").length,
          controls: document.querySelectorAll(
            "button, a[href], input, select, textarea, [role=button]",
          ).length,
        }));

      /*
       * WAIT FOR CONTENT, IN THE DOCUMENT THAT ACTUALLY ENDS UP IN FRONT OF THE
       * PERSON — NOT FOR A CLOCK, AND NOT IN THE DOCUMENT THAT WAS THERE FIRST.
       *
       * Three separate false failures came out of this one place, each fixed
       * and each leaving the next one visible:
       *
       *   1. A fixed pause. On a cold route the pause expired mid-compile and
       *      the harness reported "0 chars, 0 headings, 0 controls" about a
       *      page that rendered perfectly a moment later.
       *   2. One retry, then a twelve-second re-measuring loop. Better, and
       *      still only ever a SAMPLE: it re-read the page without ever waiting
       *      for it again.
       *   3. The one this replaces. `waitForFunction` is evaluated inside the
       *      current document, so a route whose whole job is to send a visitor
       *      onward destroys the execution context the wait is running in. The
       *      wait rejects, the rejection is swallowed by design, and the
       *      measurement that follows lands in the brand-new empty document of
       *      the destination. `/checkout/success` redirects to `/home`, which
       *      redirects to `/ocade`; a direct probe showed 0 characters at 500ms
       *      and 960 characters with 53 controls at 1.5s, and the harness
       *      recorded the first number about a route that works.
       *
       * So the wait is re-entered in whatever document is current, until the
       * page both HAS content and STOPS MOVING: a sample taken while the URL is
       * changing under it is discarded rather than reported. A page that is
       * genuinely blank is still blank when the budget runs out, so this
       * removes the artefact without softening the check.
       */
      const hasContent = () => {
        const text = document.body?.innerText?.trim() ?? "";
        const controls = document.querySelectorAll("button, a[href], input").length;
        return text.length > 40 || controls > 0;
      };
      let body = null;
      /*
       * Fifteen seconds, against a production build whose slowest observed
       * redirect chain settles in 1.5. It is generous rather than tight because
       * the cost of being wrong in the tight direction is a false defect
       * report, and the cost in the other direction is only time on a page that
       * is genuinely blank.
       *
       * AND THE BUDGET RESTARTS FOR A DOCUMENT IT HAS NOT YET WAITED FOR.
       *
       * The loop after the clicks already did this; this one did not, and the
       * difference showed up as `/settings/devices` reporting "0 chars, 0
       * headings, 0 controls" in one full pass and passing ten times out of ten
       * under the focused harness. The evidence named the mechanism: no console
       * error, and two vendor chunks recorded as `net::ERR_ABORTED` — the
       * signature of `isolation-upgrade.ts` calling `location.replace` to get a
       * cross-origin-isolated document. That reload aborts every in-flight chunk
       * and restarts the heaviest route in the product from nothing, and the
       * fifteen seconds had been spent on the document it replaced.
       *
       * AND A CLIENT-SIDE REDIRECT IS A PAGE IT HAS NOT WAITED FOR EITHER.
       *
       * Extending on `documentLoads` alone still missed the case the router
       * handles by itself: `/settings/billing` throws `redirect({ to:
       * "/settings/usage" })` in `beforeLoad` on a deployment with no payment
       * provider, which changes the URL and the component without loading a
       * document. The budget went on measuring the route that redirected. In a
       * full pass that reported "0 chars, 0 headings, 0 controls" for
       * `/settings/billing` while the same two routes passed 23/23 under the
       * focused harness, and the captured evidence was a document body holding
       * nothing but the entry script — a page that had barely started.
       *
       * Three extensions: the client-side redirect, the isolation upgrade that
       * replaces the document it lands on, and one redirect after that. A
       * fourth would be a page that cannot settle, which is what this check
       * exists to catch.
       */
      let settleBy = Date.now() + 15_000;
      let extensionsLeft = 3;
      let seenLoads = documentLoads;
      let seenUrl = page.url();
      while (Date.now() < settleBy) {
        const remaining = settleBy - Date.now();
        await page
          .waitForFunction(hasContent, undefined, { timeout: Math.max(500, remaining) })
          .catch(() => undefined);
        // A short settle so late-arriving content is measured too, and so a
        // redirect that is already in flight has landed before the reading.
        await page.waitForTimeout(400);
        const before = page.url();
        const sample = await measure().catch(() => null);
        const after = page.url();
        if (documentLoads !== seenLoads || after !== seenUrl) {
          // A new document or a new address. The budget so far measured what
          // came before it, and any sample taken from that describes a page
          // nobody is looking at.
          seenLoads = documentLoads;
          seenUrl = after;
          if (extensionsLeft > 0) {
            extensionsLeft -= 1;
            settleBy = Date.now() + 15_000;
            continue;
          }
        }
        if (!sample) continue;
        body = sample;
        const moved = before !== after || new URL(after).pathname !== sample.path;
        const rendered = sample.text.trim().length > 0 || sample.controls > 0;
        if (rendered && !moved) break;
      }
      body ??= { path: landed, text: "", scrollWidth: 0, clientWidth: 1, headings: 0, controls: 0 };
      // Where the person ended up, read after the page settled rather than
      // before it: the summary's redirect column was reporting the first hop.
      landed = body.path ?? landed;

      check(
        `${where} renders something a person can use`,
        body.text.trim().length > 40 && (body.headings > 0 || body.controls > 0),
        `${body.text.trim().length} chars, ${body.headings} headings, ${body.controls} controls`,
      );

      const leak = DEVELOPER_LEAKS.find((pattern) => pattern.test(body.text));
      check(
        `${where} shows no raw developer error`,
        !leak,
        leak ? `${leak} matched in: ${body.text.slice(0, 140)}` : "",
      );

      check(
        `${where} does not scroll sideways`,
        body.scrollWidth <= body.clientWidth + 1,
        `${body.scrollWidth} > ${body.clientWidth}`,
      );

      /*
       * TOUCH TARGETS, MEASURED RATHER THAN ASSUMED.
       *
       * A control that is 18 pixels tall is usable with a mouse and a coin toss
       * with a thumb. WCAG 2.5.8 puts the floor at 24x24 CSS pixels, and that
       * is the number used here — not the 44x44 many design systems prefer,
       * because the point is to catch controls that are genuinely hard to hit
       * rather than to relitigate a house style.
       *
       * Inline links inside a paragraph are exempt: WCAG exempts them too, they
       * are sized by the text around them, and flagging every one would bury
       * the real finding under prose.
       */
      if (viewport.name === "phone") {
        const tiny = await page.evaluate(() => {
          const MIN = 24;
          const out = [];
          const nodes = document.querySelectorAll(
            "button, [role=button], input:not([type=hidden]), select, textarea, a[href]",
          );
          for (const node of nodes) {
            const el = /** @type {HTMLElement} */ (node);
            if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") continue;
            /*
             * MEASURE WHAT A THUMB CAN ACTUALLY HIT.
             *
             * A 16x16 checkbox wrapped in a label is not a 16x16 target: the
             * label activates it, so the label is the target. The first version
             * of this check measured the input itself and reported the consent
             * dialog's two checkboxes as too small on every authenticated route
             * — twenty-odd identical "defects" that were one correct design.
             * WCAG 2.5.8 is about the activation area for the same reason.
             */
            const label =
              el.closest("label") ??
              (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
            /*
             * LAYOUT SIZE, NOT TRANSFORMED SIZE.
             *
             * getBoundingClientRect() reports the box AFTER CSS transforms, and
             * the landing page animates its panels with scale — so a button
             * styled `h-11` (44px) measured 17px tall simply because it was
             * scrolled away and scaled down. That is not a small target; it is
             * a target being looked at through a transform.
             *
             * offsetWidth/offsetHeight are layout values and ignore transforms,
             * which is the question actually being asked: how big is this
             * control when the person reaches it.
             */
            const own = {
              width: el.offsetWidth || el.getBoundingClientRect().width,
              height: el.offsetHeight || el.getBoundingClientRect().height,
              left: 0,
              top: 0,
              right: el.offsetWidth || 0,
              bottom: el.offsetHeight || 0,
            };
            /*
             * The activation area is the control PLUS its label, so take the
             * union rather than picking one. Preferring the label alone was
             * wrong the other way: a caption sitting above a full-width field
             * is a 308x16 strip, and reporting that as the target flagged
             * perfectly reachable password fields.
             */
            let rect = own;
            if (label) {
              // The activation area is the control PLUS its label. Preferring
              // the label alone was wrong the other way: a caption above a
              // full-width field is a 308x16 strip, and calling that the target
              // flagged perfectly reachable password fields.
              rect = {
                width: Math.max(own.width, label.offsetWidth || 0),
                height: Math.max(own.height, label.offsetHeight || 0),
              };
            }
            if (rect.width === 0 || rect.height === 0) continue; // not rendered
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") continue;
            if (Number(style.opacity) === 0) continue;
            /*
             * A 1x1 input is the standard way to hide a file picker behind a
             * real button: the button is the target, the input is plumbing.
             * Reporting it as a 1x1 tap target says nothing true about what a
             * person touches.
             */
            if (el.offsetWidth <= 4 && el.offsetHeight <= 4) continue;
            if (el.className && /(^|\s)sr-only(\s|$)/.test(String(el.className))) continue;
            // An anchor sitting inside a block of text is an inline link.
            /*
             * An anchor that sits INSIDE a sentence is exempt, and WCAG 2.5.8
             * exempts it for the same reason: it is sized by the text around
             * it, and padding it would break the line box it lives in.
             *
             * The test is simply "is there other text in this sentence" — an
             * earlier version demanded twenty characters more than the link
             * itself, and "Changed your mind? Back to sign in." missed that by
             * one character and was reported as a defect.
             */
            if (el.tagName === "A" && style.display.startsWith("inline")) {
              const parentText = el.parentElement?.textContent?.trim().length ?? 0;
              const ownText = el.textContent?.trim().length ?? 0;
              if (parentText > ownText + 2) continue;
            }
            if (rect.width < MIN || rect.height < MIN) {
              // Enough to FIND the control again: an unlabelled icon button
              // reported only as `button 20x28 ""` is a defect nobody can act
              // on without re-deriving where it was.
              const name =
                el.getAttribute("aria-label") ??
                el.getAttribute("title") ??
                (el.textContent ?? "").trim().slice(0, 24);
              out.push(
                `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${label ? "(label)" : ""} ` +
                  `${Math.round(rect.width)}x${Math.round(rect.height)} ` +
                  `"${name}" [${String(el.className).slice(0, 60)}]`,
              );
            }
          }
          return out;
        });
        check(
          `${where} has no touch target below 24x24`,
          tiny.length === 0,
          tiny.slice(0, 4).join(" | "),
        );
      }

      /*
       * PRESS EVERYTHING, LIKE A PERSON POKING AT THE PAGE.
       *
       * Visiting a route proves it renders. It does not prove the controls on
       * it do anything but throw — and a button whose handler dies leaves the
       * page looking perfectly fine while doing nothing at all.
       *
       * So every enabled, visible control on the page gets pressed, on the
       * desktop pass. What is being asserted is NOT that each one does the
       * right thing — the audit has no way to know what right is — but that
       * pressing it does not throw, does not spill a developer error onto the
       * screen, and does not leave the page blank.
       *
       * Links that leave the page are skipped: following them turns this into
       * an unbounded crawl, and the route list already visits every one of them
       * directly. Anything that opens a new tab or downloads is skipped for the
       * same reason.
       */
      if (viewport.name === "desktop") {
        const pressed = await page.evaluate(() => {
          const clickable = [...document.querySelectorAll("button, [role=button]")].filter(
            (node) => {
              const el = /** @type {HTMLElement} */ (node);
              if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true")
                return false;
              if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
              const style = getComputedStyle(el);
              if (style.visibility === "hidden" || style.display === "none") return false;
              // Anything that would navigate, download or open a window takes
              // the run somewhere else and is covered by visiting the route.
              const label = `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`;
              if (/sign out|log out|delete|download|export|revoke/i.test(label)) return false;
              return true;
            },
          );
          let clicked = 0;
          const failures = [];
          for (const el of clickable) {
            try {
              /** @type {HTMLElement} */ (el).click();
              clicked += 1;
            } catch (error) {
              failures.push(
                `${(el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 30)}: ${String(error).slice(0, 60)}`,
              );
            }
          }
          return { clicked, failures };
        });

        totalPressed += pressed.clicked;
        check(
          `${where} survives every button being pressed`,
          pressed.failures.length === 0,
          pressed.failures.slice(0, 3).join(" | "),
        );

        /*
         * Let whatever the clicks started finish before moving on.
         *
         * Some of those buttons navigate, and a navigation still in flight when
         * the loop calls goto for the next route makes Playwright abort with
         * "interrupted by another navigation" — reported against the NEXT
         * route, which had done nothing wrong. Thirty-odd routes failed that
         * way before this wait existed.
         */
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        await page.waitForTimeout(600);

        /*
         * And the page is still a page afterwards, with no stack trace on it.
         *
         * Read twice, for the same reason the first measurement does: some of
         * those buttons navigate — /settings has a "Close settings" that goes
         * home — and a single read can land in the blank moment between two
         * documents. It reported /settings as emptied by its own buttons when
         * the page it moved to was perfectly healthy.
         */
        const readBody = () =>
          page.evaluate(() => document.body?.innerText ?? "").catch(() => "navigated away");
        let after = await readBody();
        /*
         * Wait for content, on the same reasoning the FIRST measurement gives.
         *
         * A single 1.5s retry was not enough on a loaded dev server: a control
         * that navigates somewhere not yet compiled leaves a genuinely empty
         * body while Vite builds the route, and the harness recorded "0 chars
         * left" about a page that painted a moment later. Which route it caught
         * moved from run to run, which is the signature of a race rather than
         * of a defect.
         *
         * The wait still ENDS, so a page that really never comes back still
         * fails — what changes is that the failure means what it says.
         */
        /*
         * RE-WAIT IN THE CURRENT DOCUMENT, NOT JUST RE-READ.
         *
         * This loop used to poll `innerText` and nothing else, which is the
         * defect that was already fixed for the FIRST measurement further up
         * and left in place here. Some of these controls navigate — the
         * settings shell has a Close that goes home — and a poll cannot tell
         * "this page is broken" from "the destination has not painted yet": it
         * samples the new document's empty body twelve times and reports zero.
         *
         * So it now waits for content the same way the first measurement does,
         * re-entering the wait in whatever document is current, and discards a
         * sample taken while the URL is still changing under it. A page that is
         * genuinely emptied by its own buttons is still empty when the budget
         * runs out, so the check is not softened — only the race is removed.
         */
        let settleBy = Date.now() + 15_000;
        /*
         * At most two extensions: one for the isolation upgrade's reload, one
         * for a redirect that follows it. A third would be a page that cannot
         * settle, which is the thing this check exists to catch.
         */
        let extensionsLeft = 2;
        let seenLoads = documentLoads;
        let seenUrl = page.url();
        while (Date.now() < settleBy) {
          if (after !== "navigated away" && after.trim().length > 0) break;
          const remaining = settleBy - Date.now();
          await page
            .waitForFunction(() => (document.body?.innerText?.trim().length ?? 0) > 0, undefined, {
              timeout: Math.max(500, remaining),
            })
            .catch(() => undefined);
          await page.waitForTimeout(400);
          const before = page.url();
          after = await readBody();
          if (page.url() !== before) {
            // Read mid-navigation. Whatever it said is about a document that is
            // already gone.
            after = "";
          }
          /*
           * A CLIENT-SIDE ROUTE CHANGE COUNTS AS A NEW PAGE TOO.
           *
           * `framenavigated` fires for DOCUMENT navigations. TanStack Router
           * replaces the view without one, so pressing a link that leaves the
           * route — a "Back to Settings", a delete that returns to Chat —
           * changed everything being measured and bumped nothing. The budget
           * kept running against a page that no longer existed, and whichever
           * route happened to hold such a control failed with "0 chars left":
           * `/settings/data` in one pass, `/settings/appearance` in the next.
           * A moving target across runs is the signature of a race, not of a
           * broken page.
           *
           * So the URL is watched alongside the document count, and either one
           * changing earns the same bounded extension.
           */
          const moved = documentLoads !== seenLoads || page.url() !== seenUrl;
          if (moved) {
            seenLoads = documentLoads;
            seenUrl = page.url();
            if (extensionsLeft > 0) {
              extensionsLeft -= 1;
              settleBy = Date.now() + 15_000;
            }
          }
        }
        const brokeAfterClicks = DEV_LEAK_SOURCE.find((p) => new RegExp(p, "i").test(after));
        const survivedClicks =
          !brokeAfterClicks && (after.trim().length > 0 || after === "navigated away");

        /*
         * CAPTURE THE PAGE WHEN THIS FAILS, BECAUSE IT DOES NOT ALWAYS FAIL.
         *
         * `/settings/voice` reported "0 chars left" once in three full runs and
         * then would not reproduce: a focused harness pressed every control on
         * it six times against the same build and the body went from 2,497 to
         * 18,173 characters every time. An intermittent failure whose evidence
         * is a single number cannot be diagnosed, and re-running until it is
         * green is how a real defect gets waved through.
         *
         * So the failure now writes down what it saw — the served HTML, the
         * console, the failed requests, the URL — beside the run. The next
         * occurrence is diagnosable from the artefact rather than from a guess.
         */
        if (!survivedClicks) {
          const evidence = {
            route,
            viewport: viewport.name,
            url: page.url(),
            clicked: pressed.clicked,
            clickFailures: pressed.failures,
            textLength: after.trim().length,
            textSample: after.slice(0, 400),
            consoleErrors: [...consoleErrors],
            failedRequests: [...failedRequests],
            capturedAt: new Date().toISOString(),
          };
          const stem = `route-qa-failure-${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root"}-${viewport.name}`;
          try {
            const html = await page.content();
            await writeFile(`${EVIDENCE_DIRECTORY}/${stem}.html`, html, "utf8");
            await writeFile(
              `${EVIDENCE_DIRECTORY}/${stem}.json`,
              JSON.stringify(evidence, null, 2),
              "utf8",
            );
            console.log(`  captured evidence: ${EVIDENCE_DIRECTORY}/${stem}.{html,json}`);
          } catch (error) {
            console.log(`  could not capture evidence: ${String(error).slice(0, 120)}`);
          }
        }

        check(
          `${where} shows no developer error after being pressed — ${pressed.clicked} control(s)`,
          survivedClicks,
          brokeAfterClicks ? after.slice(0, 140) : `${after.trim().length} chars left`,
        );
      }

      const offLoopback = failedRequests.filter((r) => {
        try {
          const { hostname } = new URL(r.url);
          return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
        } catch {
          return true;
        }
      });
      check(
        `${where} makes no failing request outside loopback`,
        offLoopback.length === 0,
        offLoopback
          .map((r) => `${r.reason} ${r.url}`)
          .join("; ")
          .slice(0, 160),
      );

      summary.push({
        route,
        viewport: viewport.name,
        landed,
        chars: body.text.trim().length,
        controls: body.controls,
        consoleErrors: consoleErrors.length,
      });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

/*
 * The 404 is a designed page, and proving it is a page rather than a crash is
 * the whole reason a nonsense address is in the list above.
 *
 * Only asserted when that address was actually visited. Under a route filter it
 * is not, and a check that fails because it was never run reports a broken 404
 * page on a run that never looked at one — a false failure of exactly the kind
 * the rest of this file exists to remove.
 */
if (SELECTED.includes("/this-route-does-not-exist")) {
  const notFound = summary.filter((s) => s.route === "/this-route-does-not-exist");
  check(
    "an address that does not exist gets a real 404 page",
    notFound.length > 0 && notFound.every((s) => s.chars > 40),
    notFound.map((s) => `${s.viewport}:${s.chars} chars`).join(", "),
  );
}

/*
 * Say how many controls were actually pressed.
 *
 * "Survives every button being pressed" passes just as happily when the answer
 * is zero buttons, and a check that cannot fail is not a check. Printing the
 * count is what makes a silently empty pass visible.
 */
check(
  "the click pass actually pressed things",
  totalPressed >= Math.floor(SELECTED.length / 2),
  `${totalPressed} controls pressed across ${SELECTED.length} routes`,
);

const failed = results.filter((r) => !r.ok);

console.log(
  `\n${LABEL}: ${SELECTED.length} routes × ${VIEWPORTS.length} viewports, ` +
    `${results.length - failed.length}/${results.length} checks passed, ` +
    `${totalPressed} controls pressed`,
);
if (failed.length) {
  const byRoute = new Map();
  for (const f of failed) {
    const route = f.name.split(" ")[0];
    byRoute.set(route, (byRoute.get(route) ?? 0) + 1);
  }
  console.log(
    "ROUTES WITH FAILURES:\n  " +
      [...byRoute.entries()].map(([r, n]) => `${r} (${n})`).join("\n  "),
  );
  process.exitCode = 1;
}
