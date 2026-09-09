/**
 * THE THREE ENTRY RULES, IN A REAL BROWSER.
 *
 * `docs/APP_FLOW.md` states them and `src/lib/entry/root-entry.ts` decides
 * them, but neither can prove that the decision reaches a person: the rules
 * depend on when TanStack Start runs `beforeLoad` on a server-rendered
 * document, which is a framework behaviour and not a unit-testable one. So
 * this drives it — a first visit, a reload, and a signed-in visit — and reads
 * the address bar.
 *
 * It also watches the console and the network, because a redirect that works
 * while throwing is not a redirect that works.
 */
import { chromium } from "playwright-core";
import { resolveBrowserPath } from "./browser-path.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8099";
const STATE = process.env.OCADE_STORAGE_STATE;

const browser = await chromium.launch({
  executablePath: resolveBrowserPath(),
  args: ["--no-sandbox"],
});

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

/** A page's path after it has settled, plus anything it complained about. */
async function visit(context, path = "/") {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const landed = new URL(page.url()).pathname;
  const body = await page.evaluate(() => document.body.innerText);
  await page.close();
  return { landed, body, errors };
}

/* ------------------------------------------------------------------ 1 -- */

const firstVisit = await browser.newContext();
const first = await visit(firstVisit, "/");
check("a first visit is shown the landing page", first.landed === "/", first.landed);
check(
  "the landing page is the commercial one, not a redirect shell",
  /OCADE/i.test(first.body) && !/Opening OCADE/i.test(first.body),
  first.body.replace(/\s+/g, " ").slice(0, 100),
);
check(
  "the first visit reports no console or page error",
  first.errors.length === 0,
  first.errors.slice(0, 2).join(" | "),
);

/* ------------------------------------------------------------------ 2 -- */

const second = await visit(firstVisit, "/");
check(
  "a returning signed-out visitor is taken to sign in, not back through marketing",
  second.landed === "/auth",
  second.landed,
);
check(
  "the returning visit reports no console or page error",
  second.errors.length === 0,
  second.errors.slice(0, 2).join(" | "),
);
await firstVisit.close();

/* ------------------------------------------------------------------ 3 -- */

if (STATE) {
  const signedIn = await browser.newContext({ storageState: STATE });
  const workspace = await visit(signedIn, "/");
  check(
    "a returning signed-in visitor is taken straight to Chat",
    workspace.landed === "/ocade",
    workspace.landed,
  );
  await signedIn.close();
} else {
  console.log("SKIP  signed-in entry — no OCADE_STORAGE_STATE was provided");
}

await browser.close();
if (failures) {
  console.error(`\n${failures} ENTRY RULE(S) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nEVERY ENTRY RULE HELD IN A REAL BROWSER");
}
