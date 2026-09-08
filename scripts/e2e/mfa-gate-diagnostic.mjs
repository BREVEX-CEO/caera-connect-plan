/**
 * What does the browser actually see when the gate decides?
 *
 * A diagnostic, not an audit. It enrolls through the product, then reports the
 * exact values the route guard reads — the stored token's `aal`, the factors
 * the account returns, and the assurance the library computes — so a failure is
 * traced rather than guessed at.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});

const first = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await first.newPage();

await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.getByLabel(/a name for this authenticator app/i).fill("Diag phone");
await page
  .getByRole("button", { name: /set up two-step sign-in|add another app/i })
  .first()
  .click();
await page.waitForTimeout(2000);
await page.getByLabel(/six-digit code from your authenticator app/i).fill("123456");
await page.getByRole("button", { name: /turn on two-step sign-in/i }).click();
await page.waitForTimeout(3000);
console.log("enrolled in the first context");

/** Decode the stored session and ask the library what it thinks. */
async function inspect(target, label) {
  const report = await target.evaluate(async () => {
    const out = {};
    try {
      const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
      out.storageKey = key ?? null;
      if (key) {
        const stored = JSON.parse(localStorage.getItem(key));
        const token = stored?.access_token ?? stored?.currentSession?.access_token;
        out.hasToken = Boolean(token);
        if (token) {
          const payload = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          );
          out.tokenAal = payload.aal ?? null;
          out.tokenSub = payload.sub ?? null;
        }
        const user = stored?.user ?? stored?.currentSession?.user;
        out.storedFactors = (user?.factors ?? []).map((f) => f.status);
      }
    } catch (error) {
      out.storageError = String(error);
    }
    try {
      const response = await fetch("/__diag_never", { method: "HEAD" }).catch(() => null);
      out.probe = response ? response.status : "no-network-probe";
    } catch {
      out.probe = "threw";
    }
    return out;
  });
  console.log(`\n${label}`);
  console.log(JSON.stringify(report, null, 2));
}

await inspect(page, "FIRST CONTEXT (the one that enrolled)");

const second = await browser.newContext(STATE ? { storageState: STATE } : {});
const page2 = await second.newPage();
await page2.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(3000);
await inspect(page2, "SECOND CONTEXT (pre-enrollment storage state)");

/* What does the account actually report over the wire? */
const wire = await page2.evaluate(async () => {
  const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
  const stored = key ? JSON.parse(localStorage.getItem(key)) : null;
  const token = stored?.access_token ?? stored?.currentSession?.access_token;
  const base = "http://127.0.0.1:54321";
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: "stub" },
  });
  const body = await response.json();
  return { status: response.status, factors: body?.factors ?? null };
});
console.log("\n/auth/v1/user as the SECOND context sees it");
console.log(JSON.stringify(wire, null, 2));

await page2.goto(`${BASE}/ocade`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(4000);
console.log(`\nsecond context landed on: ${new URL(page2.url()).pathname}`);

await browser.close();
