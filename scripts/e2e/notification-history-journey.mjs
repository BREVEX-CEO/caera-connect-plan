/**
 * THE NOTIFICATION HISTORY, CAUSED BY A REAL ACTION — PLAN.md §D.
 *
 * The tables, the recorder and the two mark-read functions were proven against
 * real PostgreSQL long before anything wrote to them or read them. That proved
 * the schema and nothing about the product: a history nobody writes and nobody
 * can open is a table.
 *
 * So this does not seed a row. It performs a real security action — signing out
 * every other session, through the Security page — and then checks that OCADE
 * TOLD the person. That is the whole feature: §D lists security among the kinds
 * that stay recorded whatever the mute settings say, and the reason the rule
 * exists is that somebody who did not perform that action needs to find out.
 *
 * WHAT IS REAL: the route, the sender, the history reader, the mark-read
 * functions, the unread badge, the per-channel delivery rendering.
 * WHAT IS MODELLED: Supabase, in `stub-supabase.mjs`. It does NOT model the
 * privilege boundary — that a browser cannot record its own notification is
 * proven against real PostgreSQL under `SET ROLE authenticated`, where it
 * belongs.
 */
import { chromium } from "playwright-core";
import { signInWithPassword } from "./sign-in.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

const problems = [];
const note = (line) => console.log(`  ${line}`);
const fail = (line) => {
  problems.push(line);
  console.error(`  FAIL  ${line}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
const EXPECTED = [
  {
    pattern: /localhost:11434|ERR_CONNECTION_REFUSED/,
    why: "the local-engine probe, with no Ollama in this sandbox",
  },
];
const expected = (line) => EXPECTED.find((entry) => entry.pattern.test(line));

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
page.on("requestfailed", (request) => {
  const failure = request.failure()?.errorText ?? "";
  if (/ERR_ABORTED|net::ERR_ABORTED/.test(failure)) return;
  failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
});

const settle = (ms = 1500) => page.waitForTimeout(ms);

try {
  console.log("\nSTEP 1 — the history starts empty, and says so rather than looking broken");
  await page.goto(`${BASE}/ocade/notifications`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await settle(3000);

  const empty = page.getByText(/Nothing yet\./i);
  if ((await empty.count()) === 0) {
    fail("an empty history does not say it is empty");
  } else {
    note("an empty history says so, and says what will appear here");
  }

  /*
   * WHAT THE PAGE IS ALLOWED TO CLAIM. No push provider is configured in this
   * sandbox, and §D forbids implying otherwise.
   */
  const honest = page.getByText(/does not promise an alert outside the open application/i);
  if ((await honest.count()) === 0) {
    fail("the page does not say that background delivery is unconfigured");
  } else {
    note("and does not promise background delivery it cannot make");
  }

  console.log("\nSTEP 2 — a real security action, performed on the real screen");
  /*
   * A SECOND SESSION HAS TO EXIST FIRST, and creating one by signing in again
   * is the honest way: "sign out everywhere else" correctly offers nothing when
   * there is nowhere else, so a journey that skipped this would be testing a
   * button that should not have been there.
   */
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await signInWithPassword(second, {
    baseUrl: BASE,
    email: process.env.OCADE_AUDIT_EMAIL ?? "audit@ocade.test",
    password: process.env.OCADE_AUDIT_PASSWORD ?? "AuditPassword123!",
  });
  note("a second session was opened, so there is something to sign out");

  await page.goto(`${BASE}/settings/security`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);

  const signOutOthers = page.getByRole("button", { name: /sign out everywhere else/i });
  if ((await signOutOthers.count()) === 0) {
    fail("the Security page offers no way to end other sessions");
  } else {
    await signOutOthers.first().click({ timeout: 15000 });
    await settle(1200);
    // Two steps on purpose: this locks other people out of the account, so it
    // asks before it does it.
    const confirm = page.getByRole("button", { name: /^end them$/i });
    if ((await confirm.count()) === 0) {
      fail("ending other sessions does not ask for confirmation");
    } else {
      await confirm.first().click({ timeout: 15000 });
      await settle(4000);
      note("other sessions were signed out through the product, after confirming");
    }
  }

  console.log("\nSTEP 3 — OCADE told the person, and the bell says how many");
  await page.goto(`${BASE}/ocade/notifications`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await settle(3500);

  const alert = page.getByText(/signed out/i);
  if ((await alert.count()) === 0) {
    const shown = (await page.locator("body").innerText()).slice(0, 200).replace(/\s+/g, " ");
    fail(`the security action produced no notification — page said: ${shown}`);
  } else {
    note("the security action is in the history");
  }

  const unreadBadge = page.getByText(/\d+ unread/);
  if ((await unreadBadge.count()) === 0) {
    fail("the history does not show an unread count");
  } else {
    note(`unread state is shown: "${(await unreadBadge.first().textContent())?.trim()}"`);
  }

  /*
   * PER-CHANNEL DELIVERY STATE — the part §D asks for that a product usually
   * skips, and the only thing that answers "why didn't I get an email?".
   */
  const inApp = page.getByText(/sent to in ocade/i);
  const emailState = page.getByText(/email is not configured/i);
  if ((await inApp.count()) === 0) {
    fail("the notification does not say it was delivered in the app");
  } else {
    note("delivery state is shown per channel: in-app sent");
  }
  if ((await emailState.count()) === 0) {
    fail("an unconfigured channel is not distinguished from a failed one");
  } else {
    note("and an unconfigured channel says it was never promised, not that it failed");
  }

  console.log("\nSTEP 4 — marking one read, and the badge following it");
  const markRead = page.getByRole("button", { name: /mark read/i });
  if ((await markRead.count()) === 0) {
    fail("there is no way to mark a notification read");
  } else {
    await markRead.first().click({ timeout: 15000 });
    await settle(3000);
    if ((await page.getByRole("button", { name: /mark read/i }).count()) > 0) {
      fail("the notification is still unread after being marked read");
    } else {
      note("the notification is read, and the control is gone");
    }
  }

  console.log("\nSTEP 5 — the bell links to the history rather than to the audit log");
  const bell = page.getByRole("link", { name: /^notifications/i });
  if ((await bell.count()) === 0) {
    fail("the shell offers no route to the notification history");
  } else {
    const href = await bell.first().getAttribute("href");
    if (href !== "/ocade/notifications") {
      fail(`the bell points at ${href} rather than the notification history`);
    } else {
      note("the bell points at the history");
    }
  }
  await secondContext.close();
} catch (error) {
  fail(`the journey threw: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("\nCONSOLE AND NETWORK");
let accounted = 0;
for (const line of [...consoleErrors, ...failedRequests]) {
  if (expected(line)) {
    accounted += 1;
    continue;
  }
  fail(`unexplained: ${line.slice(0, 220)}`);
}
if (accounted > 0)
  note(`${accounted} expected message(s): ${EXPECTED.map((e) => e.why).join("; ")}`);
if (consoleErrors.length + failedRequests.length === accounted) {
  note("nothing unexplained in the console or on the network");
}

await browser.close();
console.log(
  `\n${problems.length === 0 ? "NOTIFICATION HISTORY JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
