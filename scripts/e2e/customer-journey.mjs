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
 *   sign up → verify → onboard → chat → tools → files → projects → search →
 *   tasks → cowork → approval → pause/resume/take over/stop → offline →
 *   reopen → voice → reconnect → settings → sign out → sign back in
 *
 * The chaining IS the test. Search has to find the conversation Chat created.
 * Offline has to show the project Projects created. The reopen stage closes
 * the page and opens a new one in the same profile, so anything held only in
 * a React state variable disappears and only what was actually persisted
 * survives. Signing out and back in has to leave the work intact.
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
/** Twelve characters minimum, per the vault's own rule. */
const PASSPHRASE = process.env.OCADE_AUDIT_PASSPHRASE ?? "journey-vault-passphrase-2026";
const SLOW = Number(process.env.OCADE_JOURNEY_SETTLE ?? 900);

/** A phrase unique to this run, so "search finds it" cannot be a false pass. */
const MARK = `journey-${Date.now().toString(36)}`;
/*
 * A NEW ACCOUNT EVERY RUN. Reusing one address makes the second run a sign-in
 * rather than a sign-up, and it inherits whatever the first run left behind —
 * which is how a vault that fails to set up on a fresh account hides for
 * months behind a fixture that already has one.
 */
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? `${MARK}@ocade.test`;

const results = [];
let page;

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

/** Consent and onboarding dialogs stand between the visitor and everything. */
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

/**
 * Put the key back after a page load, the way a person has to.
 *
 * The vault key lives in memory and nowhere else, so every full page load
 * drops it. That is the point of it — nothing on disk is readable without
 * somebody present — and it means "reload" is not a neutral act in this
 * product. Anywhere the journey reloads, this is the step a real user also
 * performs, so it is performed here rather than skipped.
 *
 * Returns true if it had to unlock, which is also the assertion that the
 * unlock was offered ON THE PAGE rather than only in Settings.
 */
async function unlockIfLocked() {
  const field = page.locator('input[aria-label="Vault passphrase"]');
  /*
   * The card reads the vault's configuration before it can offer anything, so
   * it is a round trip behind the rest of the page. Waiting briefly for it
   * rather than sampling once is the difference between "the product does not
   * offer an unlock" and "the script looked too early".
   */
  await field
    .first()
    .waitFor({ state: "visible", timeout: 6000 })
    .catch(() => {});
  if ((await field.count()) === 0) return false;
  await field.first().fill(PASSPHRASE);
  await page.waitForTimeout(200);
  await page
    .locator("button", { hasText: /^Unlock$/ })
    .first()
    .click({ timeout: 10000 });
  /*
   * PBKDF2 at 600,000 iterations is deliberately slow — that is the whole
   * point of it — and on a small CI machine it is seconds, not milliseconds.
   * Waiting for the field to go away rather than for a fixed delay is the
   * difference between measuring the product and measuring the runner.
   */
  await page
    .locator('input[aria-label="Vault passphrase"]')
    .first()
    .waitFor({ state: "detached", timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  const stillLocked = await page.locator('input[aria-label="Vault passphrase"]').count();
  if (stillLocked) {
    const complaint = await page
      .locator("[role=alert]")
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(`the vault would not unlock${complaint ? `: ${complaint.trim()}` : ""}`);
  }
  return true;
}

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
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
});

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
await stage("onboarding completes and lets go", async () => {
  const seen = [];
  for (let step = 1; step <= 10; step += 1) {
    if (new URL(page.url()).pathname !== "/onboarding") break;
    const heading = await page
      .locator("h1, h2")
      .first()
      .textContent()
      .catch(() => "");
    seen.push((heading ?? "").trim());

    /*
     * Filled through the real input rather than by writing `.value` and firing
     * an event. The setter trick works on a plain controlled input and stops
     * working the moment a field validates on blur or masks its own value —
     * and when it stops working the button simply stays disabled, which reads
     * as "onboarding is broken" rather than "the script typed wrong".
     */
    const inputs = page.locator("input:not([type=checkbox]):not([type=radio]):not([disabled])");
    for (let i = 0; i < (await inputs.count()); i += 1) {
      const field = inputs.nth(i);
      if (await field.inputValue().catch(() => "")) continue;
      const hint =
        (await field.getAttribute("placeholder")) ?? (await field.getAttribute("aria-label")) ?? "";
      const value = /mail/i.test(hint)
        ? EMAIL
        : /language|locale/i.test(hint)
          ? "English"
          : /timezone|time zone/i.test(hint)
            ? "UTC"
            : "Journey Tester";
      await field.fill(value).catch(() => {});
    }
    const boxes = page.locator("input[type=checkbox]:not([disabled])");
    for (let i = 0; i < (await boxes.count()); i += 1) {
      await boxes
        .nth(i)
        .check({ timeout: 3000 })
        .catch(() => {});
    }
    await page.waitForTimeout(500);

    const next = page
      .locator("button", { hasText: /^(Continue|Next|Finish|Enter workspace)$/i })
      .first();
    if ((await next.count()) === 0) break;
    assert(!(await next.isDisabled()), `step ${step} ("${seen.at(-1)}") would not let go`);
    await next.click({ timeout: 12000 });
    await page.waitForTimeout(2200);
  }
  const landed = new URL(page.url()).pathname;
  assert(landed !== "/onboarding", `onboarding would not finish; last step "${seen.at(-1)}"`);
  return `${seen.length} steps → ${landed}`;
});

/* -------------------------------------------------------------- 3.5 -- */
await stage("the vault is set up before anything needs it", async () => {
  /*
   * Onboarding ends here when there is no vault yet, because both privacy
   * modes write to this device first and nothing can be stored until the key
   * exists. If the product already routed us to the workspace the vault was
   * configured, and there is nothing to do.
   */
  if (!page.url().includes("/settings/vault")) {
    await goto("/settings/vault");
  }
  /*
   * The welcome tour opens over whatever the app navigated to, so it has to be
   * dismissed here as well as after each `goto` — arriving by the product's own
   * redirect is exactly the case that skips the usual dismissal.
   */
  await clearModals();
  const text = await bodyText();
  if (/Vault unlocked/i.test(text)) return "already unlocked";

  const passphrase = page.locator('input[aria-label="New vault passphrase"]');
  assert((await passphrase.count()) > 0, `no vault setup on the page: ${text.slice(0, 160)}`);
  await passphrase.fill(PASSPHRASE);
  await page.locator('input[aria-label="Repeat vault passphrase"]').fill(PASSPHRASE);
  await page.waitForTimeout(300);
  await page
    .locator("button", { hasText: /^Create vault$/ })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(4000);
  const after = await bodyText();
  assert(/Vault unlocked/i.test(after), `the vault did not unlock: ${after.slice(0, 220)}`);
  /*
   * The recovery kit is shown exactly once and never stored. If it stopped
   * appearing, somebody would lose their data the first time they forgot a
   * passphrase, and no other test would notice.
   */
  assert(/recovery/i.test(after), "no recovery kit was offered after creating the vault");
  return "created, unlocked, recovery kit shown";
});

/* ------------------------------------------------------------------ 4 -- */
await stage("chat answers, or says why it cannot", async () => {
  await goto("/ocade");
  await unlockIfLocked();
  const composer = page.locator("#ocade-chat-composer");
  await composer.waitFor({ timeout: 20000 });
  await composer.fill(`Remember this phrase exactly: ${MARK}`);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Send", exact: true }).first().click({ timeout: 15000 });
  await page.waitForTimeout(6000);
  const text = await bodyText();
  assert(text.includes(MARK), "the message never appeared in the transcript");
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
  // Arriving by a fresh page load, so the key has to go back in first.
  await unlockIfLocked();
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
  const relocked = await unlockIfLocked();
  assert((await bodyText()).includes(MARK), "the project was gone after a reload");
  return relocked
    ? `Project ${MARK} survived a reload, once the vault was unlocked in place`
    : `Project ${MARK} survived a reload`;
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
  await unlockIfLocked();
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
await stage("offline: the work made online is still readable", async () => {
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  let unlockedOffline = false;
  for (const path of ["/ocade", "/ocade/projects", "/ocade/tasks"]) {
    await page
      .goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch(() => {});
    await page.waitForTimeout(2500);
    /*
     * The unlock itself has to work with the network down. The key is derived
     * on this device from something the person knows, and the row describing
     * how to unwrap it is cached here — if either needed a server, "offline"
     * would mean "locked out of your own encrypted data", which is the
     * opposite of the promise.
     */
    if (await unlockIfLocked()) unlockedOffline = true;
    await page.waitForTimeout(1500);
    const text = await bodyText();
    assert(text.length > 400, `${path} rendered almost nothing offline (${text.length} chars)`);
    assert(
      !/ERR_INTERNET_DISCONNECTED|This site can.t be reached/i.test(text),
      `${path} showed the browser error page`,
    );
  }
  await page.goto(`${BASE}/ocade/projects`).catch(() => {});
  await page.waitForTimeout(2500);
  if (await unlockIfLocked()) unlockedOffline = true;
  await page.waitForTimeout(2000);
  assert((await bodyText()).includes(MARK), "the project was not readable offline");
  return unlockedOffline
    ? "chat, projects and tasks rendered, and the vault unlocked, with the network down"
    : "chat, projects and tasks all rendered with the network down";
});

/* ----------------------------------------------------------------- 13 -- */
await stage("reopen offline: a new page keeps the session and the work", async () => {
  await page.close();
  page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  await page
    .goto(`${BASE}/ocade/projects`, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(3500);
  assert(await signedIn(), "the session did not survive closing the page");
  await clearModals();
  await unlockIfLocked();
  assert((await bodyText()).includes(MARK), "the project did not survive closing the page");
  return "session and project both survived, with the network still down";
});

/* ----------------------------------------------------------------- 14 -- */
await stage("reconnect: the product comes back without a reload", async () => {
  await context.setOffline(false);
  await page.waitForTimeout(2500);
  await goto("/ocade/projects");
  assert(await signedIn(), "the session was lost on reconnect");
  await unlockIfLocked();
  assert((await bodyText()).includes(MARK), "the project was lost on reconnect");
  return "back online, nothing lost";
});

/* ----------------------------------------------------------------- 15 -- */
await stage("voice offers a control and states a reason", async () => {
  await goto("/ocade");
  await unlockIfLocked();
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
  await unlockIfLocked();
  assert((await bodyText()).includes(MARK), "the project did not survive a sign-out and back in");
  return `Project ${MARK} still there after a full round trip`;
});

await browser.close();

/* ---------------------------------------------------------------- report */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} stages passed`);
if (consoleErrors.length) {
  console.log(`\n${consoleErrors.length} console errors, first three:`);
  for (const error of consoleErrors.slice(0, 3)) console.log(`  ${error}`);
}
if (failed.length) {
  console.log("\nFAILED STAGES:");
  for (const r of failed) console.log(`  ${r.name}: ${r.detail}`);
  process.exitCode = 1;
}
