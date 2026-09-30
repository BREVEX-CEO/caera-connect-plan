/**
 * The Owner Console and the Staff Console, proved in a real browser.
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
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

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
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));
  return page;
}
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

async function consoleOf(page, heading) {
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  return seen(page.getByRole("heading", { name: heading, exact: true }), 20_000);
}
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
  await person.goto(`${BASE}/admin`, { waitUntil: "load" });
  await person.waitForTimeout(2500);
  check(
    "a customer opening /admin is returned to Chat, told nothing",
    new URL(person.url()).pathname === "/" &&
      (await person.getByRole("heading", { name: /Console/ }).count()) === 0,
  );
  await person.getByRole("button", { name: new RegExp(customerEmail) }).click();
  await person.getByRole("menuitem", { name: "Settings" }).waitFor();
  await person.waitForTimeout(1500);
  check(
    "a customer's account menu names no console",
    (await person.getByRole("menuitem", { name: /Console/ }).count()) === 0,
  );
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
      (await seen(strongRow.getByText(/^Usage:/))),
  );
  check(
    "an Admin cannot open a case (owners do)",
    (await strongRow.getByRole("button", { name: "Open a case" }).count()) === 0 &&
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
        { tool: "start_task", args: { title: "Tidy files", where: "computer", steps: ["Tidy"] } },
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
  const owner = await open(await signIn(ownerEmail));
  check("the owner gets the Owner Console", await consoleOf(owner, "Owner Console"));
  await tab(owner, "Staff").waitFor({ timeout: 10_000 });
  check(
    "with every module",
    (await tabs(owner).allInnerTexts()).join(",") === "Customers,Cases,Staff,System,Audit",
    (await tabs(owner).allInnerTexts()).join(","),
  );
  await owner.getByRole("button", { name: new RegExp(ownerEmail.replace("+", "\\+")) }).click();
  check(
    "and the owner's account menu offers it",
    await seen(owner.getByRole("menuitem", { name: "Owner Console" })),
  );
  await owner.keyboard.press("Escape");

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
  await tab(support, "Customers").click();
  // Its own re-check may already have sent it back to Chat; either way nothing is served.
  check(
    "and the removed person's open console stops working at once",
    await until(
      async () =>
        new URL(support.url()).pathname === "/" ||
        (await support.getByText("Accounts could not be read.").count()) > 0,
      30_000,
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
  const openCase = ownerRow.getByRole("button", { name: "Open a case" });
  check("opening a case waits for a reason", await openCase.isDisabled());
  await ownerRow.getByPlaceholder(/^Why \(/).fill("Customer reported export failure");
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
  await cases.getByRole("button", { name: `Export trouble ${stamp}` }).click();
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
  const copied = await asCustomer(strongSession, "/rest/v1/rpc/ocade_staff_can", {
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
