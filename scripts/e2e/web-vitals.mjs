/**
 * LCP, CLS AND TBT — THE THREE NUMBERS PLAN.md §26 COMMITS TO.
 *
 *   LCP  < 2.5 s    how long until the main thing is on screen
 *   CLS  < 0.1      how much the page moves under the reader
 *   TBT  < 200 ms   how long the page ignores a tap
 *
 * The asset budget already holds the bytes down, and bytes are a proxy: a
 * 400 KiB bundle that blocks the main thread for a second is worse than a
 * 600 KiB one that does not. These measure what the person experiences.
 *
 * MEASURED WITH THE BROWSER'S OWN OBSERVERS, not with a stopwatch around
 * `goto`. `PerformanceObserver` reports the same entries a real-user monitor
 * collects, so the numbers mean what the field reports mean rather than being a
 * harness-specific approximation.
 *
 * TBT IS DERIVED FROM LONG TASKS, which is how the metric is defined: the sum
 * of everything over 50 ms in each task, between first paint and the point the
 * page is interactive. A synthetic run cannot see a real user's input delay, so
 * TBT is the honest thing to hold rather than FID or INP.
 *
 * THROTTLED, BECAUSE AN UNTHROTTLED CONTAINER IS NOT A CUSTOMER'S MACHINE. A
 * modern server CPU makes almost any page pass, which would turn this into a
 * gate that cannot fail. Four-times CPU throttling is the mid-tier device
 * Lighthouse models, and it is the machine OCADE's own performance section is
 * written about.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

/** PLAN.md §26, exactly. */
const BUDGET = { lcpMs: 2500, cls: 0.1, tbtMs: 200 };

/** The pages a first-time visitor and a returning one actually land on. */
const ROUTES = STATE ? ["/ocade", "/settings"] : ["/", "/pricing", "/support"];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});

/**
 * Everything the observers saw, collected in the page.
 *
 * Installed via an init script so the observers exist before the document does
 * — an observer registered after hydration has already missed the paint it was
 * meant to measure, which is the classic way this measurement silently reports
 * zero.
 */
const COLLECTOR = `
(() => {
  window.__ocadeVitals = { lcp: 0, cls: 0, longTasks: [], firstPaint: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__ocadeVitals.lcp = Math.max(window.__ocadeVitals.lcp, entry.startTime);
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) { void e; }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Shifts the reader CAUSED are not the product moving under them.
        if (!entry.hadRecentInput) window.__ocadeVitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) { void e; }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__ocadeVitals.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
          attribution: [...(entry.attribution ?? [])].map((item) => ({
            name: item.name,
            containerType: item.containerType,
            containerSrc: item.containerSrc,
          })),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch (e) { void e; }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          window.__ocadeVitals.firstPaint = entry.startTime;
        }
      }
    }).observe({ type: "paint", buffered: true });
  } catch (e) { void e; }
})();
`;

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(STATE ? { storageState: STATE } : {}),
  });
  await context.addInitScript(COLLECTOR);
  const page = await context.newPage();

  const session = await context.newCDPSession(page);
  // A mid-tier device rather than a server. Without this the gate cannot fail.
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 60000 });
    /*
     * Settle before reading. LCP is only final once the largest element has
     * stopped changing, and a late-arriving image or font moves it — reading
     * too early reports an early paint as though it were the last one.
     */
    await page.waitForTimeout(3500);

    const vitals = await page.evaluate(() => {
      const collected = window.__ocadeVitals ?? { lcp: 0, cls: 0, longTasks: [], firstPaint: 0 };
      const start = collected.firstPaint || 0;
      /*
       * TBT: the blocking portion of every long task after first paint. Only
       * the part over 50 ms counts — a 60 ms task blocks for 10, not 60 — which
       * is the metric's definition rather than a simplification of it.
       */
      const tbt = collected.longTasks
        .filter((task) => task.start >= start)
        .reduce((total, task) => total + Math.max(0, task.duration - 50), 0);
      return {
        lcp: collected.lcp,
        cls: collected.cls,
        tbt,
        tasks: collected.longTasks.length,
        worstTasks: [...collected.longTasks]
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 3)
          .map(
            (task) =>
              `${Math.round(task.duration)}ms@${Math.round(task.start)}` +
              (task.attribution?.[0]?.name ? `:${task.attribution[0].name}` : ""),
          ),
      };
    });

    check(
      `${route} LCP under ${BUDGET.lcpMs} ms`,
      vitals.lcp > 0 && vitals.lcp < BUDGET.lcpMs,
      `${Math.round(vitals.lcp)} ms`,
    );
    check(`${route} CLS under ${BUDGET.cls}`, vitals.cls < BUDGET.cls, vitals.cls.toFixed(4));
    check(
      `${route} TBT under ${BUDGET.tbtMs} ms`,
      vitals.tbt < BUDGET.tbtMs,
      `${Math.round(vitals.tbt)} ms across ${vitals.tasks} long task(s); ${vitals.worstTasks.join(", ") || "none"}`,
    );

    /*
     * A ZERO IS NOT A PASS. An LCP of 0 means the observer never fired — a
     * page that rendered nothing, or a collector that was installed too late —
     * and reporting that as "well under budget" is the exact failure a
     * performance gate exists to prevent.
     */
    check(`${route} was actually measured`, vitals.lcp > 0, `LCP ${Math.round(vitals.lcp)} ms`);
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} web-vitals checks passed`);
process.exitCode = failed.length ? 1 : 0;
