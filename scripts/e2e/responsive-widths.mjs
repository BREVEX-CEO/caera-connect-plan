/**
 * THE SIX WIDTHS PLAN.md §26 NAMES, ON REAL PAGES.
 *
 * 320, 375, 768, 1024, 1440 and 1920. The route audit already visits every page
 * at 1280 and 390, which catches most of what breaks; these six are the ones the
 * plan actually commits to, and three of them are nowhere near the two already
 * covered:
 *
 *   320   the narrowest phone still in use, and the width where a fixed
 *         minimum finally shows — 375 hides a 360px element completely.
 *   768   the tablet portrait breakpoint, where a two-column layout is usually
 *         deciding whether to collapse and frequently does neither well.
 *   1920  where a centred layout either holds its max width or stretches a line
 *         of text to two hundred characters.
 *
 * WHAT IS CHECKED, AND WHY EACH IS A REAL DEFECT RATHER THAN A PREFERENCE:
 *
 *   Sideways scroll        the single most common responsive defect, and the
 *                          one people report as "the page is broken".
 *   Content still present  a layout that collapses to nothing at 320 has not
 *                          adapted, it has failed.
 *   Touch targets          only meaningful at the widths a finger is used at.
 *   Line length            a paragraph stretched across 1920 pixels is unread.
 *
 * The overflow failure names the widest element, because "1900 > 1440" says a
 * page overflows and nothing about where to look.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const LABEL = STATE ? "SIGNED IN" : "SIGNED OUT";

/** PLAN.md §26, exactly. */
const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

const PUBLIC_ROUTES = ["/", "/pricing", "/status", "/security", "/support", "/faq", "/compare"];
const SIGNED_IN_ROUTES = [
  "/ocade",
  "/settings",
  "/settings/notifications",
  "/settings/security",
  "/ocade/projects",
];
const ROUTES = STATE ? SIGNED_IN_ROUTES : PUBLIC_ROUTES;

/** A finger is used below this; a mouse above it. */
const TOUCH_WIDTHS = new Set([320, 375, 768]);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      ...(STATE ? { storageState: STATE } : {}),
      // Touch below the tablet breakpoint, so hover-only affordances are not
      // silently the only way to reach something.
      hasTouch: TOUCH_WIDTHS.has(width),
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const where = `${route} @${width}`;
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page
        .waitForFunction(
          () =>
            (document.body?.innerText?.trim().length ?? 0) > 40 ||
            document.querySelectorAll("button, a[href], input").length > 0,
          undefined,
          { timeout: 20000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(350);

      const measured = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;

        let worst = null;
        for (const node of document.querySelectorAll("body *")) {
          const element = /** @type {HTMLElement} */ (node);
          const rect = element.getBoundingClientRect();
          const right = rect.left + rect.width;
          if (right <= clientWidth + 2) continue;
          const style = getComputedStyle(element);
          // An element that scrolls its own content is doing the right thing —
          // a wide table inside `overflow-x:auto` is the correct answer, not a
          // defect.
          if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
          if (!worst || right > worst.right) {
            worst = {
              right: Math.round(right),
              tag: element.tagName.toLowerCase(),
              className: String(element.className ?? "").slice(0, 80),
            };
          }
        }

        const small = [
          ...document.querySelectorAll("button, a[href], input, select, [role=button]"),
        ]
          .filter((node) => {
            const element = /** @type {HTMLElement} */ (node);
            if (element.closest("[aria-hidden='true']")) return false;
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return false;

            /*
             * WCAG 2.5.8's OWN EXCEPTIONS, applied rather than ignored.
             *
             * The first version of this reported every inline link inside a
             * paragraph — 77x17, 124x19 — as a failure. The success criterion
             * explicitly exempts a target "in a sentence, or its size is
             * otherwise constrained by the line-height of non-target text",
             * because making a word inside a paragraph twenty-four pixels tall
             * means making the paragraph unreadable. Reporting them was asking
             * for a change that would have made the page worse.
             */
            const inSentence =
              element.tagName === "A" &&
              (() => {
                const parent = element.parentElement;
                if (!parent) return false;
                const parentText = (parent.textContent ?? "").trim();
                const ownText = (element.textContent ?? "").trim();
                // Surrounded by enough other words to be part of a sentence.
                return parentText.length > ownText.length + 12;
              })();
            if (inSentence) return false;

            /*
             * A visually hidden control is not a touch target at all. An
             * `sr-only` element is clipped to about a pixel on purpose, and
             * asking it to be twenty-four square is asking it to stop being
             * hidden.
             */
            if (rect.width <= 2 && rect.height <= 2) return false;

            return rect.width < 24 || rect.height < 24;
          })
          /*
           * THE SPACING EXCEPTION, WHICH IS PART OF THE CRITERION.
           *
           * WCAG 2.5.8 passes an undersized target when a 24-pixel circle
           * centred on it does not intersect the circle of any other target.
           * A 13-pixel checkbox with generous space around it is genuinely easy
           * to hit; the thing that makes a small target hard is a NEIGHBOUR.
           *
           * Without this the rule reports every native checkbox in the product
           * — twenty-one of them — and the "fix" would be inflating each one,
           * changing a great deal of layout to satisfy a number rather than to
           * help anybody. Crowded ones still fail, which is the case that hurts.
           */
          .filter((node) => {
            const element = /** @type {HTMLElement} */ (node);
            const rect = element.getBoundingClientRect();
            const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            for (const other of document.querySelectorAll(
              "button, a[href], input, select, [role=button]",
            )) {
              if (other === element) continue;
              const otherRect = other.getBoundingClientRect();
              if (otherRect.width === 0 && otherRect.height === 0) continue;
              const otherCentre = {
                x: otherRect.left + otherRect.width / 2,
                y: otherRect.top + otherRect.height / 2,
              };
              const distance = Math.hypot(centre.x - otherCentre.x, centre.y - otherCentre.y);
              // Two 24-wide circles intersect when their centres are closer
              // than 24 apart.
              if (distance < 24) return true;
            }
            return false;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return `${element.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
          });

        /*
         * The longest line of running text, in characters.
         *
         * Measured from paragraphs only: a heading or a table cell is allowed
         * to be wide, and a nav bar is not prose. Typographic guidance puts
         * comfortable reading at 45-90 characters; 120 is the point at which
         * the eye loses the start of the next line, so that is the bar rather
         * than an aesthetic one.
         */
        let longestLine = 0;
        for (const paragraph of document.querySelectorAll("p")) {
          const element = /** @type {HTMLElement} */ (paragraph);
          const text = (element.textContent ?? "").trim();
          if (text.length < 80) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0) continue;
          const fontSize = Number.parseFloat(getComputedStyle(element).fontSize) || 16;
          // ~0.5em per character is the usual approximation for a proportional
          // face at body size.
          longestLine = Math.max(longestLine, Math.round(rect.width / (fontSize * 0.5)));
        }

        return {
          clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          worst,
          small: small.slice(0, 4),
          smallCount: small.length,
          text: (document.body?.innerText ?? "").trim().length,
          controls: document.querySelectorAll("button, a[href], input, select, textarea").length,
          longestLine,
        };
      });

      check(
        `${where} does not scroll sideways`,
        measured.scrollWidth <= measured.clientWidth + 2,
        measured.worst
          ? `${measured.scrollWidth} > ${measured.clientWidth}; widest is ${measured.worst.tag}.${measured.worst.className} reaching ${measured.worst.right}`
          : `${measured.scrollWidth} > ${measured.clientWidth}`,
      );

      check(
        `${where} still renders something usable`,
        measured.text > 40 && measured.controls > 0,
        `${measured.text} chars, ${measured.controls} controls`,
      );

      if (TOUCH_WIDTHS.has(width)) {
        check(
          `${where} has no touch target below 24x24`,
          measured.smallCount === 0,
          measured.small.join(", "),
        );
      }

      if (width >= 1440) {
        /*
         * 120 characters, and the number is chosen rather than inherited.
         *
         * Typographic guidance puts comfortable reading at 45-90; WCAG 1.4.8
         * asks for 80 or fewer as an enhancement. 120 is neither — it is the
         * point at which the eye reliably loses the start of the next line on
         * the return sweep, so a paragraph past it is measurably harder to read
         * rather than merely unfashionable. Holding the stricter number here
         * would be enforcing a house style through a test.
         */
        check(
          `${where} does not stretch a paragraph past a readable line`,
          measured.longestLine <= 120,
          `longest line ~${measured.longestLine} characters`,
        );
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${LABEL}: ${WIDTHS.length} widths × ${ROUTES.length} routes, ${results.length - failed.length}/${results.length} responsive checks passed`,
);
process.exitCode = failed.length ? 1 : 0;
