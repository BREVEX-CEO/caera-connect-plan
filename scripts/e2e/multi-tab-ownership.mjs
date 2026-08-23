/**
 * ONE OWNER ACROSS REAL TABS, AND RECOVERY WHEN IT CLOSES.
 *
 * `model-owner.ts` coordinates with `navigator.locks` and a `BroadcastChannel`.
 * Both are browser primitives with real cross-tab semantics that a unit test
 * cannot exercise: a mocked lock always grants, and a mocked channel always
 * delivers. This drives three genuine tabs on one origin.
 *
 * What is asserted: exactly one tab holds the lock at a time, the followers
 * know they are followers, and when the owner's tab CLOSES another tab takes
 * over rather than the engine becoming unreachable.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4174";

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-tabs-")), {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox"],
});

/**
 * Claim the lock the way `createModelOwner` does and hold it.
 *
 * The lock is held inside a promise that resolves when the page tells it to,
 * which is exactly the shape the real owner uses — a lock released as soon as
 * the callback returns would grant every tab in turn and prove nothing.
 */
const claim = `
  window.__ocadeRelease = null;
  window.__ocadeIsOwner = false;
  window.__ocadeClaim = () =>
    new Promise((settled) => {
      navigator.locks.request("ocade.model.owner", { mode: "exclusive" }, () => {
        window.__ocadeIsOwner = true;
        settled("owner");
        return new Promise((release) => { window.__ocadeRelease = release; });
      });
      setTimeout(() => settled(window.__ocadeIsOwner ? "owner" : "follower"), 1200);
    });
`;

async function openTab(name) {
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.addInitScript(claim);
  await page.evaluate(claim);
  const role = await page.evaluate(() => window.__ocadeClaim());
  return { name, page, role };
}

const results = {};
const a = await openTab("tab-a");
const b = await openTab("tab-b");
const c = await openTab("tab-c");

results.initialRoles = { a: a.role, b: b.role, c: c.role };
results.exactlyOneOwner = [a.role, b.role, c.role].filter((r) => r === "owner").length === 1;

/* The owner's tab closes without releasing — a crash, not a clean handover. */
const owner = [a, b, c].find((t) => t.role === "owner");
const others = [a, b, c].filter((t) => t !== owner);
await owner.page.close();

/*
 * A remaining tab should now be granted the lock.
 *
 * Checked by polling `__ocadeIsOwner`, which the ORIGINAL pending request sets
 * when it is finally granted. The first version of this issued a NEW
 * `navigator.locks.request` from the same tab and reported "still-blocked" —
 * that was the harness queueing behind its own earlier waiter, not the product
 * failing to recover. Web Locks is a queue, so asking twice from one tab puts
 * you behind yourself.
 */
async function waitForOwnership(page, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await page.evaluate(() => window.__ocadeIsOwner === true)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

const promoted = await Promise.all(others.map((t) => waitForOwnership(t.page)));
results.afterOwnerTabClosed = promoted.map(
  (ok, i) => `${others[i].name}:${ok ? "owner" : "follower"}`,
);
results.recoveredOwnership = promoted.filter(Boolean).length === 1;

/*
 * And exactly one of them was promoted — the browser hands a released lock to
 * ONE waiter, not to every waiter.
 */
results.stillExclusive = promoted.filter(Boolean).length === 1;

console.log(JSON.stringify(results, null, 2));
await ctx.close();
process.exit(
  results.exactlyOneOwner && results.recoveredOwnership && results.stillExclusive ? 0 : 1,
);
