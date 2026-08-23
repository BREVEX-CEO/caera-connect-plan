/**
 * THREE TABS, ONE MODEL — proven in a real browser.
 *
 * The model here is a stand-in that counts how many times it is loaded and
 * streams a deterministic answer. That is the right substitute: what is under
 * test is the COORDINATION, and a stand-in makes the one number that matters —
 * how many copies got loaded — exact. Real weights would prove nothing extra
 * about the election and would make "was it loaded twice?" a question about
 * VRAM rather than a count.
 *
 * Asserted: exactly one owner among three tabs; exactly one load in total; all
 * three tabs get a correct streamed answer; when the owner's tab is closed a
 * new owner is elected, loads once, and the surviving tabs keep working.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { transformSync } from "esbuild";

const source = readFileSync("src/lib/local/model-owner.ts", "utf8");
const compiled = transformSync(source, { loader: "ts", format: "esm", target: "es2022" }).code;

const PAGE = `<!doctype html><meta charset="utf-8"><title>owner probe</title>
<script type="module">
${compiled}
// A stand-in model: counts loads in this tab, streams a known answer.
window.__loads = 0;
window.__handle = createModelOwner({
  load: async () => { window.__loads += 1; await new Promise((r) => setTimeout(r, 120)); },
  run: async (payload, onToken) => {
    const answer = "answer:" + String(payload);
    for (const ch of answer.split("")) { onToken(ch); await new Promise((r) => setTimeout(r, 4)); }
    return { ok: true };
  },
  requestTimeoutMs: 8000,
});
window.__ask = async (p) => { let text = ""; const r = await window.__handle.request(p, (t) => { text += t; }); return { ...r, text }; };
</script><h1>owner probe</h1>`;

const server = createServer((_q, s) => {
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  s.end(PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext();

try {
  const tabs = [];
  for (let i = 0; i < 3; i += 1) {
    const page = await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "load" });
    tabs.push(page);
    await page.waitForTimeout(250);
  }
  await tabs[0].waitForTimeout(600);

  const roles = [];
  for (const t of tabs) roles.push(await t.evaluate(() => window.__handle.role()));
  check(
    "exactly one of three tabs owns the model",
    roles.filter((r) => r === "owner").length === 1,
    roles.join(", "),
  );

  const ownerIndex = roles.indexOf("owner");

  // Every tab asks. Only one of them may load.
  const answers = [];
  for (const t of tabs) answers.push(await t.evaluate(() => window.__ask("hello")));
  check(
    "every tab gets a correct answer",
    answers.every((a) => a.ok && a.text === "answer:hello"),
    answers.map((a) => `${a.ranOn}:${a.text}`).join(" | "),
  );

  const loads = [];
  for (const t of tabs) loads.push(await t.evaluate(() => window.__loads));
  const total = loads.reduce((a, b) => a + b, 0);
  check(
    "the model was loaded exactly once across all three tabs",
    total === 1,
    `loads per tab: [${loads.join(", ")}]`,
  );
  check("only the owner loaded it", loads[ownerIndex] === 1, `owner is tab ${ownerIndex}`);

  // Followers really did go through the owner rather than running locally.
  const forwarded = answers.filter((a) => a.ranOn === "follower-forwarded").length;
  check("the two followers were served by the owner", forwarded === 2, `${forwarded} forwarded`);

  /* ------------------------------------------------------- failover ---- */
  await tabs[ownerIndex].close();
  const survivors = tabs.filter((_, i) => i !== ownerIndex);
  await survivors[0].waitForTimeout(1200);

  const rolesAfter = [];
  for (const t of survivors) rolesAfter.push(await t.evaluate(() => window.__handle.role()));
  check(
    "closing the owner promotes exactly one survivor",
    rolesAfter.filter((r) => r === "owner").length === 1,
    rolesAfter.join(", "),
  );

  const answersAfter = [];
  for (const t of survivors) answersAfter.push(await t.evaluate(() => window.__ask("again")));
  check(
    "the surviving tabs still get answers after failover",
    answersAfter.every((a) => a.ok && a.text === "answer:again"),
    answersAfter.map((a) => `${a.ranOn}:${a.text}`).join(" | "),
  );

  const loadsAfter = [];
  for (const t of survivors) loadsAfter.push(await t.evaluate(() => window.__loads));
  const totalAfter = loadsAfter.reduce((a, b) => a + b, 0);
  check(
    "the new owner loaded once, and only the new owner",
    totalAfter === 1,
    `loads per surviving tab: [${loadsAfter.join(", ")}]`,
  );
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} model-owner checks passed`);
if (failed.length) process.exitCode = 1;
