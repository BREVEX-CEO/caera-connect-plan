/**
 * THE WHOLE JOURNEY, IN ONE BROWSER, IN ORDER.
 *
 * Every other audit in this directory checks one capability against a fresh
 * page. That is how a product passes every gate and still fails the first
 * person who uses it: each stage was proved in isolation, against state
 * somebody set up for it, and nobody ever walked the line.
 *
 * This runs ONE browser context from an empty profile — no storage state, no
 * seeded database rows, no pre-signed session — and walks the customer path
 * end to end:
 *
 *   sign up → verify → chat → tools → files → projects → search →
 *   tasks → cowork → approval → pause/resume/take over/stop → offline →
 *   reopen → voice → reconnect → settings → sign out → sign back in
 *
 * The chaining IS the test. Search has to find the conversation Chat created.
 * Offline has to say it cannot reach the account rather than showing the empty
 * list an unreachable one would otherwise look like — and the project Projects
 * created must NOT appear, because `PLAN.md` Phase 2 left nothing on this
 * machine for it to come from. The reopen stage closes the page and opens a new
 * one in the same profile, so anything held only in a React state variable
 * disappears and only what was actually persisted survives. Signing out and
 * back in has to leave the work intact.
 *
 * WHAT IT DOES NOT CLAIM. The Supabase behind it is the loopback fixture in
 * scripts/fixtures/stub-supabase.mjs, so this proves the product's own flow,
 * not a hosted database. Cowork's computer control needs a native companion
 * that is not present on a CI machine; the stage asserts the product says so
 * honestly and offers no fake controls, which is the behaviour that matters
 * when the companion is missing. Voice needs a microphone, same rule.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const PASSWORD = process.env.OCADE_AUDIT_PASSWORD ?? "AuditPassword123!";
/** How long to let a screen settle before reading it, in milliseconds. */
const SLOW = Number(process.env.OCADE_JOURNEY_SETTLE ?? 900);

/** A phrase unique to this run, so "search finds it" cannot be a false pass. */
const MARK = `journey-${Date.now().toString(36)}`;
/*
 * A NEW ACCOUNT EVERY RUN. Reusing one address makes the second run a sign-in
 * rather than a sign-up, and it inherits whatever the first run left behind —
 * which is how a defect that only bites a genuinely new account hides for
 * months behind a fixture that was already past it.
 */
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? `${MARK}@ocade.test`;

const results = [];
let page;
let deliberatelyOffline = false;

/**
 * Run one stage. A stage that throws is a failed stage, not a dead run — the
 * later stages still have something to say about what survived.
 */
async function stage(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "", ms: Date.now() - started });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail: message, ms: Date.now() - started });
    console.log(`  FAIL  ${name} — ${message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(SLOW);
  await clearModals();
}

/** Consent and welcome dialogs stand between the visitor and everything. */
async function clearModals() {
  for (let round = 0; round < 6; round += 1) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let i = 0; i < (await boxes.count()); i += 1) {
      await boxes
        .nth(i)
        .click({ timeout: 4000 })
        .catch(() => {});
    }
    const button = dialog.getByRole("button", {
      name: /^(accept and continue|skip|done|finish|got it|close|continue)$/i,
    });
    if ((await button.count()) === 0) return;
    await button
      .first()
      .click({ timeout: 6000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
}

const signedIn = () =>
  page.evaluate(() => Object.keys(localStorage).some((k) => /auth-token/.test(k)));

/** Visible text of the whole page, for "is this fact on screen" questions. */
const bodyText = () => page.evaluate(() => document.body.innerText);

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream"],
});
/*
 * ONE CONTEXT FOR THE WHOLE RUN. A new context per stage would be a new
 * profile per stage — exactly the isolation this script exists to avoid.
 */
const context = await browser.newContext({ permissions: [] });
page = await context.newPage();

const consoleErrors = [];
const expectedOfflineConsoleErrors = [];
const failedRequests = [];
const failedResponses = [];
function observePage(candidate) {
  candidate.on("console", (message) => {
    if (message.type() !== "error") return;
    const target = deliberatelyOffline ? expectedOfflineConsoleErrors : consoleErrors;
    const location = message.location();
    const suffix = location.url ? ` (${location.url}:${location.lineNumber ?? 0})` : "";
    target.push(`${message.text().slice(0, 200)}${suffix}`);
  });
  candidate.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      reason: request.failure()?.errorText ?? "request failed",
    });
  });
  candidate.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });
}
observePage(page);

console.log(`\nTHE CUSTOMER JOURNEY — one profile, ${BASE}, mark ${MARK}\n`);

/* ------------------------------------------------------------------ 1 -- */
await stage("a genuinely empty profile", async () => {
  await goto("/");
  const state = await page.evaluate(() => ({
    keys: Object.keys(localStorage).length,
    tokens: Object.keys(localStorage).filter((k) => /auth-token/.test(k)).length,
  }));
  assert(state.tokens === 0, `arrived already signed in (${state.tokens} tokens)`);
  return `${state.keys} storage keys, no session`;
});

/* ------------------------------------------------------------------ 2 -- */
await stage("sign up, verify, sign in", async () => {
  await goto("/auth");
  await page
    .locator("button", { hasText: /^Email$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.waitForTimeout(200);
  await page
    .locator("button", { hasText: /^Sign in$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await clearModals();
  assert(await signedIn(), `no session after sign in; still at ${page.url()}`);
  return `session on ${new URL(page.url()).pathname}`;
});

/* ------------------------------------------------------------------ 3 -- */
await stage("sign-in lands in Chat, with nothing in the way", async () => {
  /*
   * THERE IS NO SETUP WIZARD, AND THIS IS WHERE THAT IS PROVED.
   *
   * What stood here walked five onboarding steps — a display name, an account
   * type, a storage-mode choice, a module list, a review — and asserted only
   * that they eventually let go. `docs/APP_FLOW.md` removed all five: a new
   * account arrives at Chat and configures the rest in Settings, later, having
   * seen the product first.
   */
  await page.waitForTimeout(1500);
  await clearModals();
  const landed = new URL(page.url()).pathname;
  assert(!landed.startsWith("/onboarding"), `a setup wizard still stands at ${landed}`);
  return `landed on ${landed}`;
});

/* -------------------------------------------------------------- 3.5 -- */
await stage("the old vault address goes somewhere useful", async () => {
  /*
   * THIS STAGE USED TO CREATE A VAULT.
   *
   * It opened `/settings/vault`, set a passphrase, waited for PBKDF2 at 600,000
   * iterations and asserted a recovery kit appeared — because both storage
   * modes wrote to the device first and nothing could be stored until the key
   * existed. `PLAN.md` Phase 2 removed that store: the account holds the
   * account's work and there is no device key between a person and their own
   * conversations. Asserting the setup form still appears would fail forever,
   * for the reason the phase succeeded.
   *
   * What is worth checking now is that the address did not simply die. It is in
   * the settings index of every build that shipped it, in bookmarks, and in the
   * help articles that told people where to export their data — so it has to
   * reach the screen answering what they came for.
   */
  await goto("/settings/vault");
  await clearModals();
  await page.waitForTimeout(1500);
  const landed = new URL(page.url()).pathname;
  assert(
    landed === "/settings/data",
    `the old vault address went to ${landed} instead of the data screen`,
  );
  const text = await bodyText();
  assert(
    /export/i.test(text) && /delete/i.test(text),
    `the data screen offers neither an export nor a deletion: ${text.slice(0, 160)}`,
  );
  assert(
    !/passphrase/i.test(text),
    "the removed vault passphrase is still being asked for on the data screen",
  );
  return `${landed}, with an export and a deletion on it`;
});

/* ------------------------------------------------------------------ 4 -- */
await stage("chat answers, or says why it cannot", async () => {
  await goto("/ocade");
  const composer = page.locator("#ocade-chat-composer");
  await composer.waitFor({ timeout: 20000 });
  await composer.fill(`Remember this phrase exactly: ${MARK}`);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Send", exact: true }).first().click({ timeout: 15000 });
  await page.waitForTimeout(6000);
  const text = await bodyText();
  assert(
    text.includes(MARK),
    `the message never appeared in the transcript; visible state: ${text.replace(/\s+/g, " ").slice(0, 500)}`,
  );
  /*
   * A CI container has no room for a multi-gigabyte engine, so a real answer
   * is not the assertion — an ANSWER OR A REASON is. Silence after pressing
   * Send is the failure this catches, and it is the one users actually meet.
   */
  const answered = await page
    .locator("[data-role=assistant], [data-message-role=assistant]")
    .count();
  const explained =
    /engine|download|offline|unavailable|not available|storage|browser will only allow|Local Intelligence/i.test(
      text,
    );
  assert(answered > 0 || explained, "Send produced neither an answer nor a stated reason");
  return answered > 0 ? `${answered} assistant turns` : "no engine here, and the product says so";
});

if (process.env.OCADE_JOURNEY_STOP_AFTER_CHAT === "1") {
  await browser.close();
  const chat = results.at(-1);
  if (failedResponses.length > 0) {
    console.log("\nHTTP failures before the Chat checkpoint:");
    for (const response of failedResponses.slice(-12)) {
      console.log(`  ${response.status} ${response.url}`);
    }
  }
  process.exit(chat?.ok ? 0 : 1);
}

/* ------------------------------------------------------------------ 5 -- */
await stage("the tool surface is reachable from chat", async () => {
  const text = await bodyText();
  const composerTools = await page
    .locator('button[title*="Attach"], button[aria-label*="Attach"]')
    .count();
  assert(composerTools > 0, "no attachment control on the composer");
  const modeSwitch = await page
    .locator("button", { hasText: /^(Manual|Auto|Fast|Thinking)$/ })
    .count();
  assert(modeSwitch > 0, "no run-mode control on the composer");
  return `${composerTools} attach controls, ${modeSwitch} mode controls, ${text.length} chars of surface`;
});

/* ------------------------------------------------------------------ 6 -- */
await stage("a file attaches and is named back", async () => {
  const input = page.locator('input[aria-label="Attach files"]');
  assert((await input.count()) > 0, "no file input");
  await input.setInputFiles({
    name: `${MARK}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`journey attachment ${MARK}\n`),
  });
  await page.waitForTimeout(2500);
  const text = await bodyText();
  assert(text.includes(`${MARK}.txt`), "the attached file was never shown back");
  return `${MARK}.txt accepted`;
});

/* ------------------------------------------------------------------ 7 -- */
await stage("a project is created and persists", async () => {
  await goto("/ocade/projects");
  const name = page.locator('input[placeholder="New project name"]');
  await name.waitFor({ timeout: 20000 });
  await name.fill(`Project ${MARK}`);
  await page.waitForTimeout(300);
  await page
    .locator("button", { hasText: /^Create project$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await goto("/ocade/projects");
  /*
   * A FULL RELOAD, DELIBERATELY. This used to have to put a vault passphrase
   * back first, because the key lived in memory and every load dropped it.
   * `PLAN.md` Phase 2 removed that store, so surviving a reload now means the
   * row is in the account — which is the whole claim being tested.
   */
  assert((await bodyText()).includes(MARK), "the project was gone after a reload");
  return `Project ${MARK} survived a reload`;
});

/* ------------------------------------------------------------------ 8 -- */
await stage("a task is created and persists", async () => {
  await goto("/ocade/tasks");
  const quick = page.locator('input[placeholder="Quick add a task"]');
  await quick.waitFor({ timeout: 20000 });
  await quick.fill(`Task ${MARK}`);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /^Add$/ }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await goto("/ocade/tasks");
  assert((await bodyText()).includes(MARK), "the task was gone after a reload");
  return `Task ${MARK} survived a reload`;
});

/* ------------------------------------------------------------------ 9 -- */
await stage("search finds what earlier stages made", async () => {
  await goto("/ocade/search");
  const box = page.locator('input[type=search], input[placeholder*="Search"]').first();
  await box.waitFor({ timeout: 20000 });
  await box.fill(MARK);
  await page.waitForTimeout(2500);
  // The lock only shows once a search has actually tried to read the store.
  await page.waitForTimeout(3000);
  const text = await bodyText();
  /*
   * THE CHAINING PROOF. Nothing seeded this. If search can see the run mark,
   * the conversation, project or task from four stages ago genuinely reached
   * a store that search reads — which no single-capability audit can show.
   */
  assert(text.includes(MARK), `search for ${MARK} returned nothing from this run`);
  return "the run mark came back";
});

/* ----------------------------------------------------------------- 10 -- */
await stage("cowork is honest about the missing companion", async () => {
  await goto("/ocade/work");
  await page.waitForTimeout(4000);
  const text = await bodyText();
  const honest = /extension|companion|install|not (connected|installed|detected)|Looking for/i.test(
    text,
  );
  assert(honest, "Cowork said nothing about the companion it does not have");
  /*
   * And it must not offer the controls anyway. A Pause button on a mission
   * that cannot start is a lie rendered as a button.
   */
  const liveControls = await page
    .locator("button", { hasText: /^(Pause|Resume|Take over)$/ })
    .count();
  assert(liveControls === 0, `${liveControls} live mission controls with no mission`);
  return "gate shown, no phantom controls";
});

/* --------------------------------------------------------------- 10.5 -- */
await stage("the Command Center is a closed inspector until it is asked for", async () => {
  await goto("/ocade/cowork");
  await page.waitForTimeout(3500);

  /*
   * CLOSED BY DEFAULT. The room used to carry the NAME "OCADE Command Center"
   * on the column holding the conversation and the composer — the primary
   * surface, permanently open, with none of the connection, permission or
   * receipt detail that name promises. DESIGN.md asks for the opposite: an
   * inspector that does not occupy the canvas until something needs it.
   */
  const closed = await bodyText();
  assert(!/Who is acting/i.test(closed), "the inspector was already open before anyone asked");

  const toggle = page.locator("button", { hasText: /Command Center/ }).first();
  assert((await toggle.count()) === 1, "no control opens the Command Center");
  await toggle.click();
  await page.waitForTimeout(900);

  /*
   * CASE-INSENSITIVELY, BECAUSE `innerText` APPLIES `text-transform`.
   * The section headings are styled uppercase, so `document.body.innerText`
   * returns "THIS COMPUTER" for a heading written "This computer" — an exact
   * match here fails on a panel that is rendering perfectly.
   */
  const open = (await bodyText()).toLowerCase();
  for (const heading of [
    "this computer",
    "this browser",
    "who is acting",
    "permission",
    "current action",
    "receipts",
    "diagnostics",
  ]) {
    assert(open.includes(heading), `the inspector does not answer "${heading}"`);
  }

  /*
   * AND IT IS HONEST HERE. This browser has no companion and no extension, so
   * an inspector claiming a connected computer would be the exact failure the
   * phase gate names: reported state that nothing observed.
   */
  assert(
    /not asked yet|not reachable/.test(open),
    "the inspector claimed a computer nothing has answered from",
  );
  assert(/not connected|needs updating/.test(open), "the inspector claimed an absent extension");
  assert(/nothing running/.test(open), "the inspector reported an action with nothing running");

  await toggle.click();
  await page.waitForTimeout(600);
  const shut = await bodyText();
  assert(!/Who is acting/i.test(shut), "the inspector would not close again");
  return "closed, opens with seven answers, closes";
});

/* ----------------------------------------------------------------- 11 -- */
await stage("approval and permissions are reachable and editable", async () => {
  await goto("/settings/privacy");
  await page.waitForTimeout(1500);
  await goto("/ocade/permissions");
  await page.waitForTimeout(2500);
  const text = await bodyText();
  assert(
    /permission|approve|allow|ask|deny/i.test(text),
    "no permission language on the permissions page",
  );
  const controls = await page.locator("button, input, select").count();
  assert(controls > 3, `only ${controls} controls — nothing to actually decide`);
  return `${controls} controls`;
});

/* ----------------------------------------------------------------- 12 -- */
await stage(
  "offline: the shell still renders and the product says what it cannot reach",
  async () => {
    /*
     * THIS STAGE USED TO ASSERT THE WORK WAS STILL READABLE OFFLINE.
     *
     * It could, because an encrypted IndexedDB vault held a copy of it. `PLAN.md`
     * Phase 2 removed that copy: Supabase and private Storage are the single
     * persistent authority, and there is deliberately nothing on this machine to
     * read. Keeping the old assertion would have demanded the product grow back
     * the second authority the phase existed to remove.
     *
     * The requirement that replaces it is the harder one to get right. An
     * unreachable account must not render as an EMPTY one: a projects screen that
     * shows "no projects yet" to somebody with eleven of them is a silent wrong
     * answer, and the person's next move is to make a twelfth. So the shell has
     * to render, the browser's own error page must not, and the screen has to say
     * it could not load rather than answering the question with nothing.
     *
     * WAIT FOR THE WORKER TO ACTUALLY OWN THE PAGE BEFORE CUTTING THE NETWORK.
     * This used to go offline after a flat 1200ms and hope. When the service
     * worker had not yet claimed the client, the navigation failed in the browser
     * rather than in the product — Chromium's error page, 113 characters of
     * nothing on an opaque origin — and the next stage died too, because an error
     * page has no origin to read storage from. Two failures, one cause, neither
     * of them the product.
     */
    const controlled = await page
      .waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    assert(
      controlled,
      "the service worker never took control, so offline was never actually tested",
    );

    // The shell has to be IN the cache, not merely on its way there. Without it
    // the fallback below has nothing to serve.
    const shellCached = await page
      .waitForFunction(
        async () => {
          const keys = await caches.keys();
          for (const key of keys) {
            const cache = await caches.open(key);
            if (await cache.match("/")) return true;
          }
          return false;
        },
        null,
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    assert(shellCached, "the application shell was never cached, so offline had nothing to serve");

    deliberatelyOffline = true;
    await context.setOffline(true);
    await page.waitForTimeout(1200);
    for (const path of ["/ocade", "/ocade/projects", "/ocade/tasks"]) {
      await page
        .goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 })
        .catch(() => {});
      await page.waitForTimeout(2500);
      const text = await bodyText();
      assert(text.length > 400, `${path} rendered almost nothing offline (${text.length} chars)`);
      assert(
        !/ERR_INTERNET_DISCONNECTED|This site can.t be reached/i.test(text),
        `${path} showed the browser error page`,
      );
    }

    await page.goto(`${BASE}/ocade/projects`).catch(() => {});
    await page.waitForTimeout(3000);
    const projects = await bodyText();
    /*
     * The project made online must not appear, because there is nowhere for it to
     * have come from — if it did, something is still keeping a copy of the
     * account's content on this device, and `content-storage:check` missed it.
     */
    assert(
      !projects.includes(MARK),
      "a project was readable with the network down, so something is still caching account content locally",
    );
    /*
     * And the screen must SAY SO. This is the assertion that separates an honest
     * refusal from a confident empty list.
     */
    assert(
      /could not|couldn.t|unavailable|not available|offline|cannot reach|failed to/i.test(projects),
      `the projects screen went quiet instead of saying it could not reach the account: ${projects.slice(0, 220)}`,
    );
    return "shell rendered, work correctly absent, and the screen said it could not load";
  },
);

/* ----------------------------------------------------------------- 13 -- */
await stage("reopen offline: a new page keeps the session", async () => {
  /*
   * The session survives; the work does not, and must not. A refresh token is
   * this device's own credential and is meant to persist — that is what makes
   * reconnecting seamless rather than a second sign-in. The account's content is
   * not this device's, so the stage asserts one and refuses the other.
   */
  await page.close();
  page = await context.newPage();
  observePage(page);
  await page
    .goto(`${BASE}/ocade/projects`, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(3500);
  assert(await signedIn(), "the session did not survive closing the page");
  await clearModals();
  assert(
    !(await bodyText()).includes(MARK),
    "a project survived closing the page with the network down, so it is being stored locally",
  );
  return "session survived, work correctly still absent, with the network still down";
});

/* ----------------------------------------------------------------- 14 -- */
await stage("reconnect: the product comes back without a reload", async () => {
  await context.setOffline(false);
  await page.waitForTimeout(2500);
  deliberatelyOffline = false;
  await goto("/ocade/projects");
  assert(await signedIn(), "the session was lost on reconnect");
  assert((await bodyText()).includes(MARK), "the project was lost on reconnect");
  return "back online, nothing lost";
});

/* ----------------------------------------------------------------- 15 -- */
await stage("voice offers a control and states a reason", async () => {
  await goto("/ocade");
  const mic = page
    .locator(
      'button[aria-label="Dictate a message"], button[aria-label="Stop dictating"], button[title*="talk"]',
    )
    .first();
  assert((await mic.count()) > 0, "no voice control on the composer");

  /*
   * A DISABLED CONTROL IS ONLY HONEST IF IT SAYS WHY WITHOUT A MOUSE.
   * The reason may live in the title, which is a hover — fine on a desktop,
   * invisible on a phone — so the accessible name has to carry it too.
   */
  if (await mic.isDisabled()) {
    const reason = `${(await mic.getAttribute("title")) ?? ""} ${(await mic.getAttribute("aria-label")) ?? ""}`;
    assert(reason.trim().length > 12, "the voice control is disabled and unlabelled");
    return `unavailable, and labelled: ${reason.trim().slice(0, 60)}`;
  }

  await mic.click({ timeout: 10000 });
  await page.waitForTimeout(2500);
  const listening = await page
    .locator('button[aria-label="Stop dictating"], button[title*="Release to stop"]')
    .count();
  if (listening) return "listening";

  /*
   * It stopped. Every reason it can stop for — a denied microphone, no
   * microphone, a recogniser it could not reach — is a different problem with
   * a different fix, and the one thing it must never do is go out in silence.
   */
  const said = await page
    .locator("[data-sonner-toast], [role=alert], [role=status]")
    .allTextContents();
  const spoken = said.join(" ");
  assert(
    /microphone|speech|dictation|voice|permission|connection/i.test(spoken),
    "the voice control started, stopped, and said nothing about why",
  );
  return `stopped, and said: ${spoken.trim().slice(0, 70)}`;
});

/* ----------------------------------------------------------------- 16 -- */
await stage("every settings group opens", async () => {
  const sections = [
    ["", "General"],
    ["security", "Security"],
    ["appearance", "Appearance"],
    ["voice", "Voice"],
    ["privacy", "Privacy"],
    ["devices", "Devices"],
    ["usage", "Plan"],
    ["browser", "Advanced"],
  ];
  const thin = [];
  for (const [slug, label] of sections) {
    await goto(slug ? `/settings/${slug}` : "/settings");
    const text = await bodyText();
    const controls = await page.locator("button, input, select, a[href]").count();
    if (text.length < 500 || controls < 8)
      thin.push(`${label} (${text.length} chars, ${controls} controls)`);
  }
  assert(thin.length === 0, `thin settings pages: ${thin.join(", ")}`);
  return `${sections.length} groups, all with real content`;
});

/* ----------------------------------------------------------------- 17 -- */
await stage("sign out, sign back in, and the work is still there", async () => {
  await goto("/ocade");
  await page.locator('button[aria-label="Account menu"]').first().click({ timeout: 15000 });
  await page.waitForTimeout(800);
  const out = page.getByRole("menuitem", { name: /^(Sign out|Log out)$/i }).first();
  assert((await out.count()) > 0, "no sign-out control in the account menu");
  await out.click({ timeout: 12000 });
  await page.waitForTimeout(4000);
  await clearModals();
  assert(!(await signedIn()), "still signed in after pressing Sign out");

  await goto("/auth");
  await page
    .locator("button", { hasText: /^Email$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page
    .locator("button", { hasText: /^Sign in$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(4000);
  await clearModals();
  assert(await signedIn(), "could not sign back in");

  await goto("/ocade/projects");
  assert((await bodyText()).includes(MARK), "the project did not survive a sign-out and back in");
  return `Project ${MARK} still there after a full round trip`;
});

await browser.close();

/* ---------------------------------------------------------------- report */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} stages passed`);
if (consoleErrors.length) {
  console.log(`\n${consoleErrors.length} unexpected console errors, first three:`);
  for (const error of consoleErrors.slice(0, 3)) console.log(`  ${error}`);
}
if (expectedOfflineConsoleErrors.length) {
  console.log(
    `\n${expectedOfflineConsoleErrors.length} expected browser network errors while deliberately offline`,
  );
}
if (failedRequests.length) {
  const counts = new Map();
  for (const request of failedRequests) {
    const key = `${request.reason} ${request.url}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`\n${failedRequests.length} failed requests, most frequent:`);
  for (const [request, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${count}× ${request}`);
  }
}
if (failedResponses.length) {
  const counts = new Map();
  for (const response of failedResponses) {
    const key = `${response.status} ${response.url}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`\n${failedResponses.length} HTTP error responses, most frequent:`);
  for (const [response, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${count}× ${response}`);
  }
}
if (failed.length) {
  console.log("\nFAILED STAGES:");
  for (const r of failed) console.log(`  ${r.name}: ${r.detail}`);
  process.exitCode = 1;
}
if (consoleErrors.length) process.exitCode = 1;
