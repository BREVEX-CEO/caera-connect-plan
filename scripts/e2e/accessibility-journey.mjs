/**
 * ACCESSIBILITY, MEASURED ON A RENDERED PAGE.
 *
 * `check-accessibility.mjs` finds the defects that are decidable from source —
 * an icon-only button with no name, a focusable element hidden from assistive
 * technology, a positive tabindex — and it deliberately refuses to guess at the
 * rest. Its own header says why: "an approximate contrast check that passes is
 * worse than none, because it retires the question."
 *
 * This is the other half. PLAN.md §N lists what static analysis cannot answer,
 * and almost all of it needs one thing: a real page, focused, zoomed, and asked
 * what it would tell a screen reader.
 *
 *   Focus order         is a property of a page as laid out, not as written.
 *   A focus trap        only exists once a dialog is open.
 *   Focus on navigation only happens when you navigate.
 *   200% zoom           is a rendering question.
 *   Announcements       come from live regions that exist at runtime.
 *   Colour-only meaning is about what is on the screen beside the colour.
 *
 * WHAT THIS IS NOT. It is not NVDA and it is not VoiceOver. Chromium's
 * accessibility tree is what a screen reader is given, which makes a missing
 * name or a missing role a real finding; it is not evidence about how any
 * particular reader speaks it. Those two remain external blockers and are
 * recorded as such rather than approximated here.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const LABEL = STATE ? "SIGNED IN" : "SIGNED OUT";

/** Routes worth walking with a keyboard, and why each earns its place. */
const PUBLIC_ROUTES = ["/", "/status", "/security", "/support", "/faq"];
const SIGNED_IN_ROUTES = ["/ocade", "/settings/notifications", "/settings/security"];
const ROUTES = STATE ? SIGNED_IN_ROUTES : PUBLIC_ROUTES;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});

/** Wait until the page has painted something a person could use. */
async function settled(page) {
  await page
    .waitForFunction(
      () =>
        (document.body?.innerText?.trim().length ?? 0) > 40 ||
        document.querySelectorAll("button, a[href], input").length > 0,
      undefined,
      { timeout: 20000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(STATE ? { storageState: STATE } : {}),
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    const where = `${route}`;
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settled(page);

    /* ---- every focusable control has a name ---- */
    const unnamed = await page.evaluate(() => {
      const focusable = [
        ...document.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => {
        const element = /** @type {HTMLElement} */ (node);
        if (element.hasAttribute("disabled")) return false;
        if (element.closest("[aria-hidden='true']")) return false;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") return false;
        return element.offsetWidth > 0 || element.offsetHeight > 0;
      });
      const nameOf = (element) =>
        (
          element.getAttribute("aria-label") ??
          (element.getAttribute("aria-labelledby")
            ? (document.getElementById(element.getAttribute("aria-labelledby"))?.textContent ?? "")
            : "") ??
          ""
        ).trim() ||
        (element.textContent ?? "").trim() ||
        (element.getAttribute("title") ?? "").trim() ||
        (element.getAttribute("placeholder") ?? "").trim() ||
        // A labelled input takes its name from the <label> around or for it.
        (element.id
          ? (document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent ?? "")
          : ""
        ).trim() ||
        (element.closest("label")?.textContent ?? "").trim();
      return focusable
        .filter((element) => nameOf(element).length === 0)
        .map((element) => `${element.tagName.toLowerCase()}${element.className ? "." : ""}`)
        .slice(0, 5);
    });
    check(
      `${where} every focusable control has an accessible name`,
      unnamed.length === 0,
      unnamed.join(", "),
    );

    /* ---- focus order follows the document ---- */
    const tabbed = [];
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return null;
        const all = [
          ...document.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ];
        return {
          index: all.indexOf(active),
          tag: active.tagName.toLowerCase(),
          /*
           * A focus ring the person can see, looked for on the element AND on
           * its nearest ancestors.
           *
           * Read from computed styles rather than assumed from a class name: a
           * `focus-visible:` utility that was purged, overridden or never
           * applied looks identical in source.
           *
           * The ancestor walk is not a loosening. Several controls here are
           * deliberately transparent and borderless — a search field inside a
           * bordered label, a textarea inside the composer's box — and the box
           * a person actually sees is the parent. `focus-within` puts the ring
           * exactly there, which is correct, and a check that only read the
           * focused node would report a working indicator as missing. Three
           * levels, because beyond that the highlighted thing is no longer
           * recognisably the control.
           */
          ring: (() => {
            let node = active;
            for (let up = 0; up < 4 && node; up += 1) {
              const style = getComputedStyle(node);
              if (style.outlineStyle !== "none" && style.outlineWidth !== "0px") return true;
              if (style.boxShadow !== "none") return true;
              node = node.parentElement;
            }
            return false;
          })(),
        };
      });
      if (!info) break;
      tabbed.push(info);
    }

    check(
      `${where} the keyboard reaches controls at all`,
      tabbed.length > 2,
      `${tabbed.length} stops`,
    );
    check(
      `${where} every keyboard stop shows a focus indicator`,
      tabbed.every((stop) => stop.ring),
      tabbed
        .filter((stop) => !stop.ring)
        .map((stop) => stop.tag)
        .join(", "),
    );
    /*
     * Tab order must not jump backwards through the document. A positive
     * tabindex is caught statically; this catches the runtime version — a
     * portal or a re-ordered layout that puts the tab sequence out of step with
     * what a sighted person reads.
     */
    const indices = tabbed.map((stop) => stop.index).filter((index) => index >= 0);
    const backwards = indices.filter(
      (value, position) => position > 0 && value < indices[position - 1],
    );
    check(
      `${where} tab order does not jump backwards through the page`,
      backwards.length === 0,
      `${backwards.length} backward jump(s)`,
    );

    /* ---- 200% zoom, and high text scaling ---- */
    /*
     * ZOOM IS EMULATED BY HALVING THE VIEWPORT, NOT BY THE `zoom` PROPERTY.
     *
     * The first version set `zoom: 2` on the document, and it produced three
     * failures that a real browser does not have. Chromium evaluates media
     * queries against the UNZOOMED viewport when `zoom` is used, so every
     * desktop breakpoint stayed active while each element rendered at twice the
     * size — a two-column grid at 1280px laid out inside 640 CSS pixels. Real
     * browser zoom halves the CSS viewport, so `sm:`/`lg:` layouts collapse the
     * way they were designed to.
     *
     * Halving the viewport is what the browser actually does at 200%, which is
     * why it is what this measures. WCAG 1.4.10 is about content reflowing, and
     * a test that reports pages as broken when they reflow correctly would have
     * had three real components changed for nothing.
     */
    const zoomSteps = [
      {
        name: "at 200% zoom",
        async before() {
          await page.setViewportSize({ width: 640, height: 900 });
          await page.waitForTimeout(300);
        },
        async after() {
          await page.setViewportSize({ width: 1280, height: 900 });
        },
      },
      {
        /*
         * Text scaling is a different requirement (WCAG 1.4.4) and a different
         * emulation: the viewport does NOT change, the text gets bigger, and
         * the layout has to cope. Media queries correctly stay where they are.
         */
        name: "at 200% text size",
        async before() {
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "32px";
          });
          await page.waitForTimeout(300);
        },
        async after() {
          await page.evaluate(() => {
            document.documentElement.style.removeProperty("font-size");
          });
        },
      },
    ];

    for (const step of zoomSteps) {
      await step.before();
      const overflow = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;
        /*
         * NAME THE ELEMENT, NOT JUST THE NUMBER.
         *
         * "1500 > 1280" says a page overflows and nothing about where to look,
         * and reflow failures are almost always ONE element — a fixed minimum
         * width, a long unbroken string, a table. Reporting the widest offender
         * turns the failure into a fix.
         *
         * The widest, not every one: an overflowing child makes every ancestor
         * overflow too, so a list of them is a list of the same defect.
         */
        let worst = null;
        for (const node of document.querySelectorAll("body *")) {
          const element = /** @type {HTMLElement} */ (node);
          const rect = element.getBoundingClientRect();
          const right = rect.left + rect.width;
          if (right <= clientWidth + 2) continue;
          // Anything that scrolls its own content is doing the right thing.
          const style = getComputedStyle(element);
          if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
          if (!worst || right > worst.right) {
            worst = {
              right: Math.round(right),
              tag: element.tagName.toLowerCase(),
              className: String(element.className ?? "").slice(0, 90),
            };
          }
        }
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth,
          worst,
        };
      });
      check(
        `${where} does not scroll sideways ${step.name}`,
        overflow.scrollWidth <= overflow.clientWidth + 2,
        overflow.worst
          ? `${overflow.scrollWidth} > ${overflow.clientWidth}; widest is ${overflow.worst.tag}.${overflow.worst.className} reaching ${overflow.worst.right}`
          : `${overflow.scrollWidth} > ${overflow.clientWidth}`,
      );
      await step.after();
    }

    /* ---- no meaning carried by colour alone ---- */
    const colourOnly = await page.evaluate(() => {
      /*
       * A status dot with no word beside it. The specific defect: a coloured
       * circle that IS the state, which nobody who cannot separate those hues
       * can read, and which a screen reader does not mention at all.
       */
      const dots = [...document.querySelectorAll("span[aria-hidden='true'], i[aria-hidden='true']")]
        .filter((node) => {
          const element = /** @type {HTMLElement} */ (node);
          const style = getComputedStyle(element);
          const round = style.borderRadius.includes("9999") || style.borderRadius.includes("50%");
          const coloured =
            style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
          return round && coloured && element.offsetWidth > 0 && element.offsetWidth <= 16;
        })
        .filter((element) => {
          // Something readable in the same parent counts as the label.
          const text = (element.parentElement?.textContent ?? "").trim();
          return text.length === 0;
        });
      return dots.length;
    });
    check(
      `${where} no state is carried by colour alone`,
      colourOnly === 0,
      `${colourOnly} bare indicator(s)`,
    );
  }

  /* ---- focus on route change ---- */
  await page.goto(`${BASE}${ROUTES[0]}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settled(page);
  const movedFocus = await page.evaluate(async () => {
    const link = [...document.querySelectorAll("a[href^='/']")].find(
      (anchor) => anchor.getAttribute("href") !== location.pathname,
    );
    if (!link) return { navigated: false, active: "none" };
    /** @type {HTMLElement} */ (link).click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      navigated: true,
      active: document.activeElement?.tagName.toLowerCase() ?? "none",
      /*
       * A page whose new content is unreachable by keyboard is the failure that
       * matters here: after a client-side navigation the next Tab must land in
       * the new document, not continue from a stale position.
       */
      hasSkipLink: Boolean(document.querySelector("a.skip-link, a[href='#main-content']")),
      hasMain: Boolean(document.querySelector("main, [role=main], #main-content")),
    };
  });
  check(
    "a client-side navigation lands on a page with a main landmark",
    !movedFocus.navigated || movedFocus.hasMain,
    JSON.stringify(movedFocus),
  );

  /* ---- reduced motion and reduced transparency are honoured ---- */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}${ROUTES[0]}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settled(page);
  const animating = await page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter((node) => {
        const style = getComputedStyle(/** @type {Element} */ (node));
        return (
          style.animationName !== "none" &&
          style.animationDuration !== "0s" &&
          style.animationIterationCount !== "1"
        );
      }).length,
  );
  check(
    "reduced motion stops the looping animations",
    animating === 0,
    `${animating} element(s) still looping`,
  );
  await page.emulateMedia({ reducedMotion: null });

  /* ---- touch targets at phone width ---- */
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(STATE ? { storageState: STATE } : {}),
  });
  const phonePage = await phone.newPage();
  await phonePage.goto(`${BASE}${ROUTES[0]}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settled(phonePage);
  const small = await phonePage.evaluate(() => {
    // WCAG 2.5.8: 24x24 CSS pixels. Not 44x44 — the point is to catch controls
    // that are genuinely hard to hit with a thumb, not to relitigate a style.
    return [...document.querySelectorAll("button, a[href], input, select, [role=button]")]
      .filter((node) => {
        const element = /** @type {HTMLElement} */ (node);
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        if (element.closest("[aria-hidden='true']")) return false;
        return rect.width < 24 || rect.height < 24;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const name =
          element.getAttribute("aria-label") ??
          element.getAttribute("name") ??
          element.id ??
          element.getAttribute("type") ??
          "unnamed";
        return `${element.tagName.toLowerCase()}[${name}] ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      })
      .slice(0, 5);
  });
  check("every touch target is at least 24x24 on a phone", small.length === 0, small.join(", "));
  await phone.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${LABEL}: ${results.length - failed.length}/${results.length} accessibility checks passed`,
);
process.exitCode = failed.length ? 1 : 0;
