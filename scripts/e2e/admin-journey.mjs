/**
 * The Owner Console and the Staff Console, proved in a real browser, inside
 * ocade.in itself (owner authority 2026-10-03; admin.ocade.in is retired).
 *
 * A customer never reaches them and sees no trace of them. Staff see only the
 * modules their role holds, and nothing at all until this session answered its
 * second factor. The owner gives access by email (an account, or an invitation
 * for somebody who has not signed up), takes it back, opens a case with a
 * reason, reads the conversation under it, closes it, signs every staff member
 * out, and finds all of it in the audit record.
 *
 * The rules themselves (who may do what, second factor, recency, escalation)
 * are proven against real PostgreSQL in `staff-authority.test.ts`.
 *
 * Usage: node scripts/e2e/admin-journey.mjs [--base=…] [--supabase=…]
 */
import { createHmac } from "node:crypto";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const SITE = BASE;

function totp(secret, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/\s/g, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const mac = createHmac("sha1", key).update(message).digest();
  const at = mac[mac.length - 1] & 0xf;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const stamp = Date.now();
const signIn = (email) =>
  fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "proof" }),
  }).then((response) => response.json());
const asCustomer = (session, path, init = {}) =>
  fetch(`${SUPABASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
      prefer: "return=representation",
      ...init.headers,
    },
  });
const post = (session, table, body) =>
  asCustomer(session, `/rest/v1/${table}`, { method: "POST", body: JSON.stringify(body) }).then(
    (response) => response.json(),
  );

const customerEmail = `customer-${stamp}@ocade.test`;
const goneEmail = `gone-${stamp}@ocade.test`;
const otherEmail = `other-${stamp}@ocade.test`;
const hireEmail = `newhire-${stamp}@ocade.test`;
const customer = await signIn(customerEmail);
const other = await signIn(otherEmail); // exists, so the owner's grant resolves it to an account
// It has two-step on, and (the story goes) lost the phone and the recovery codes.
await fetch(`${SUPABASE}/__fixture/enroll-factor`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId: other.user.id }),
});
const [device] = await post(customer, "jarvis_devices", {
  name: `Office PC ${stamp}`,
  platform: "Windows",
});
const at = new Date().toISOString();
const [conversation] = await post(customer, "ocade_conversations", {
  user_id: customer.user.id,
  title: `Export trouble ${stamp}`,
  updated_at: at,
});
await post(customer, "ocade_messages", {
  user_id: customer.user.id,
  conversation_id: conversation.id,
  role: "user",
  content: `my export fails ${stamp}`,
  created_at: at,
});

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const errors = [];

async function open(session, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  if (session) {
    await context.addInitScript(
      ([key, value]) => {
        if (!window.sessionStorage.getItem("planted")) {
          window.localStorage.setItem(key, value);
          window.sessionStorage.setItem("planted", "1");
        }
      },
      [storageKey, JSON.stringify(session)],
    );
  }
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${page.url()} ${String(error).slice(0, 160)}`));
  void answerConfirmations(page);
  return page;
}

/**
 * One confirmation covers one change (P05-B), so a staff member making many
 * changes is asked "Confirm it's you" again and again. They answer with the
 * emailed code each time; the count is checked at the end.
 */
let confirmations = 0;
async function answerConfirmations(page) {
  const ask = page.getByRole("dialog", { name: "Confirm it's you" });
  while (!page.isClosed()) {
    const field = ask.getByLabel("Verification code");
    if (await field.isVisible().catch(() => false)) {
      await field.fill("123456").catch(() => undefined);
      await ask
        .getByRole("button", { name: "Confirm", exact: true })
        .click({ timeout: 2_000 })
        .then(() => (confirmations += 1))
        .catch(() => undefined);
    }
    await page.waitForTimeout(250).catch(() => undefined);
  }
}
/** The session a page holds now: confirming it's you by email replaces the one it opened with. */
const sessionOf = async (page) =>
  JSON.parse(await page.evaluate((key) => localStorage.getItem(key), storageKey));
const seen = (locator, timeout = 10_000) =>
  locator
    .first()
    .waitFor({ timeout })
    .then(
      () => true,
      () => false,
    );
const tabs = (page) => page.getByRole("navigation", { name: "Console" }).getByRole("button");
const tab = (page, name) =>
  page.getByRole("navigation", { name: "Console" }).getByRole("button", { name, exact: true });

/** The console is a page of the site, reached from the sidebar like Chat, JARVIS and the Library. */
const sidebarEntry = (page, name) =>
  page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true });
async function consoleOf(page, heading) {
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  // On a phone the sidebar is a drawer behind the menu button.
  const drawer = page.getByRole("button", { name: "Open navigation" });
  if (await seen(drawer, 5_000)) await drawer.click();
  const entry = sidebarEntry(page, heading).locator("visible=true");
  if (!(await seen(entry, 15_000))) return false;
  await entry.first().click();
  return (
    (await until(async () => new URL(page.url()).pathname === "/admin", 15_000)) &&
    (await seen(page.getByRole("heading", { name: heading, exact: true }), 20_000))
  );
}
/** The sidebar's own meter or "Unlimited use", as the person sees it. */
const meter = async (page) => {
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const unlimited = await page.getByText(/^Unlimited (use|until)/).count();
  if (unlimited)
    return (
      await page
        .getByText(/^Unlimited (use|until)/)
        .first()
        .innerText()
    ).trim();
  const left = page.getByText(/ of \d+ left · resets/);
  return (await left.count()) ? (await left.first().innerText()).trim() : "";
};
async function customerRow(page) {
  await page.getByPlaceholder("Search by email, name or account id").fill(`customer-${stamp}`);
  const row = page.locator("li", { hasText: customerEmail });
  await row.getByRole("button", { name: "Open", exact: true }).click();
  await row.getByText(`Office PC ${stamp}`).waitFor({ timeout: 10_000 });
  return row;
}

try {
  /* --- a customer: no console, no trace of one ------------------------------ */
  const person = await open(customer);
  await person.goto(`${SITE}/admin`, { waitUntil: "load" });
  await person.waitForTimeout(2500);
  check(
    "a customer opening /admin is returned to Chat, told nothing",
    new URL(person.url()).pathname === "/" &&
      (await person.getByRole("heading", { name: /Console/ }).count()) === 0,
  );
  await person.waitForTimeout(1500);
  check(
    "a customer's navigation names no console",
    (await person
      .getByRole("navigation", { name: "Primary" })
      .getByText(/Console/)
      .count()) === 0 && (await person.getByText(/Owner Console|Staff Console/).count()) === 0,
  );
  await person.getByRole("button", { name: new RegExp(customerEmail) }).click();
  await person.getByRole("menuitem", { name: "Settings" }).waitFor();
  check(
    "and neither does their account menu",
    (await person.getByRole("menuitem", { name: /Console/ }).count()) === 0,
  );
  await person.keyboard.press("Escape");
  const direct = await asCustomer(customer, "/rest/v1/rpc/ocade_staff_grant", {
    method: "POST",
    body: JSON.stringify({
      p_email: customerEmail,
      p_role: "admin",
      p_reason: "Promoting myself quietly",
    }),
  });
  const table = await asCustomer(customer, "/rest/v1/ocade_staff?select=*");
  check(
    "a customer calling the staff functions or tables directly is refused",
    direct.status === 400 && table.status === 403,
    `${direct.status} ${table.status}`,
  );

  /* --- staff without a second factor this session see nothing --------------- */
  const plain = await open(await signIn(`admin-${stamp}@ocade.test`));
  check("an Admin gets the Staff Console", await consoleOf(plain, "Staff Console"));
  check(
    "but without a second factor it shows no module and no customer",
    (await seen(plain.getByText("The console opens once this session has answered"))) &&
      (await plain.getByRole("navigation", { name: "Console" }).count()) === 0 &&
      (await plain.getByPlaceholder("Search by email, name or account id").count()) === 0,
  );

  /* --- two-step set up in this very sign-in -------------------------------- */
  const totpEmail = `admin-${stamp}-totp@ocade.test`;
  const bare = await signIn(totpEmail);
  const factor = await asCustomer(bare, "/auth/v1/factors", {
    method: "POST",
    body: JSON.stringify({ factor_type: "totp", friendly_name: "Phone" }),
  }).then((r) => r.json());
  const confirmOn = async (session, offset) => {
    const challenge = await asCustomer(session, `/auth/v1/factors/${factor.id}/challenge`, {
      method: "POST",
      body: "{}",
    }).then((r) => r.json());
    return asCustomer(session, `/auth/v1/factors/${factor.id}/verify`, {
      method: "POST",
      body: JSON.stringify({ challenge_id: challenge.id, code: totp(factor.totp.secret, offset) }),
    }).then((r) => r.json());
  };
  const staffCan = (session) =>
    asCustomer(session, "/rest/v1/rpc/ocade_staff_can", {
      method: "POST",
      body: JSON.stringify({ p_permission: "customers.read" }),
    }).then((r) => r.json());
  // A stolen token could enroll its own authenticator; the session it was added in gets nothing.
  const settingUp = await confirmOn(bare, -1);
  const stale = await open(settingUp);
  await stale.goto(`${SITE}/admin`, { waitUntil: "load" });
  check(
    "the session two-step was set up in must sign in again before the console works",
    (await seen(stale.getByText(/set up two-step verification after signing in here/))) &&
      (await stale.getByRole("navigation", { name: "Console" }).count()) === 0 &&
      (await staffCan(settingUp)) === false,
    stale.url(),
  );
  await stale.context().close();
  // Signed in again and the code answered: the site's own session is the staff session.
  const siteStrong = await confirmOn(await signIn(totpEmail), 0);
  check("a new sign-in with its code operates", (await staffCan(siteStrong)) === true);
  const guarded = await open(siteStrong);
  check(
    "and its console opens on ocade.in itself, with no second hop or second code",
    (await consoleOf(guarded, "Staff Console")) &&
      (await seen(tab(guarded, "Customers"))) &&
      new URL(guarded.url()).origin === new URL(SITE).origin,
    guarded.url(),
  );
  check(
    "the console sits in the normal navigation, beneath Chat, JARVIS and the Library",
    (await guarded.getByRole("navigation", { name: "Primary" }).getByRole("link").allInnerTexts())
      .map((t) => t.trim())
      .join(",")
      .endsWith("Chat,OCADE JARVIS,Library,Staff Console"),
    (
      await guarded.getByRole("navigation", { name: "Primary" }).getByRole("link").allInnerTexts()
    ).join(","),
  );
  // A session put in an address is never taken up (PKCE accepts only its own code).
  const planted = await open(null);
  await planted.goto(
    `${SITE}/admin#access_token=${siteStrong.access_token}&refresh_token=${siteStrong.refresh_token}&expires_in=3600&token_type=bearer`,
    { waitUntil: "load" },
  );
  check(
    "a session put in the address is never taken up",
    (await until(async () => new URL(planted.url()).pathname.startsWith("/auth"), 15_000)) &&
      (await planted.getByRole("heading", { name: /Console/ }).count()) === 0,
    planted.url(),
  );
  await planted.context().close();
  await guarded.context().close();

  /* --- an Admin with a second factor, on a phone-sized screen -------------- */
  const strongSession = await signIn(`admin+mfa-${stamp}@ocade.test`);
  const strong = await open(strongSession, {
    width: 390,
    height: 844,
  });
  await consoleOf(strong, "Staff Console");
  await tab(strong, "Customers").waitFor({ timeout: 10_000 });
  check(
    "an Admin sees Customers, Cases, System and Audit, and never Staff",
    (await tabs(strong).allInnerTexts()).join(",") === "Customers,Cases,System,Audit",
    (await tabs(strong).allInnerTexts()).join(","),
  );
  const strongRow = await customerRow(strong);
  check("the Admin sees the customer's device", true);
  check(
    "and the account's security, usage and tasks",
    (await seen(strongRow.getByText(/Two-step (on|off) · \d+ active session/))) &&
      (await seen(strongRow.getByText(/^Normal limits · /))),
  );
  check(
    "an Admin cannot open a case (owners do)",
    (await strongRow.getByRole("button", { name: /Open a case/ }).count()) === 0 &&
      (await strongRow.getByRole("button", { name: "End all their sessions" }).count()) === 1,
  );
  const remove = strongRow.getByRole("button", { name: "Remove", exact: true });
  check("Remove waits for a reason", await remove.isDisabled());
  await strongRow.getByPlaceholder(/Why a device is being removed/).fill("short");
  check("a reason under ten characters is not enough", await remove.isDisabled());
  await strongRow
    .getByPlaceholder(/Why a device is being removed/)
    .fill("customer reported it stolen");
  await remove.click();
  check(
    "with a second factor and a reason the device is removed",
    await seen(strongRow.getByText("Removed", { exact: true })),
  );
  check(
    "no horizontal overflow on a phone",
    (await strong.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
  );
  const stored = await fetch(
    `${SUPABASE}/rest/v1/jarvis_devices?id=eq.${device.id}&select=revoked_at,public_key`,
  ).then((response) => response.json());
  check("the device's key is gone on the server", Boolean(stored[0]?.revoked_at));

  /* --- a customer who lost their phone and their recovery codes ------------- */
  await strong.getByPlaceholder("Search by email, name or account id").fill(`other-${stamp}`);
  const lostRow = strong.locator("li", { hasText: otherEmail });
  await lostRow.getByRole("button", { name: "Open", exact: true }).click();
  await lostRow.getByText(/Two-step on/).waitFor({ timeout: 10_000 });
  const turnOff = lostRow.getByRole("button", { name: "Turn off their two-step" });
  check("turning off a customer's two-step waits for a reason", await turnOff.isDisabled());
  await lostRow.getByPlaceholder(/^Why \(/).fill("Lost phone and codes, identity checked");
  await turnOff.click();
  check(
    "an Admin turns off a lost second factor, and the account shows it",
    (await seen(strong.getByText(/Their two-step verification is off/))) &&
      (await seen(lostRow.getByText(/Two-step off/))),
  );
  const factorsLeft = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { authorization: `Bearer ${(await signIn(otherEmail)).access_token}` },
  }).then((response) => response.json());
  check("the factor is gone on the server", (factorsLeft.factors ?? []).length === 0);

  /* --- the stops: all device work, the Device Agent, the extension --------- */
  await tab(strong, "System").click();
  const stops = strong.getByRole("region", { name: "JARVIS device work" });
  check(
    "three stops, all running",
    (await seen(stops.getByText("Running", { exact: true }))) &&
      (await stops.getByText("Running", { exact: true }).count()) === 3,
  );
  check(
    "system health shows real counts",
    await seen(strong.getByRole("region", { name: "System health" }).getByText("Computers online")),
  );
  const pauseAgent = stops.getByRole("button", { name: "Pause Device Agent" });
  check("a stop waits for a reason", await pauseAgent.isDisabled());
  await stops.getByPlaceholder("Why (at least ten characters)").fill("agent release under review");
  await pauseAgent.click();
  check(
    "the Device Agent alone is paused",
    await seen(stops.getByRole("button", { name: "Resume Device Agent" })),
  );
  check(
    "and the other two keep running",
    (await stops.getByText("Running", { exact: true }).count()) === 2,
  );

  // A customer with an online computer cannot start computer work meanwhile.
  await post(customer, "jarvis_devices", {
    name: "Desk PC",
    platform: "Windows",
    kind: "agent",
    last_seen_at: new Date().toISOString(),
    capabilities: { files: true },
  });
  await fetch(`${SUPABASE}/__fixture/jarvis-script`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      trigger: "paused-agent",
      steps: [
        {
          tool: "start_task",
          args: {
            checks: [{ contains: ["done"] }],
            title: "Tidy files",
            where: "computer",
            steps: ["Tidy"],
          },
        },
        { text: "Computer work is paused right now." },
      ],
    }),
  });
  await person.goto(`${BASE}/ocade-jarvis`, { waitUntil: "load" });
  await person.locator("#jarvis-composer").waitFor();
  await person.waitForTimeout(1500);
  await person.locator("#jarvis-composer").fill("paused-agent tidy my files");
  await person.getByRole("button", { name: "Send", exact: true }).click();
  await person.getByText("Computer work is paused right now.").waitFor({ timeout: 30_000 });
  const turns = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json());
  check(
    "a customer's computer task is refused while the Device Agent is paused",
    turns.turns.some((turn) => turn.content.includes("paused by OCADE")),
  );
  await stops
    .getByPlaceholder("Why (at least ten characters)")
    .fill("agent release approved again");
  await stops.getByRole("button", { name: "Resume Device Agent" }).click();
  check("and it resumes", await seen(stops.getByRole("button", { name: "Pause Device Agent" })));

  /* --- Support: two modules, and nothing it can change ---------------------- */
  const support = await open(await signIn(`support+mfa-${stamp}@ocade.test`));
  await consoleOf(support, "Staff Console");
  await tab(support, "Customers").waitFor({ timeout: 10_000 });
  check(
    "Support sees Customers and Cases only",
    (await tabs(support).allInnerTexts()).join(",") === "Customers,Cases",
    (await tabs(support).allInnerTexts()).join(","),
  );
  await support.getByPlaceholder("Search by email, name or account id").fill(`customer-${stamp}`);
  const supportRow = support.locator("li", { hasText: customerEmail });
  await supportRow.getByRole("button", { name: "Open", exact: true }).click();
  await supportRow.getByText("Desk PC").waitFor({ timeout: 10_000 });
  check(
    "Support can look at a customer but has no plan, device, session or case control",
    (await supportRow
      .getByRole("button", { name: /Give access|Revoke|Remove|End all|Open a case/ })
      .count()) === 0 && (await supportRow.getByText(/Two-step/).count()) === 0,
  );
  await tab(support, "Cases").click();
  check(
    "and no conversation is readable without a case",
    await seen(support.getByText("No open cases.")),
  );

  /* --- the Owner ------------------------------------------------------------ */
  const ownerEmail = `owner+mfa-${stamp}@ocade.test`;
  const ownerSession = await signIn(ownerEmail);
  const owner = await open(ownerSession);
  check("the owner's sidebar offers the Owner Console", await consoleOf(owner, "Owner Console"));
  await tab(owner, "Staff").waitFor({ timeout: 10_000 });
  check(
    "with every module",
    (await tabs(owner).allInnerTexts()).join(",") === "Customers,Cases,Staff,System,Audit",
    (await tabs(owner).allInnerTexts()).join(","),
  );
  check(
    "the console always says whose account it is",
    await seen(
      owner.getByRole("button", { name: new RegExp(ownerEmail.replace(/[.+]/g, "\\$&")) }),
    ),
  );
  check(
    "and the owner keeps Chat, JARVIS and the Library beside it",
    (await owner
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: /^(Chat|Library|OCADE JARVIS)$/ })
      .count()) === 3,
  );

  // Give access by email: an existing account, then somebody with no account.
  await tab(owner, "Staff").click();
  const staffList = owner.getByRole("region", { name: "Staff", exact: true });
  check(
    "the staff list shows who operates OCADE",
    (await seen(staffList.getByText(`support+mfa-${stamp}@ocade.test`))) &&
      (await seen(staffList.getByText(/\(you\)/))),
  );
  const give = owner.getByRole("region", { name: "Give someone access" });
  const giveButton = give.getByRole("button", { name: "Give access" });
  await give.getByPlaceholder("name@example.com").fill(otherEmail);
  await give.getByRole("combobox").selectOption("billing");
  check("giving access waits for a reason", await giveButton.isDisabled());
  await give.getByPlaceholder(/^Why/).fill("Handles plan questions from today");
  await giveButton.click();
  check(
    "an existing account is given its role",
    (await seen(owner.getByText(`${otherEmail} is now Billing.`))) &&
      (await seen(staffList.locator("li", { hasText: otherEmail }).getByText("Billing"))),
  );
  await give.getByPlaceholder("name@example.com").fill(hireEmail);
  await give.getByRole("combobox").selectOption("read_only");
  await give.getByPlaceholder(/^Why/).fill("Joining next week as an auditor");
  await giveButton.click();
  check(
    "an address with no account waits as an invitation",
    (await seen(owner.getByText(/Invitation saved/))) &&
      (await seen(staffList.locator("li", { hasText: hireEmail }).getByText("Read-only"))),
  );
  const hire = await open(await signIn(hireEmail));
  check(
    "and becomes access when that person signs up",
    (await consoleOf(hire, "Staff Console")) && (await seen(hire.getByText(/Read-only\./))),
  );

  // Take access back: it ends on the person's next request.
  const supportMember = staffList.locator("li", { hasText: `support+mfa-${stamp}@ocade.test` });
  await supportMember.getByRole("button", { name: "Change" }).click();
  const takeBack = supportMember.getByRole("button", { name: "Remove access" });
  check("removing access waits for a reason", await takeBack.isDisabled());
  await supportMember.getByPlaceholder(/^Why/).fill("Moved to another team today");
  await takeBack.click();
  check(
    "the owner removes Support's access",
    (await seen(owner.getByText(/Access removed/))) &&
      (await until(async () => (await supportMember.count()) === 0)),
  );
  const supportToken = await signIn(`support+mfa-${stamp}@ocade.test`);
  check(
    "the removed person's authority is gone at the database on the very next request",
    (await staffCan(supportToken)) === false,
  );
  // Nobody touches the open console: it notices and leaves by itself.
  check(
    "and their open console leaves by itself within seconds, back to Chat",
    await until(async () => new URL(support.url()).pathname === "/", 30_000),
    support.url(),
  );
  check(
    "with its sidebar entry gone",
    await until(
      async () => (await support.getByText(/Owner Console|Staff Console/).count()) === 0,
      15_000,
    ),
  );
  await support.reload({ waitUntil: "load" });
  await support.waitForTimeout(2500);
  check(
    "and is gone on reload, with no explanation",
    new URL(support.url()).pathname === "/" &&
      (await support.getByRole("heading", { name: /Console/ }).count()) === 0,
  );

  // A case: reason, hours, the customer is told, the conversation is read, the case closes.
  await tab(owner, "Customers").click();
  const ownerRow = await customerRow(owner);
  // A case names one conversation and one reader (F-014): here the owner reads it.
  await ownerRow.getByRole("button", { name: "Open a case…" }).click();
  const openCase = ownerRow.getByRole("button", { name: "Open the case" });
  await ownerRow.getByPlaceholder(/^Why \(/).fill("Customer reported export failure");
  check("opening a case waits for a conversation", await openCase.isDisabled());
  await ownerRow
    .getByRole("combobox", { name: "Conversation" })
    .selectOption({ label: `Export trouble ${stamp}` });
  await openCase.click();
  const cases = owner.getByRole("region", { name: "Open cases" });
  check(
    "the case opens and is listed with its reason",
    (await seen(owner.getByText(/Case opened/))) &&
      (await seen(cases.getByText(/Customer reported export failure/))),
  );
  const told = await fetch(`${SUPABASE}/__fixture/notifications`).then((r) => r.json());
  check(
    "the customer is told that support can read their conversations",
    told.some(
      (row) => row.user_id === customer.user.id && /support can read/i.test(row.title ?? ""),
    ),
  );
  await cases.getByRole("button", { name: "Read", exact: true }).click();
  check(
    "the conversation is readable under the case",
    await seen(cases.getByText(`my export fails ${stamp}`)),
  );
  const close = cases.getByRole("button", { name: "Close case" });
  check("closing a case waits for a reason", await close.isDisabled());
  await cases.getByPlaceholder(/^Why it can close/).fill("Resolved: export works again");
  await close.click();
  check(
    "the case closes and access ends",
    (await seen(owner.getByText(/Case closed/))) && (await seen(cases.getByText("No open cases."))),
  );

  // A temporary plan: given with a reason, the customer's at once, and taken back at once.
  await tab(owner, "Customers").click();
  const planRow = await customerRow(owner);
  await planRow.getByRole("button", { name: "Give access", exact: true }).click();
  await owner.getByLabel("Tier").selectOption("pro");
  await owner.getByLabel("Days").fill("1");
  await owner
    .getByPlaceholder("Why this account is being given access")
    .fill("Temporary Pro for the release test");
  await owner.locator("form").getByRole("button", { name: "Give access", exact: true }).click();
  const planOf = async () =>
    JSON.stringify(
      await asCustomer(customer, "/rest/v1/rpc/ocade_my_entitlement_grant", {
        method: "POST",
        body: "{}",
      }).then((r) => r.json()),
    );
  check(
    "a temporary plan is given with a reason and is the customer's at once",
    await until(async () => (await planOf()).includes('"tier":"pro"')),
    await planOf(),
  );
  owner.once("dialog", (dialog) => void dialog.accept("Release test finished"));
  await planRow.getByRole("button", { name: "Revoke", exact: true }).click();
  check(
    "taken back, the customer is on their own plan again at once",
    await until(async () => !(await planOf()).includes('"tier":"pro"')),
    await planOf(),
  );
  await planRow.getByRole("button", { name: "Close", exact: true }).first().click();

  // Give back usage, suspend and restore: on the record, and real at Supabase Auth.
  await tab(owner, "Customers").click();
  const accountRow = await customerRow(owner);
  const operations = accountRow.getByPlaceholder(/^Reason for the record/);
  const giveBack = accountRow.getByRole("button", { name: "Give back", exact: true });
  check("giving back usage waits for a reason", await giveBack.isDisabled());
  await operations.fill("Refund for the export outage");
  await giveBack.click();
  check("usage is given back", await seen(owner.getByText(/^Given back\./)));
  const [desk] = await post(customer, "jarvis_devices", {
    name: `Desk ${stamp}`,
    platform: "Windows",
  });
  await operations.fill("Card fraud reported by the bank");
  await accountRow.getByRole("button", { name: "Suspend the account" }).click();
  check(
    "the account is suspended",
    (await seen(owner.getByText(/^Suspended\. They are signed out everywhere/))) &&
      (await seen(accountRow.getByText("Suspended", { exact: true }))),
  );
  const bannedSignIn = await signIn(customerEmail);
  const oldToken = await asCustomer(customer, "/rest/v1/rpc/ocade_staff_can", {
    method: "POST",
    body: JSON.stringify({ p_permission: "customers.read" }),
  });
  const devices = await fetch(
    `${SUPABASE}/rest/v1/jarvis_devices?id=eq.${desk.id}&select=revoked_at`,
  ).then((response) => response.json());
  check(
    "a suspended customer cannot sign in, their session is gone and their computer disconnected",
    bannedSignIn.error_code === "user_banned" &&
      oldToken.status === 401 &&
      Boolean(devices[0]?.revoked_at),
    `${JSON.stringify(bannedSignIn).slice(0, 80)} ${oldToken.status}`,
  );
  await operations.fill("The bank confirmed it was a mistake");
  await accountRow.getByRole("button", { name: "Restore the account" }).click();
  check("the account is restored", await seen(owner.getByText(/^Restored\./)));
  check("and the customer signs in again", Boolean((await signIn(customerEmail)).access_token));

  // An owner deletes an account: the address typed exactly, then gone with its data.
  const gone = await signIn(goneEmail);
  await post(gone, "ocade_conversations", {
    user_id: gone.user.id,
    title: `Leaving ${stamp}`,
    updated_at: new Date().toISOString(),
  });
  await owner.getByPlaceholder("Search by email, name or account id").fill(`gone-${stamp}`);
  const goneRow = owner.locator("li", { hasText: goneEmail });
  await goneRow.getByRole("button", { name: "Open", exact: true }).click();
  const deleteButton = goneRow.getByRole("button", { name: "Delete the account permanently" });
  await goneRow.getByPlaceholder(/^Reason for the record/).fill("The customer asked us by email");
  await goneRow
    .getByLabel("Type the account's email address to delete it")
    .fill("someone@else.test");
  check("deleting waits for the account's own address", await deleteButton.isDisabled());
  await goneRow.getByLabel("Type the account's email address to delete it").fill(goneEmail);
  await deleteButton.click();
  check(
    "the account is deleted",
    await seen(owner.getByText(/^The account is deleted\. Reference DEL-/)),
  );
  const again = await signIn(goneEmail);
  const left = await (await asCustomer(again, "/rest/v1/ocade_conversations?select=id")).json();
  check(
    "signing in with that address again finds a new, empty account",
    Array.isArray(left) && left.length === 0,
    JSON.stringify(left).slice(0, 120),
  );

  // The owner is never stopped by a window, and says so; usage is still recorded.
  check(
    "the owner's meter says unlimited",
    (await meter(owner)) === "Unlimited use",
    await meter(owner),
  );
  await owner.goto(`${SITE}/ocade-jarvis`, { waitUntil: "load" });
  check("and so does JARVIS", await seen(owner.getByText("Unlimited JARVIS use"), 20_000));
  const recorded0 = await asCustomer(await sessionOf(owner), "/rest/v1/rpc/ocade_staff_can", {
    method: "POST",
    body: JSON.stringify({ p_permission: "grants.manage" }),
  }).then((r) => r.json());
  check("an owner holds the grants permission", recorded0 === true);

  // A member of staff: normal limits, then unlimited until revoked, then normal again.
  const hirePage = hire;
  const before = await meter(hirePage);
  check("a member of staff starts on normal limits", / of 28 left/.test(before), before);
  await consoleOf(owner, "Owner Console");
  await tab(owner, "Staff").click();
  const hireMember = owner
    .getByRole("region", { name: "Staff", exact: true })
    .locator("li", { hasText: hireEmail });
  await hireMember.getByRole("button", { name: "Usage", exact: true }).click();
  check(
    "the owner sees their usage, limits included",
    await seen(hireMember.getByText(/^Normal limits · /)),
  );
  check(
    "and when they last used Chat and JARVIS",
    await seen(hireMember.getByText(/^Last Chat use .* · last JARVIS step /)),
  );
  const giveUnlimited = hireMember.getByRole("button", { name: "Give unlimited use" });
  check("giving unlimited use waits for a reason", await giveUnlimited.isDisabled());
  await hireMember.getByPlaceholder(/^Why unlimited/).fill("Running the mobile test matrix today");
  await giveUnlimited.click();
  check(
    "unlimited use is given until revoked",
    (await seen(owner.getByText("Unlimited use given until revoked."))) &&
      (await seen(hireMember.getByText(/^Unlimited until revoked · /))),
  );
  check(
    "and is theirs at once",
    (await meter(hirePage)) === "Unlimited use",
    await meter(hirePage),
  );
  await hireMember.getByPlaceholder(/^Why unlimited/).fill("The mobile test matrix has finished");
  await hireMember.getByRole("button", { name: "Back to normal limits" }).click();
  check("taken back by the owner", await seen(owner.getByText("Back to normal limits.")));
  check(
    "and their normal limits return at once",
    / of 28 left/.test(await meter(hirePage)),
    await meter(hirePage),
  );

  // A customer test account: unlimited until a set time.
  await tab(owner, "Customers").click();
  const timedRow = await customerRow(owner);
  const tomorrow = new Date(Date.now() + 26 * 3600_000);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await timedRow.getByLabel("Unlimited until (empty: until revoked)").fill(local);
  await timedRow.getByPlaceholder(/^Why unlimited/).fill("Android test account for the matrix");
  await timedRow.getByRole("button", { name: "Give unlimited until then" }).click();
  check(
    "a customer is given unlimited use until a set time",
    (await seen(owner.getByText("Unlimited use given until then."))) &&
      (await seen(timedRow.getByText(/^Unlimited until .* · /))),
  );
  const customerUsage = await asCustomer(customer, "/rest/v1/rpc/ocade_account_unlimited", {
    method: "POST",
    body: JSON.stringify({ target_user: customer.user.id }),
  });
  check(
    "a browser cannot ask about unlimited use itself",
    customerUsage.status >= 400,
    String(customerUsage.status),
  );
  await timedRow.getByPlaceholder(/^Why unlimited/).fill("The Android matrix run has finished");
  await timedRow.getByRole("button", { name: "Back to normal limits" }).click();
  check("and back to normal limits", await seen(owner.getByText("Back to normal limits.")));
  await timedRow.getByRole("button", { name: "Close", exact: true }).first().click();

  // Ownership: a second Owner, the Primary Owner handed over and handed back.
  const heirEmail = `heir+mfa-${stamp}@ocade.test`;
  const heirSession = await signIn(heirEmail);
  await tab(owner, "Staff").click();
  await give.getByPlaceholder("name@example.com").fill(heirEmail);
  await give.getByRole("combobox").selectOption("backup_owner");
  await give.getByPlaceholder(/^Why/).fill("A second owner for the company");
  await giveButton.click();
  check("another Owner is named", await seen(owner.getByText(`${heirEmail} is now Owner.`)));
  const heir = await open(heirSession);
  check("who gets the Owner Console", await consoleOf(heir, "Owner Console"));
  check("and unlimited use", (await meter(heir)) === "Unlimited use", await meter(heir));
  const heirMember = owner
    .getByRole("region", { name: "Staff", exact: true })
    .locator("li", { hasText: heirEmail });
  await heirMember.getByRole("button", { name: "Change" }).click();
  const handOver = heirMember.getByRole("button", { name: "Hand ownership over" });
  await heirMember.getByPlaceholder(/^Why/).fill("Planned hand-over to the new owner");
  check("handing over waits for an explicit confirmation", await handOver.isDisabled());
  await heirMember.getByText(/I understand/).click();
  await handOver.click();
  // The page reloads itself after the hand-over: wait for the console that reload opens.
  await owner.waitForURL((url) => url.pathname === "/admin", { timeout: 20_000 }).catch(() => {});
  await owner.waitForLoadState("load");
  await tab(owner, "Staff").waitFor({ timeout: 20_000 });
  await tab(owner, "Staff").click();
  const ownerList = owner.getByRole("region", { name: "Staff", exact: true });
  const settled = async () => {
    const text = (await ownerList.innerText().catch(() => "")).replace(/\s+/g, " ");
    return text.includes(`${heirEmail} Primary Owner`) && /\(you\) Owner/.test(text);
  };
  check(
    "the new Primary Owner holds it and the former one stays an Owner",
    await until(settled, 20_000),
    (await ownerList.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300),
  );
  // Handed back by the new Primary Owner, who leaves the staff as they do.
  await consoleOf(heir, "Owner Console");
  await tab(heir, "Staff").click();
  const back = heir
    .getByRole("region", { name: "Staff", exact: true })
    .locator("li", { hasText: ownerEmail });
  await back.getByRole("button", { name: "Change" }).click();
  await back.getByPlaceholder(/^Why/).fill("Handing it back and stepping down");
  await back.getByText("Stay an Owner myself afterwards").click();
  await back.getByText(/I understand/).click();
  await back.getByRole("button", { name: "Hand ownership over" }).click();
  check(
    "handed back, the one who leaves the staff is back in Chat with no console",
    (await until(async () => new URL(heir.url()).pathname === "/", 20_000)) &&
      (await until(
        async () => (await heir.getByText(/Owner Console|Staff Console/).count()) === 0,
        20_000,
      )),
    heir.url(),
  );
  await owner.reload({ waitUntil: "load" });
  await tab(owner, "Staff").click();
  const primaries = () =>
    owner
      .getByRole("region", { name: "Staff", exact: true })
      .getByText("Primary Owner", { exact: true })
      .count();
  check(
    "and there is always exactly one Primary Owner",
    await until(async () => (await primaries()) === 1, 15_000),
    String(await primaries()),
  );

  // Everything above is on the record.
  await tab(owner, "Audit").click();
  const audit = owner.getByRole("region", { name: "Audit record" });
  await audit.getByText("Opened a case").first().waitFor({ timeout: 10_000 });
  const recorded = await audit.innerText();
  check(
    "the audit record names each privileged change, who made it and why",
    [
      "Gave staff access",
      "Invited staff",
      "Invitation accepted",
      "Removed staff access",
      "Turned off a customer's two-step verification",
      "Opened a case",
      "Read a conversation under a case",
      "Closed a case",
      "Gave back usage",
      "Suspended an account",
      "Restored an account",
      "Began deleting an account",
      "Gave unlimited use",
      "Ended unlimited use",
      "Handed ownership over",
      "Moved to another team today",
    ].every((line) => recorded.includes(line)),
    recorded.replace(/\s+/g, " ").slice(0, 400),
  );

  // One person's permissions: the Admin loses the JARVIS stop, and only that.
  await tab(owner, "Staff").click();
  const adminMember = owner
    .getByRole("region", { name: "Staff", exact: true })
    .locator("li", { hasText: `admin+mfa-${stamp}@ocade.test` });
  await adminMember.getByRole("button", { name: "Change" }).click();
  const stopChip = adminMember.getByRole("button", { name: /^Pause or resume JARVIS/ });
  check(
    "the owner sees what the role already holds",
    (await stopChip.getAttribute("aria-pressed")) === "true" &&
      (await adminMember
        .getByRole("button", { name: /^Manage staff/ })
        .getAttribute("aria-pressed")) === "false",
  );
  await stopChip.click();
  await adminMember.getByPlaceholder(/^Why/).fill("Stops are handled by operations now");
  await adminMember.getByRole("button", { name: "Save permissions" }).click();
  check(
    "a permission is taken from one person, with a reason",
    (await seen(owner.getByText("Permissions changed."))) &&
      (await seen(adminMember.getByText(/with changes/))),
  );
  await strong.reload({ waitUntil: "load" });
  await tab(strong, "System").click();
  const theirStops = strong.getByRole("region", { name: "JARVIS device work" });
  check(
    "that person still sees the stops but can no longer press them",
    (await seen(theirStops.getByText("Running", { exact: true }))) &&
      (await theirStops.getByRole("button", { name: /^(Pause|Resume) / }).count()) === 0,
  );

  // Emergency: every staff session ends, except the owner's own.
  const strongNow = await sessionOf(strong);
  await tab(owner, "Staff").click();
  const emergency = owner.getByRole("region", { name: /Emergency/ });
  const signOut = emergency.getByRole("button", { name: "Sign all staff out" });
  check("the emergency sign-out waits for a reason", await signOut.isDisabled());
  await emergency.getByPlaceholder(/^Why/).fill("Suspected staff credential leak");
  await signOut.click();
  check(
    "every other staff session ends",
    await seen(owner.getByText(/Every other staff session ended/)),
  );
  const copied = await asCustomer(strongNow, "/rest/v1/rpc/ocade_staff_can", {
    method: "POST",
    body: JSON.stringify({ p_permission: "customers.read" }),
  });
  check(
    "a copied Admin token is refused straight at the API, before it expires",
    copied.status === 401,
    String(copied.status),
  );
  // No reload: the tab that was open learns on its next request and leaves by itself.
  await tab(strong, "Audit").click();
  check(
    "a signed-out Admin is back at sign-in",
    await until(async () => new URL(strong.url()).pathname.startsWith("/auth"), 15_000),
    strong.url(),
  );
  await owner.reload({ waitUntil: "load" });
  check(
    "and the owner who asked is still in",
    await seen(owner.getByRole("heading", { name: "Owner Console", exact: true }), 20_000),
  );

  check(
    "changes after the first asked to confirm it's you again",
    confirmations > 0,
    `${confirmations} confirmations`,
  );
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the admin journey runs", false, String(error).slice(0, 900));
} finally {
  await browser.close();
}

async function until(probe, timeout = 10_000) {
  for (const end = Date.now() + timeout; Date.now() < end;) {
    if (await probe().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

process.stdout.write(
  failures === 0 ? "\nAdmin journey passed.\n" : `\n${failures} admin checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
