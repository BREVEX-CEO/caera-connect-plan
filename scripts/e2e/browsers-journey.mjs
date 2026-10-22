/**
 * The same signed-in OCADE and JARVIS flow in every browser engine people use:
 * Chromium, Firefox and WebKit, at desktop size and as an iPhone- and an
 * Android-sized phone, plus an iPad-sized tablet. WebKit here is Safari's engine on Windows: it is
 * compatibility evidence, never proof of a real iPhone or Mac.
 *
 * Usage: node scripts/e2e/browsers-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium, firefox, webkit, devices } from "playwright-core";
import { BASE, SUPABASE } from "./common.mjs";

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM || undefined;

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;

const RUNS = [
  {
    name: "Chromium desktop",
    engine: chromium,
    launch: { executablePath: CHROMIUM },
    context: { viewport: { width: 1280, height: 800 } },
  },
  {
    name: "Firefox desktop",
    engine: firefox,
    launch: {},
    context: { viewport: { width: 1280, height: 800 } },
  },
  {
    name: "WebKit desktop",
    engine: webkit,
    launch: {},
    context: { viewport: { width: 1280, height: 800 } },
  },
  { name: "WebKit iPhone-sized", engine: webkit, launch: {}, context: { ...devices["iPhone 13"] } },
  { name: "WebKit iPad-sized", engine: webkit, launch: {}, context: { ...devices["iPad Pro 11"] } },
  {
    name: "Chromium Android-sized",
    engine: chromium,
    launch: { executablePath: CHROMIUM },
    context: { ...devices["Pixel 7"] },
  },
];

let blocked = 0;
for (const run of RUNS) {
  // An engine this computer does not have is reported as not tested, never as passed.
  const browser = await run.engine.launch(run.launch).catch((error) => {
    blocked += 1;
    process.stdout.write(`BLOCKED  ${run.name} — ${String(error.message).split("\n")[0]}\n`);
    return null;
  });
  if (!browser) continue;
  try {
    const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `browsers-${Date.now()}@ocade.test`, password: "proof" }),
    }).then((r) => r.json());
    const context = await browser.newContext(run.context);
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [storageKey, JSON.stringify(session)],
    );
    const page = await context.newPage();
    const errors = [];
    // Where and when: a WebKit fetch cut off by navigation reads as an access-control error.
    let navigating = false;
    page.on("framenavigated", () => (navigating = false));
    page.on("pageerror", (error) =>
      errors.push(
        `${navigating ? "[during navigation] " : ""}${page.url()} ${String(error).slice(0, 160)}`,
      ),
    );
    const leave = (go) => ((navigating = true), go());
    const label = (what) => `${run.name}: ${what}`;
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    // The tab's first visit, through a link that carries its words: an engine
    // that cannot isolate reloads once, and the link's query must survive it.
    await page.goto(`${BASE}/ocade-jarvis?ask=${encodeURIComponent("Plan my week")}`, {
      waitUntil: "load",
    });
    await page.locator("#jarvis-composer").waitFor();
    await page.waitForTimeout(1500);
    check(
      label("a link's words reach the box on the first visit"),
      (await page.locator("#jarvis-composer").inputValue()) === "Plan my week",
      page.url(),
    );
    await page.locator("#jarvis-composer").fill("");
    check(
      label("JARVIS opens signed in"),
      /JARVIS uses left|left/.test(await page.locator("header").innerText()),
    );
    check(label("no horizontal overflow"), (await overflow()) <= 1, String(await overflow()));

    await page.locator("#jarvis-composer").fill("What is 2 + 2?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const answered = await page
      .getByText("stubbed OCADE answer")
      .waitFor({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      );
    check(label("a question gets an answer"), answered);
    check(label("the conversation has its own link"), page.url().includes("?c="));

    const narrow = (await page.evaluate(() => window.innerWidth)) < 768;
    if (narrow) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page
      .getByRole("navigation", { name: "JARVIS" })
      .last()
      .getByRole("button", { name: "Settings" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.waitFor({ timeout: 10_000 });
    check(
      label("Settings shows the five categories"),
      (await dialog.locator("nav button").allInnerTexts()).join("|") ===
        "Account|Preferences|Devices|Privacy & Security|Billing & Usage",
    );
    check(label("Settings does not overflow"), (await overflow()) <= 1);
    await page.keyboard.press("Escape");

    const conversation = page.url();
    await leave(() => page.goto(`${BASE}/help`, { waitUntil: "load" }));
    const bubble = page.getByRole("button", { name: /^JARVIS, / });
    if (narrow) {
      await bubble.waitFor({ timeout: 15_000 }).catch(() => {});
      await bubble.click().catch(() => {});
      check(
        label("the JARVIS bubble opens on a phone"),
        (await page.getByRole("dialog", { name: "JARVIS" }).count()) === 1,
      );
      await page.keyboard.press("Escape");
    } else {
      check(label("no JARVIS bubble on a wide screen"), (await bubble.count()) === 0);
    }
    await page.locator("#help-search").fill("take over");
    await page.waitForTimeout(400);
    check(
      label("Help search finds the answer"),
      (await page.getByRole("button", { name: /Stop and Take Over/ }).count()) === 1,
    );
    await leave(() => page.goBack({ waitUntil: "load" }));
    await page.waitForTimeout(1500);
    check(label("Back returns to the same conversation"), page.url() === conversation);
    check(
      label("and shows its transcript"),
      (await page.locator("section[aria-label=Conversation]").innerText()).includes("2 + 2"),
    );
    check(label("no page errors"), errors.length === 0, errors.join(" | "));
  } catch (error) {
    check(`${run.name}: runs`, false, String(error).slice(0, 200));
  } finally {
    await browser.close();
  }
}

process.exit(failures ? 1 : blocked ? 3 : 0);
