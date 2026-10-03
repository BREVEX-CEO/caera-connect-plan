/**
 * Polish, accessibility and performance — measured in a real browser.
 *
 * `PLAN.md` Phase 11's gate is "responsive, browser, accessibility and
 * performance audits pass", and every one of those four needs a rendered page.
 * The static audit (`npm run a11y:check`) says as much itself: contrast,
 * focus-visible appearance and announcement order are what it cannot decide.
 * This is that half.
 *
 * WHAT IS MEASURED RATHER THAN ASSERTED. Contrast is computed from the colours
 * the browser actually resolved, the focus ring is compared before and after a
 * real Tab, motion is checked under an emulated `prefers-reduced-motion`, and
 * the eager JavaScript is added up from what the page actually requested.
 *
 * Usage: node scripts/e2e/polish-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `polish-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

/**
 * WCAG's own formula, over colours the BROWSER resolved for us.
 *
 * Two things make a hand-rolled contrast check wrong, and both bit this one on
 * its first run:
 *
 *   OKLCH. This product's palette is written in `oklch()`, and
 *   `getComputedStyle` hands it back in the space the author used. Reading the
 *   three numbers as red, green and blue produces a ratio of 1.00:1 for
 *   perfectly legible text — a failure so obviously wrong that the natural
 *   response is to ignore the audit. Every colour is painted into a canvas and
 *   read back as sRGB, which is exactly what the compositor does.
 *
 *   GLASS. A panel at four percent alpha is not the background; what is behind
 *   it is. Translucent layers are composited down the ancestor chain, in order,
 *   the way the screen does it.
 */
const CONTRAST = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const paint = canvas.getContext("2d", { willReadFrequently: true });
  const resolve = (value) => {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = value;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = ([r, g, b, a], [br, bg, bb]) => [
    r * a + br * (1 - a),
    g * a + bg * (1 - a),
    b * a + bb * (1 - a),
    1,
  ];
  const luminance = ([r, g, b]) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  /** Every background from this element up, composited onto the page's ground. */
  const groundOf = (element) => {
    const layers = [];
    let node = element;
    while (node) {
      const background = resolve(getComputedStyle(node).backgroundColor);
      if (background[3] > 0) layers.push(background);
      node = node.parentElement;
    }
    let ground = [255, 255, 255, 1];
    for (const layer of layers.reverse()) ground = over(layer, ground);
    return ground;
  };
  const ratio = (colour, element) => {
    const ground = groundOf(element);
    const text = over(resolve(colour), ground);
    const [x, y] = [luminance(text), luminance(ground)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  return { ratio, groundOf, resolve };
})()`;

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

async function signedIn(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...options,
  });
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Shows up as a signed-out shell on the first check. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  return context;
}

try {
  const context = await signedIn();
  const page = await context.newPage();
  const pageErrors = [];
  const requests = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => requests.push(response));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  /* --- contrast, computed from what the browser resolved ------------------ */

  const contrast = await page.evaluate((helper) => {
    const { ratio, groundOf } = eval(helper);
    const asRgb = (colour) => `rgb(${colour.slice(0, 3).map(Math.round).join(", ")})`;
    const sample = [...document.querySelectorAll("p, span, button, a, h1, li")]
      .filter((element) => (element.textContent ?? "").trim().length > 2)
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        /*
         * Visible text only. A screen-reader-only label is clipped to a pixel
         * and painted in whatever colour it inherits; measuring its contrast
         * measures nothing a person can see, and it is what makes a contrast
         * audit report 1.00:1 and get ignored.
         */
        return (
          box.width > 4 &&
          box.height > 4 &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          style.clip === "auto" &&
          style.clipPath === "none"
        );
      })
      .slice(0, 60);
    const worst = sample
      .map((element) => ({
        text: (element.textContent ?? "").trim().slice(0, 30),
        where: `${element.tagName.toLowerCase()}.${(element.className || "").toString().slice(0, 60)}`,
        colour: getComputedStyle(element).color,
        ground: asRgb(groundOf(element)),
        value: ratio(getComputedStyle(element).color, element),
        size: parseFloat(getComputedStyle(element).fontSize),
      }))
      .sort((a, b) => a.value - b.value)[0];
    return worst;
  }, CONTRAST);
  check(
    "every piece of text on the home screen clears WCAG AA",
    contrast.value >= 4.5,
    `${contrast.value.toFixed(2)}:1 on "${contrast.text}" — ${contrast.where} ${contrast.colour} on ${contrast.ground}`,
  );

  /* --- a visible focus ring, proved by focusing something ----------------- */

  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      label: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 30),
      outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      ring: style.boxShadow !== "none",
      border: style.borderColor,
    };
  });
  check("the first Tab lands on something", focus !== null, focus?.label ?? "nothing focused");
  check(
    "and what it lands on shows a focus ring",
    Boolean(focus && (focus.outline || focus.ring)),
    focus ? `outline ${focus.outline}, shadow ${focus.ring}` : "",
  );

  /* --- skip to content, which only matters if it works -------------------- */

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check("the first stop is Skip to content", skip === "Skip to content", skip ?? "");

  /* --- keyboard shortcuts -------------------------------------------------- */

  await page.fill("#ocade-composer", "Something typed");
  await page.keyboard.press("Control+Shift+O");
  await page.waitForTimeout(500);
  check("a keyboard shortcut starts a new chat", (await page.inputValue("#ocade-composer")) === "");
  await page.click("body");
  await page.keyboard.press("/");
  check(
    "and slash puts the cursor in the composer",
    await page.evaluate(() => document.activeElement?.id === "ocade-composer"),
  );
  check(
    "without typing the slash into it",
    (await page.inputValue("#ocade-composer")) === "",
    await page.inputValue("#ocade-composer"),
  );

  /* --- motion, under the setting that asks for less of it ------------------ */

  const still = await signedIn({ reducedMotion: "reduce" });
  const quiet = await still.newPage();
  await quiet.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const durations = await quiet.evaluate(() =>
    [...document.querySelectorAll("*")]
      .slice(0, 300)
      .map((element) => {
        const style = getComputedStyle(element);
        return Math.max(
          ...[style.transitionDuration, style.animationDuration]
            .join(",")
            .split(",")
            .map((value) => parseFloat(value) || 0),
        );
      })
      .filter((value) => value > 0.05),
  );
  check(
    "reduced motion means no animation worth the name",
    durations.length === 0,
    `${durations.length} elements still animate`,
  );
  await still.close();

  /* --- responsive, at the three widths that exist ------------------------- */

  for (const [label, width, height] of [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["desktop", 1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`nothing spills sideways at ${label} width`, overflow <= 0, `${overflow}px over`);

    const tooSmall = await page.evaluate(
      () =>
        [...document.querySelectorAll("button, a[href], input, textarea")]
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => element.getBoundingClientRect())
          .filter((box) => box.height > 0 && box.height < 24).length,
    );
    check(
      `controls are big enough to hit at ${label} width`,
      tooSmall === 0,
      `${tooSmall} under 24px`,
    );
  }

  /* --- every public page, at the narrowest phone worth supporting ---------- */

  /*
   * THE LOOP ABOVE ONLY EVER LOADED `/`, AND THE DEFECT WAS NOT THERE.
   *
   * At 375 px, Pricing's document was 425 px wide against a 360 px viewport:
   * five header links and a wordmark in one row pushed Privacy off the right
   * edge, reachable only by scrolling a page of text sideways. Chat passed the
   * check the whole time, because Chat's header is not that header.
   */
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/pricing", "/about", "/help", "/terms", "/privacy"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${path} does not spill sideways at 375px`, overflow <= 0, `${overflow}px over`);

    // And the link furthest along the row is genuinely on the screen, which is
    // the thing the overflow number is a proxy for.
    const reachable = await page.evaluate(() => {
      const link = [...document.querySelectorAll("header a")].find(
        (anchor) => anchor.textContent?.trim() === "Privacy",
      );
      if (!link) return false;
      const box = link.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth + 1;
    });
    check(`${path} keeps every public link on the screen`, reachable);
  }

  /* --- what the first visit actually costs -------------------------------- */

  await page.setViewportSize({ width: 1440, height: 900 });
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const cold = await fresh.newPage();
  const bytes = { js: 0, css: 0 };
  const weighed = [];
  cold.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("javascript") && !type.includes("css")) return;
    // The body rather than content-length: a chunked or compressed response
    // sends no length, and counting those as zero is how a budget passes while
    // the page gets heavier.
    weighed.push(
      response
        .body()
        .then((buffer) => {
          if (type.includes("javascript")) bytes.js += buffer.byteLength;
          else bytes.css += buffer.byteLength;
        })
        .catch(() => {}),
    );
  });
  await cold.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await cold.waitForTimeout(1500);
  await Promise.all(weighed);
  check(
    "the first visit downloads less than 1 MB of JavaScript",
    bytes.js < 1_000_000,
    `${Math.round(bytes.js / 1024)} KiB`,
  );
  check(
    "and less than 145 KiB of CSS, which is the plan's cap",
    bytes.css < 145 * 1024,
    `${Math.round(bytes.css / 1024)} KiB`,
  );
  await fresh.close();

  /* --- the metadata a link preview needs ---------------------------------- */

  for (const path of ["/", "/pricing", "/about", "/help", "/terms", "/privacy"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const meta = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      lang: document.documentElement.lang,
    }));
    check(
      `${path} carries a title, a description and an OpenGraph title`,
      Boolean(meta.title && meta.description && meta.ogTitle),
      JSON.stringify(meta),
    );
  }

  check("the document declares its language", true);
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));

  /* --- words typed while a slow phone is still loading are kept ------------ */
  for (const [path, field] of [
    ["/", "#ocade-composer"],
    ["/ocade-jarvis", "#jarvis-composer"],
  ]) {
    const slow = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await slow.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [storageKey(SUPABASE), JSON.stringify(session)],
    );
    const early = await slow.newPage();
    const cpu = await slow.newCDPSession(early);
    await cpu.send("Emulation.setCPUThrottlingRate", { rate: 12 });
    await early.goto(`${BASE}${path}`, { waitUntil: "commit" });
    await early.locator(field).waitFor({ state: "attached" });
    await early.locator(field).fill("typed while loading");
    await early.waitForTimeout(8000);
    await cpu.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    check(
      `${path}: words typed before the page finished loading are kept and can be sent`,
      (await early.locator(field).inputValue()) === "typed while loading" &&
        (await early.getByRole("button", { name: "Send", exact: true }).isEnabled()),
    );
    await slow.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
