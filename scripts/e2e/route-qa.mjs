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
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const LABEL = STATE ? "SIGNED IN" : "SIGNED OUT";

/*
 * Every navigable route. API endpoints, MCP transports and .well-known
 * documents are deliberately absent — they are not pages, and "it did not
 * render a heading" is a meaningless thing to say about a JSON endpoint.
 */
const ROUTES = [
  "/",
  "/auth",
  "/callback",
  "/reset-password",
  "/verify",
  "/pricing",
  "/company",
  "/faq",
  "/support",
  "/demo",
  "/download",
  "/privacy",
  "/terms",
  "/security",
  "/data-rights",
  "/products/ocade",
  "/founder/haans-antoni",
  "/checkout/success",
  "/home",
  "/onboarding",
  "/access-denied",
  "/ocade",
  "/ocade/work",
  "/ocade/tasks",
  "/ocade/projects",
  "/ocade/code",
  "/ocade/automations",
  "/ocade/activity",
  "/ocade/artifacts",
  "/ocade/connectors",
  "/ocade/devices",
  "/ocade/health",
  "/ocade/inbox",
  "/ocade/knowledge",
  "/ocade/lab",
  "/ocade/models",
  "/ocade/monitors",
  "/ocade/notifications",
  "/ocade/permissions",
  "/ocade/search",
  "/ocade/shared",
  "/ocade/studio",
  "/ocade/system",
  "/ocade/templates",
  "/cania",
  "/ficia",
  "/madee",
  "/settings",
  "/settings/appearance",
  "/settings/activity",
  "/settings/billing",
  "/settings/browser",
  "/settings/devices",
  "/settings/mobile",
  "/settings/privacy",
  "/settings/security",
  "/settings/skills",
  "/settings/support",
  "/settings/tasks",
  "/settings/usage",
  "/settings/vault",
  "/settings/voice",
  "/admin/launch-gate",
  "/admin/payments-checklist",
  "/admin/support",
  "/admin/users",
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

      const body = await page.evaluate(() => ({
        text: document.body?.innerText ?? "",
        // Horizontal overflow is measured against the DOCUMENT, not an element:
        // a single wide child is exactly the defect, and it only shows up here.
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        headings: document.querySelectorAll("h1,h2,h3").length,
        controls: document.querySelectorAll(
          "button, a[href], input, select, textarea, [role=button]",
        ).length,
      }));

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
