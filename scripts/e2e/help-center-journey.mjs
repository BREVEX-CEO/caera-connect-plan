/**
 * THE HELP CENTER, WALKED THE WAY SOMEBODY IN TROUBLE WALKS IT.
 *
 * The route audit visits every concrete path, and it deliberately skips routes
 * with a `$param` because it cannot invent a value for one. `/support/$slug` is
 * exactly that shape, so the article page — the whole point of the Help Center
 * — is invisible to it. This walks the journey instead: search, open an answer,
 * follow a related link, say it did not help, and come back to an answer
 * already given.
 *
 * It also checks the two failures a help centre fails at silently: a link that
 * resolves to nothing, and a slug that no longer exists rendering as an empty
 * page rather than a designed not-found.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

/*
 * MESSAGES THIS JOURNEY ITSELF CAUSES, NAMED AND EXPLAINED.
 *
 * The journey deliberately opens a slug that does not exist, to prove the
 * not-found page is designed rather than blank. The browser logs the document's
 * own 404 for that navigation, which is correct behaviour being reported — not
 * a defect, and not something the product can or should suppress.
 *
 * Listed rather than filtered loosely: anything not on this list still fails,
 * so the allowance cannot quietly grow into "ignore console errors".
 */
const EXPECTED_CONSOLE = [
  {
    // Only while the deliberate 404 navigation is in flight; see below.
    match: /Failed to load resource: the server responded with a status of 404/,
    because: "this journey visits a slug that does not exist on purpose",
  },
];

/**
 * True while the journey is deliberately provoking a message.
 *
 * Scoped to the step rather than the whole run, so a 404 anywhere else — a
 * missing chunk, a broken asset — still fails.
 */
let expectingNotFound = false;

const consoleErrors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text().slice(0, 200);
  if (expectingNotFound && EXPECTED_CONSOLE.some((entry) => entry.match.test(text))) return;
  consoleErrors.push(text);
});
page.on("pageerror", (error) => consoleErrors.push(`PAGEERROR: ${error.message.slice(0, 200)}`));
page.on("requestfailed", (request) =>
  failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? "?"}`),
);

/*
 * A 404 is an ANSWER, not a failed request — `requestfailed` fires for
 * transport failures, so the deliberate not-found above does not reach here and
 * needs no allowance. Left explicit so nobody adds one.
 */

/** Wait until the document has settled with real content in it. */
async function settled() {
  await page
    .waitForFunction(() => (document.body?.innerText?.trim().length ?? 0) > 60, undefined, {
      timeout: 20000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

try {
  /* ---- 1. the home, and its search ---- */
  await page.goto(`${BASE}/support`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settled();
  const homeText = await page.evaluate(() => document.body.innerText);
  check(
    "the Help Center home lists categories and articles",
    /Help Center|OCADE help/i.test(homeText) && /Start here/i.test(homeText),
    `${homeText.trim().length} chars`,
  );
  check(
    "it says the start list is editorial rather than a popularity ranking",
    /Chosen by the support team rather than ranked by views/i.test(homeText),
    "",
  );

  const search = page.getByLabel("Search help articles");
  await search.fill("recovery code");
  await page.waitForTimeout(400);
  const searchText = await page.evaluate(() => document.body.innerText);
  check(
    "searching finds the article about a lost authenticator",
    /lost my phone|recovery code/i.test(searchText),
    searchText.slice(searchText.indexOf("article"), searchText.indexOf("article") + 120),
  );

  /*
   * A query that matches nothing must SAY nothing matched. The failure this
   * catches is a search that silently shows the unfiltered list, which reads as
   * "here are your results" for a query with none.
   */
  await search.fill("zzzzqqqq");
  await page.waitForTimeout(400);
  const emptyText = await page.evaluate(() => document.body.innerText);
  check(
    "a query with no match says so instead of showing everything",
    /No article matches that yet/i.test(emptyText) && !/Start here/i.test(emptyText),
    "",
  );
  await search.fill("");
  await page.waitForTimeout(300);

  /* ---- 2. open an article ---- */
  await page.goto(`${BASE}/support/lost-second-factor`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settled();
  const articleText = await page.evaluate(() => document.body.innerText);
  check(
    "an article page renders its answer",
    /recovery-code route/i.test(articleText),
    `${articleText.trim().length} chars`,
  );
  check(
    "it states where it applies and when the answer last changed",
    /Product version/i.test(articleText) &&
      /Platforms/i.test(articleText) &&
      /Answer last changed/i.test(articleText),
    "",
  );
  const hasTime = await page.evaluate(() => Boolean(document.querySelector("time[datetime]")));
  check("the date is a machine-readable time element", hasTime, "");

  /* ---- 3. related reading actually goes somewhere ---- */
  const relatedHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/support/"]')]
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href) => href && href !== "/support"),
  );
  check("the article offers related reading", relatedHrefs.length > 0, relatedHrefs.join(", "));
  if (relatedHrefs.length) {
    await page.goto(`${BASE}${relatedHrefs[0]}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await settled();
    const relatedText = await page.evaluate(() => document.body.innerText);
    check(
      "a related link opens a real article rather than an empty page",
      relatedText.trim().length > 200 && /Answer last changed/i.test(relatedText),
      `${relatedText.trim().length} chars at ${relatedHrefs[0]}`,
    );
  }

  /* ---- 4. "this did not help" escalates with the article's context ---- */
  await page.goto(`${BASE}/support/lost-second-factor`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settled();
  await page.getByRole("button", { name: "No, I still need help" }).click();
  await page.waitForTimeout(300);
  const escalation = await page.evaluate(() => document.body.innerText);
  check(
    "saying it did not help prepares a ticket naming the article",
    escalation.includes("/support/lost-second-factor") &&
      /Getting back in without your authenticator/.test(escalation),
    "",
  );
  check(
    "the prepared ticket warns against sending credentials",
    /do not include passwords/i.test(escalation),
    "",
  );
  check(
    "and it never claims a vote was counted",
    !/thanks for your feedback/i.test(escalation),
    "",
  );

  /* ---- 5. "yes" is remembered on this device, and says only that ---- */
  await page.goto(`${BASE}/support/delete-account`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settled();
  await page.getByRole("button", { name: "Yes, this helped" }).click();
  await page.waitForTimeout(300);
  const acknowledged = await page.evaluate(() => document.body.innerText);
  check(
    "a helpful answer is acknowledged truthfully, as a device-local note",
    /Noted on this device/i.test(acknowledged) && /Nothing was sent anywhere/i.test(acknowledged),
    "",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await settled();
  const afterReload = await page.evaluate(() => document.body.innerText);
  check(
    "and the article stops asking after a reload",
    /Noted on this device/i.test(afterReload) && !/Yes, this helped/.test(afterReload),
    "",
  );

  /* ---- 6. a slug that does not exist ---- */
  expectingNotFound = true;
  await page.goto(`${BASE}/support/this-article-was-never-published`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settled();
  expectingNotFound = false;
  const missing = await page.evaluate(() => ({
    text: document.body.innerText,
    controls: document.querySelectorAll("a[href], button").length,
  }));
  check(
    "a slug that does not exist gets a designed page, not a blank one",
    missing.text.trim().length > 60 && missing.controls > 0,
    `${missing.text.trim().length} chars, ${missing.controls} controls`,
  );

  /* ---- 7. the FAQ is the same answers, deep-linkable ---- */
  await page.goto(`${BASE}/faq`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settled();
  await page.getByRole("button", { name: /How do I sign in/i }).click();
  await page.waitForTimeout(300);
  const faqText = await page.evaluate(() => document.body.innerText);
  check(
    "an FAQ answer opens, and offers its own permanent page",
    /Open this answer on its own page/i.test(faqText) && /Answer last changed/i.test(faqText),
    "",
  );
  const faqLink = await page.evaluate(() => {
    const anchor = [...document.querySelectorAll("a")].find((element) =>
      /Open this answer on its own page/i.test(element.textContent ?? ""),
    );
    return anchor?.getAttribute("href") ?? null;
  });
  check(
    "and that page is a real help article",
    faqLink === "/support/how-to-sign-in",
    String(faqLink),
  );

  /* ---- 8. reading in a language ---- */
  /*
   * §L asks for locale support, and the thing worth proving is not coverage —
   * it is HONESTY about coverage. A Help Center that served English to a German
   * reader without saying so would be indistinguishable from one whose German
   * was written by a machine and never proofread.
   */
  await page.evaluate(() => window.localStorage.setItem("ocade.locale.v1", "de-DE"));
  await page.goto(`${BASE}/support/plans-and-what-they-cost`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  const germanNotice = await page.evaluate(() =>
    /has not been translated into German/i.test(document.body.innerText),
  );
  check("an untranslated article says so rather than pretending", germanNotice);
  const stillReadable = await page.evaluate(() =>
    /catalogue is Free, Pro and Max/i.test(document.body.innerText),
  );
  check("and still shows the English article rather than an empty page", stillReadable);

  await page.goto(`${BASE}/support`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const coverageStated = await page.evaluate(() =>
    /not translated into German yet/i.test(document.body.innerText),
  );
  check("the Help Center says once how much exists in that language", coverageStated);

  /*
   * AND A LOCALE THAT DOES HAVE A TRANSLATION GETS IT. Without this the checks
   * above would pass against a page that always shows the fallback notice.
   */
  await page.evaluate(() => window.localStorage.setItem("ocade.locale.v1", "en-IN"));
  await page.goto(`${BASE}/support/plans-and-what-they-cost`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  const translated = await page.evaluate(() => ({
    hasTranslation: /in rupees/i.test(document.body.innerText),
    apologises: /has not been translated/i.test(document.body.innerText),
  }));
  check("a locale with a translation gets it", translated.hasTranslation);
  check("and is not apologised to for a fallback that did not happen", !translated.apologises);
  await page.evaluate(() => window.localStorage.removeItem("ocade.locale.v1"));

  /* ---- 8. the console and the network ---- */
  check(
    "no console error during the whole journey",
    consoleErrors.length === 0,
    consoleErrors.join(" | ").slice(0, 300),
  );
  check(
    "no failed request during the whole journey",
    failedRequests.length === 0,
    failedRequests.join(" | ").slice(0, 300),
  );
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} Help Center checks passed`);
process.exitCode = failed.length ? 1 : 0;
