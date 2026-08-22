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
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

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
          !path.includes("$") &&
          // TanStack lists both "/x" and "/x/" for an index route.
          !(path.endsWith("/") && path.length > 1),
      ),
  ),
  // Deliberately not a route: a 404 must be a designed page, not a crash.
  "/this-route-does-not-exist",
];

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

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
];

const summary = [];

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

    for (const route of ROUTES) {
      consoleErrors.length = 0;
      failedRequests.length = 0;
      const where = `${route} [${viewport.name}]`;

      let landed = "";
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        /*
         * WAIT FOR CONTENT, NOT FOR A CLOCK.
         *
         * A fixed pause here reported five blank pages that were not blank. On
         * a dev server each route module is compiled the first time it is
         * asked for, and these routes are behind a sign-in — so the signed-out
         * pass redirected away without ever compiling them, and the signed-in
         * pass was their genuine cold build. The pause expired mid-compile and
         * the harness recorded "0 chars, 0 headings, 0 controls" about a page
         * that rendered perfectly a moment later.
         *
         * A blank page still fails, because the wait ENDS: what changes is that
         * it fails after the page has actually had its chance, which is the
         * difference between a defect report and a false one.
         */
        await page
          .waitForFunction(
            () => {
              const text = document.body?.innerText?.trim() ?? "";
              const controls = document.querySelectorAll("button, a[href], input").length;
              return text.length > 40 || controls > 0;
            },
            undefined,
            { timeout: 20000 },
          )
          .catch(() => undefined);
        // Then a short settle so late-arriving content is measured too.
        await page.waitForTimeout(400);
        landed = new URL(page.url()).pathname;
      } catch (error) {
        check(`${where} loads`, false, String(error).slice(0, 120));
        continue;
      }

      /*
       * READ TWICE IF THE FIRST READ IS EMPTY.
       *
       * A single sample can land in the middle of a navigation, where the
       * document is briefly empty — /auth/verify and /auth/callback were
       * reported as "0 chars, 0 headings, 0 controls" while rendering 964
       * characters and 16 controls every time they were looked at directly.
       *
       * A page that is genuinely blank is still blank on the second read, so
       * this removes the artefact without softening the check.
       */
      const measure = () =>
        page.evaluate(() => ({
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

      let body = await measure().catch(() => null);
      if (!body || (body.text.trim().length === 0 && body.controls === 0)) {
        await page.waitForTimeout(1500);
        body = (await measure().catch(() => null)) ?? {
          text: "",
          scrollWidth: 0,
          clientWidth: 1,
          headings: 0,
          controls: 0,
        };
      }

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

// The 404 is a designed page, and proving it is a page rather than a crash is
// the whole reason a nonsense address is in the list above.
const notFound = summary.filter((s) => s.route === "/this-route-does-not-exist");
check(
  "an address that does not exist gets a real 404 page",
  notFound.length > 0 && notFound.every((s) => s.chars > 40),
  notFound.map((s) => `${s.viewport}:${s.chars} chars`).join(", "),
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${LABEL}: ${ROUTES.length} routes × ${VIEWPORTS.length} viewports, ` +
    `${results.length - failed.length}/${results.length} checks passed`,
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
