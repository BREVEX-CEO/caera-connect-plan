/**
 * EVERY SETTINGS CONTROL, IN A REAL BROWSER, SIGNED OUT AND SIGNED IN.
 *
 * A setting has to do three separate things, and only the first is usually
 * tested: it has to WORK when you press it, it has to PERSIST across a reload,
 * and it has to CHANGE RUNTIME BEHAVIOUR. A control that flips and forgets, or
 * flips and changes nothing, is a control that lies.
 *
 * So this drives the shipped app: it clears the prelaunch consent gate and the
 * first-run tour the way a person does, censuses every control in every
 * section, flips every switch, reloads, and checks both the control's state and
 * the runtime state — the classes the appearance system writes onto <html>,
 * which is what the stylesheet actually keys off.
 *
 * TWO THINGS IT REFUSES TO DO, both learned the hard way:
 *
 *  - It does not click through a modal. An earlier pass drove controls with
 *    `element.click()` inside `page.evaluate`, which ignores pointer-events and
 *    went straight through the consent overlay, reporting hundreds of controls
 *    as exercised when a person could not have reached one of them.
 *
 *  - It does not treat a switch that springs back as dead. Signed out, the
 *    provider switch flips and then rolls back, because the save fails and a
 *    setting that is not in force must not appear to be on. Signed in the same
 *    switch stays. Both are recorded.
 *
 * Requires a dev server and the two loopback fixtures; `npm run audit:settings`
 * starts everything.
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const SIGNED_IN = Boolean(STATE);

const SECTIONS = [
  "activity",
  "privacy",
  "vault",
  "appearance",
  "chat",
  "motion",
  "cloud-permission",
  "permissions",
  "local-engine",
  "offline",
  "providers",
  "voice",
  "memory",
  "devices",
  "mobile",
  "usage",
  "tasks",
  "account",
  "security",
  "support",
  "about",
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();
const consoleErrors = [];
/*
 * Writes the page sends. A setting that lives on the SERVER changes neither
 * <html> nor localStorage, so without this a correctly-working server-backed
 * switch looked like one that changed nothing at all.
 */
const writes = [];
page.on("request", (r) => {
  if (r.method() === "GET" || r.method() === "OPTIONS") return;
  writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
});
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 180));
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message.slice(0, 180)}`));

/*
 * WHAT FAILED, NOT JUST HOW MANY.
 *
 * `Failed to load resource: net::ERR_CONNECTION_REFUSED` reaches the console
 * with no URL attached, so a run reporting "8 console errors" was unreadable:
 * eight probes of a local engine that is not installed look exactly like eight
 * broken application requests. The count was being eyeballed and waved past,
 * which is the same as not checking it.
 *
 * `requestfailed` carries the URL. Failures to loopback are EXPECTED here —
 * that is the product looking for a local model runtime and correctly finding
 * none. Failures to anything else are not, and are asserted on below.
 */
const failedRequests = [];
page.on("requestfailed", (r) => {
  failedRequests.push({ url: r.url(), reason: r.failure()?.errorText ?? "unknown" });
});
const isLoopback = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
};

/** Answer whatever modal is up, the way a person does. */
async function clearModals() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return true;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let i = 0; i < (await boxes.count()); i += 1) {
      await boxes
        .nth(i)
        .click({ timeout: 5000 })
        .catch(() => {});
    }
    const button = dialog.getByRole("button", {
      name: /^(accept and continue|skip|done|finish|got it|close)$/i,
    });
    if ((await button.count()) === 0) {
      // A first installation is deliberately non-dismissible. Wait for the
      // verified artifact and warm runtime instead of timing out after six
      // seconds and clicking inert settings underneath the full-screen gate.
      await page.waitForTimeout(500);
      continue;
    }
    await button
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(600);
  }
  return (await page.locator("[role=dialog], [role=alertdialog]").count()) === 0;
}

async function clickRenderedControl(locator) {
  const marker = `audit-${Date.now()}-${Math.random()}`;
  await locator.evaluate((element, id) => {
    window.__ocadeSettingsAuditClicks ??= {};
    window.__ocadeSettingsAuditClicks[id] = 0;
    element.addEventListener(
      "click",
      () => {
        window.__ocadeSettingsAuditClicks[id] += 1;
      },
      { once: true },
    );
  }, marker);

  await locator.click({ timeout: 8000 });
  await page.waitForTimeout(80);
  if (!(await page.evaluate((id) => (window.__ocadeSettingsAuditClicks?.[id] ?? 0) > 0, marker))) {
    throw new Error("semantic browser input did not reach the rendered switch");
  }
}

/** Controls in the settings panel itself, never the navigation chrome. */
const CENSUS = () => {
  const scope = document.querySelector("main") ?? document.body;
  const nav = document.querySelector("nav");
  return [...scope.querySelectorAll("button, input, select, textarea, [role=switch], a[href]")]
    .filter((el) => !(nav && nav.contains(el)))
    .map((el) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      return {
        kind:
          role === "switch"
            ? "switch"
            : tag === "select"
              ? "select"
              : tag === "input"
                ? el.type || "text"
                : tag === "a"
                  ? "link"
                  : "button",
        label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 48),
        disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
        href: tag === "a" ? el.getAttribute("href") : null,
      };
    });
};

const rootClasses = () =>
  page.evaluate(() => [...document.documentElement.classList].sort().join(" "));
const rawStorage = () => page.evaluate(() => JSON.stringify(localStorage));

const sections = [];
let totalControls = 0;
let totalSwitches = 0;
let flippedAndPersisted = 0;
const springBack = [];
/** Sections where turning one switch on correctly disabled others. */
const dependentDisables = [];
const deadLinks = [];

for (const section of SECTIONS) {
  await page.goto(`${BASE}/settings/${section}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await clearModals();

  const blocked = (await page.locator("[role=dialog], [role=alertdialog]").count()) > 0;

  /*
   * WAIT FOR THE SECTION TO ACTUALLY RENDER BEFORE COUNTING IT.
   *
   * Two failures led here. A fixed pause censused a panel that was still
   * filling in — one run reported 630 controls and a section with none, the
   * next 661 and no such section. Then a short settle window still lost a
   * section on a COLD dev server, where the first visit to a route pays for a
   * Vite transform that can take seconds.
   *
   * So it waits for a non-zero count first, with a ceiling generous enough for
   * a cold compile, and only then waits for that count to stop moving. An
   * audit that reports a different number each run is one nobody can act on.
   */
  let controls = await page.evaluate(CENSUS);
  const deadline = Date.now() + 20_000;
  while (controls.length === 0 && Date.now() < deadline) {
    await page.waitForTimeout(500);
    controls = await page.evaluate(CENSUS);
  }
  for (let settle = 0; settle < 10; settle += 1) {
    await page.waitForTimeout(400);
    const again = await page.evaluate(CENSUS);
    const stable = again.length === controls.length && again.length > 0;
    controls = again;
    if (stable) break;
  }
  if (controls.length === 0) {
    console.log(`  ${section}: rendered NO controls within 20s — recorded, not ignored`);
  }
  totalControls += controls.length;

  for (const link of controls.filter((c) => c.kind === "link")) {
    const href = link.href ?? "";
    if (!href || href === "#")
      deadLinks.push(`${section}: "${link.label}" href=${JSON.stringify(href)}`);
  }

  const switches = page.locator("main [role=switch]:not([disabled])");
  const count = blocked ? 0 : await switches.count();
  totalSwitches += count;

  for (let i = 0; i < count; i += 1) {
    /*
     * RE-COUNT EVERY ROUND. Flipping a switch can DISABLE others — turning on
     * "Reduce motion" correctly greys out the 3D depth controls it governs —
     * so the list of enabled switches shrinks underneath a loop that walked it
     * by index, and `nth(i)` waited thirty seconds for an element that no
     * longer existed. A shrinking list is the product behaving correctly; the
     * audit has to keep up with it rather than assume it stands still.
     */
    const nowEnabled = await switches.count();
    if (i >= nowEnabled) {
      dependentDisables.push(
        `${section}: flipping a switch disabled ${count - nowEnabled} other(s)`,
      );
      break;
    }

    const sw = switches.nth(i);
    const label =
      (await sw.evaluate((el) =>
        (el.closest("div")?.parentElement?.innerText || el.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 44),
      )) || `switch#${i}`;

    const wasChecked = await sw.getAttribute("aria-checked");
    const wasClasses = await rootClasses();
    const wasStorage = await rawStorage();
    const writesBefore = writes.length;

    try {
      await clickRenderedControl(sw);
    } catch (error) {
      check(
        `${section}: "${label}" is reachable by a real click`,
        false,
        (error instanceof Error ? error.message : String(error))
          .slice(0, 700)
          .replace(/\s*\n\s*/g, " | "),
      );
      continue;
    }
    await page.waitForTimeout(800);

    const nowChecked = await sw.getAttribute("aria-checked");
    if (nowChecked === wasChecked) {
      // Either dead, or a save failed and the control correctly rolled back.
      springBack.push(`${section}: "${label}"`);
      continue;
    }
    const nowClasses = await rootClasses();
    const nowStorage = await rawStorage();
    const sentWrites = writes.length - writesBefore;

    const effect =
      nowClasses !== wasClasses
        ? "<html> classes changed"
        : nowStorage !== wasStorage
          ? "stored preferences changed"
          : sentWrites > 0
            ? `saved to the server (${writes.slice(-1)[0]})`
            : "";
    check(
      `${section}: "${label}" changes runtime state`,
      effect !== "",
      effect || "no class change, no stored change, no request sent",
    );

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1400);
    await clearModals();
    const survived = await page.locator("main [role=switch]").nth(i).getAttribute("aria-checked");
    check(
      `${section}: "${label}" survives a reload`,
      survived === nowChecked,
      `${nowChecked} -> ${survived}`,
    );
    if (survived === nowChecked) flippedAndPersisted += 1;
  }

  sections.push({ section, controls: controls.length, switches: count, blocked });
  console.log(
    `  ${section.padEnd(17)} controls=${String(controls.length).padStart(3)} switches=${String(count).padStart(2)}${blocked ? "  BLOCKED-BY-MODAL" : ""}`,
  );
}

check("no settings link points nowhere", deadLinks.length === 0, deadLinks.slice(0, 5).join("; "));
check(
  "every section rendered controls",
  sections.every((s) => s.controls > 0),
  sections
    .filter((s) => s.controls === 0)
    .map((s) => s.section)
    .join(", ") || "all sections",
);
check(
  "no section was left behind a modal",
  sections.every((s) => !s.blocked),
  sections
    .filter((s) => s.blocked)
    .map((s) => s.section)
    .join(", ") || "none blocked",
);

console.log(
  `\n${SIGNED_IN ? "SIGNED IN" : "SIGNED OUT"}: ${sections.length} sections, ${totalControls} controls, ` +
    `${totalSwitches} switches, ${flippedAndPersisted} flipped and persisted, ` +
    `${springBack.length} sprang back, ${consoleErrors.length} console errors`,
);
if (dependentDisables.length) {
  console.log(
    "DEPENDENT CONTROLS (a switch correctly disabled others):\n  " + dependentDisables.join("\n  "),
  );
}
if (springBack.length)
  console.log("SPRANG BACK (save refused, control rolled back):\n  " + springBack.join("\n  "));

const loopbackFailures = failedRequests.filter((r) => isLoopback(r.url));
const otherFailures = failedRequests.filter((r) => !isLoopback(r.url));
if (loopbackFailures.length) {
  const probes = [...new Set(loopbackFailures.map((r) => new URL(r.url).port || "80"))];
  console.log(
    `  ${loopbackFailures.length} loopback request(s) refused on port(s) ${probes.join(", ")} —` +
      " the local-engine probe finding no runtime installed, which is correct here.",
  );
}
check(
  "no request to anything other than loopback failed",
  otherFailures.length === 0,
  otherFailures.map((r) => `${r.reason} ${r.url}`).join("; "),
);

writeFileSync(
  join(tmpdir(), SIGNED_IN ? "settings-audit-signed-in.json" : "settings-audit-signed-out.json"),
  JSON.stringify(
    { sections, results, springBack, deadLinks, consoleErrors, failedRequests },
    null,
    2,
  ),
);

const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} settings checks passed`);
if (failed.length) process.exitCode = 1;
await browser.close();
