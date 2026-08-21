/**
 * Every route, loaded in a real browser, signed out.
 * Records HTTP status, console errors, page errors, and what rendered.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
const s = readFileSync("src/routeTree.gen.ts", "utf8");
const start = s.indexOf("interface FileRoutesByFullPath");
const block = s.slice(start, s.indexOf("}", start));
const paths = [...block.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1])
  .filter((p) => !p.includes("$"))            // parameterised: needs a value
  .filter((p) => !p.startsWith("/api/"));     // not pages

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"],
});
const rows = [];
for (const path of paths) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 200)));
  let status = 0, title = "", bodyLen = 0, markupLen = 0, redirected = "";
  try {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
    status = response?.status() ?? 0;
    // Hydration and suspense boundaries settle after networkidle; measuring
    // before they do reported fully-rendered pages as blank.
    await page.waitForTimeout(2500);
    title = await page.title();
    bodyLen = (await page.evaluate(() => document.body?.innerText?.trim().length ?? 0));
    markupLen = (await page.evaluate(() => document.body?.innerHTML?.length ?? 0));
    const final = new URL(page.url()).pathname;
    if (final !== path) redirected = final;
  } catch (e) {
    pageErrors.push("NAV: " + String(e.message).slice(0, 160));
  }
  rows.push({ path, status, title, bodyLen, markupLen, redirected, consoleErrors, pageErrors });
  await page.close();
}
await browser.close();
writeFileSync("/tmp/route-audit.json", JSON.stringify(rows, null, 2));

// A page is only "blank" when it produced neither visible text nor markup.
const bad = rows.filter(
  (r) => r.status >= 400 || r.status === 0 || r.pageErrors.length || (r.bodyLen < 20 && r.markupLen < 300),
);
console.log(`ROUTES TESTED: ${rows.length}`);
console.log(`CLEAN: ${rows.length - bad.length}`);
console.log(`PROBLEM: ${bad.length}`);
for (const r of bad) {
  console.log(`\n  ${r.path}  status=${r.status} text=${r.bodyLen} markup=${r.markupLen}${r.redirected ? " -> " + r.redirected : ""}`);
  for (const e of r.pageErrors) console.log(`     pageerror: ${e}`);
  for (const e of r.consoleErrors.slice(0, 2)) console.log(`     console:   ${e}`);
}
const withConsole = rows.filter((r) => r.consoleErrors.length && !bad.includes(r));
console.log(`\nROUTES WITH CONSOLE ERRORS BUT OTHERWISE OK: ${withConsole.length}`);
for (const r of withConsole.slice(0, 10)) console.log(`  ${r.path}: ${r.consoleErrors[0]}`);
