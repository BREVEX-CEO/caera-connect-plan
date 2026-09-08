/**
 * TEAM MANAGEMENT, IN A REAL BROWSER, WITH TWO PEOPLE — PLAN.md §F.
 *
 * The schema suite proves the AUTHORIZATION: it issues the forged requests §F
 * names against real PostgreSQL under `SET ROLE authenticated` and watches them
 * be refused. What it cannot answer is whether anybody can use this: whether
 * the invitation link is shown once and can be copied, whether a refusal
 * reaches the page in words a person can act on, whether last-owner protection
 * disables a control rather than only failing after it is pressed, and whether
 * an invited person in a DIFFERENT browser actually ends up inside the
 * organization. Every one of those passes source inspection and fails on the
 * screen; §F says "UI visibility is not authorization", and this is the other
 * half of that sentence — the visibility has to work too.
 *
 * TWO CONTEXTS, TWO ACCOUNTS. The owner invites; a second browser, signed in as
 * somebody else, follows the link. A journey that accepted its own invitation
 * would prove the round trip and nothing about the boundary between people.
 *
 * WHAT IS REAL: OCADE's own code — the route, the authority module, the token
 * generation and hashing, the refusal rendering, the disabled states.
 * WHAT IS MODELLED: the organization functions, in `stub-supabase.mjs`, which
 * mirror the migration's refusals verbatim so the page renders the sentence a
 * person will actually see.
 */
import { chromium } from "playwright-core";
import { completeOnboarding } from "./onboarding.mjs";
import { clearModals, signInWithPassword } from "./sign-in.mjs";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const COLLEAGUE_EMAIL = "colleague@ocade.test";
const PASSWORD = process.env.OCADE_AUDIT_PASSWORD ?? "AuditPassword123!";
// The fixture Supabase, for the one control a browser cannot exercise on its
// own: ageing a session's proof of identity past the recency window.
const STUB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

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

const consoleErrors = [];
const failedRequests = [];

/**
 * Noise this journey deliberately causes, or that the sandbox cannot avoid.
 *
 * Named one at a time with the reason. A blanket filter is how a real defect
 * gets absorbed by an audit that still reports a pass.
 */
const EXPECTED = [
  {
    pattern: /localhost:11434|ERR_CONNECTION_REFUSED/,
    why: "the local-engine probe, with no Ollama in this sandbox",
  },
  {
    // STEP 6 deliberately asks the server to demote the last owner, and STEP 8
    // deliberately mistypes the confirmation. Both are refusals the product
    // must show, and the browser logs the 400 that carries them.
    pattern: /400 \(Bad Request\)/,
    why: "the two deliberate refusals this journey asks for",
  },
  {
    // STEP 9 deliberately ages the session's proof of identity past the recency
    // window and then asks to delete the organization. The refusal is the point
    // of that step, and PostgREST answers it 403 so the screen can tell it apart
    // from a rule about the organization itself.
    pattern: /403 \(Forbidden\)/,
    why: "the stale-session refusal STEP 9 asks for",
  },
];

function expected(line) {
  return EXPECTED.find((entry) => entry.pattern.test(line));
}

function watch(page) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (/ERR_ABORTED|net::ERR_ABORTED/.test(failure)) return;
    failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
  });
}

const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();
watch(page);

const settle = (target, ms = 1500) => target.waitForTimeout(ms);

try {
  /* ------------------------------------------------------------- create -- */
  console.log("\nSTEP 1 — the Organization route exists and offers to create one");
  await page.goto(`${BASE}/organization`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 3000);

  if (new URL(page.url()).pathname !== "/organization") {
    fail(`/organization redirected to ${new URL(page.url()).pathname}`);
  }
  const createHeading = page.getByRole("heading", { name: /new organization/i });
  if ((await createHeading.count()) === 0) {
    fail("no way to create an organization is offered");
  } else {
    note("the create form is present for an account with no organization");
  }

  console.log("\nSTEP 2 — creating one makes the creator its owner");
  await page
    .getByLabel(/^name$/i)
    .first()
    .fill("Northwind Traders");
  await settle(page, 400);
  const handle = await page
    .getByLabel(/handle/i)
    .first()
    .inputValue();
  if (handle !== "northwind-traders") {
    fail(`the handle was not suggested from the name (got "${handle}")`);
  } else {
    note("the handle followed the name, and stays editable");
  }
  await page.getByRole("button", { name: /create organization/i }).click({ timeout: 15000 });
  await settle(page, 3000);

  const ownerBadge = page.getByText(/you are the owner/i);
  if ((await ownerBadge.count()) === 0) {
    fail("after creating an organization the creator is not shown as its owner");
  } else {
    note("the creator is the owner, and the page says so");
  }

  /* ------------------------------------------------------------- invite -- */
  console.log("\nSTEP 3 — inviting somebody produces a one-time link");
  await page.getByLabel(/email address/i).fill(COLLEAGUE_EMAIL);
  await page.getByRole("button", { name: /^invite$/i }).click({ timeout: 15000 });
  await settle(page, 2500);

  const linkCode = page.locator("code").filter({ hasText: /\/invite\?token=/ });
  if ((await linkCode.count()) === 0) {
    fail("no invitation link was shown after inviting somebody");
  }
  const inviteLink = ((await linkCode.first().textContent()) ?? "").trim();
  if (!/\/invite\?token=[A-Za-z0-9_-]{20,}/.test(inviteLink)) {
    fail(`the invitation link does not carry a real token: ${inviteLink.slice(0, 80)}`);
  } else {
    note(`invitation link issued (${inviteLink.length} characters)`);
  }

  /*
   * THE TOKEN MUST NOT BE ANYWHERE THE SERVER CAN SEE IT. The whole point of
   * hashing in the browser is that the plaintext exists only in the link, so a
   * journey that did not check this would let a future change quietly send it.
   */
  const token = new URL(inviteLink).searchParams.get("token") ?? "";
  const leaked = await page.evaluate(
    (secret) => JSON.stringify(window.localStorage).includes(secret),
    token,
  );
  if (leaked) fail("the invitation token was written to browser storage");
  else note("the token is in the link and nowhere else on this page");

  const pending = page.getByText(COLLEAGUE_EMAIL, { exact: false });
  if ((await pending.count()) === 0) fail("the invitation does not appear in the pending list");
  else note("the invitation is listed as pending");

  console.log("\nSTEP 4 — inviting the same address again is refused, with the reason");
  await page.getByLabel(/email address/i).fill(COLLEAGUE_EMAIL);
  await page.getByRole("button", { name: /^invite$/i }).click({ timeout: 15000 });
  await settle(page, 2500);
  const duplicate = page.getByText(/already has an open invitation/i);
  if ((await duplicate.count()) === 0) {
    fail("a duplicate invitation was not refused in words the page shows");
  } else {
    note("the duplicate is refused, and the page says to resend instead");
  }

  /* ------------------------------------------------------------- accept -- */
  console.log("\nSTEP 5 — a DIFFERENT person, in a different browser, follows the link");
  const colleagueContext = await browser.newContext();
  const colleague = await colleagueContext.newPage();
  watch(colleague);

  await colleague.goto(inviteLink, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(colleague, 2500);

  const signInPrompt = colleague.getByRole("link", { name: /sign in to continue/i });
  if ((await signInPrompt.count()) === 0) {
    fail("a signed-out visitor with an invitation is not offered a way in");
  } else {
    note("a signed-out visitor is asked to sign in, keeping the invitation");
    await signInPrompt.click({ timeout: 15000 });
    await settle(colleague, 2500);
    await signInWithPassword(colleague, { email: COLLEAGUE_EMAIL, password: PASSWORD });
  }

  // Onboarding stands between sign-in and the invitation for a new account.
  await clearModals(colleague);
  await completeOnboarding(colleague, { email: COLLEAGUE_EMAIL, log: note });
  await clearModals(colleague);

  await colleague.goto(inviteLink, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(colleague, 4000);

  /*
   * ADMITTED, WHETHER OR NOT THE CONFIRMATION IS STILL ON SCREEN.
   *
   * The invite page confirms and then moves on to the organization by design —
   * a screen that said "you are in" and stayed there would leave the person
   * where there is nothing to do. So the proof is either confirmation, and it
   * counts as passing to have landed where it sends you.
   */
  const confirmed = await colleague.getByText(/you are in/i).count();
  const landed = new URL(colleague.url()).pathname;
  if (confirmed === 0 && landed !== "/organization") {
    const shown = (await colleague.locator("body").innerText()).slice(0, 200).replace(/\s+/g, " ");
    fail(`accepting the invitation did not admit the colleague — at ${landed}: ${shown}`);
  } else {
    note(
      confirmed > 0
        ? "the colleague accepted and was admitted"
        : "the colleague accepted and was carried straight to the organization",
    );
  }

  await colleague.goto(`${BASE}/organization`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(colleague, 3000);
  const colleagueSeesTeam = await colleague.getByText(/Northwind Traders/).count();
  if (colleagueSeesTeam === 0) fail("the colleague cannot see the organization they joined");
  else note("the colleague sees the organization they joined");

  /*
   * AND SEES IT AS A MEMBER, NOT AS AN ADMINISTRATOR. The invitation list is
   * who somebody thought of hiring; an ordinary member must not have it.
   */
  const memberSeesInvites = await colleague.getByRole("heading", { name: /invitations/i }).count();
  if (memberSeesInvites > 0) fail("an ordinary member is shown the invitation list");
  else note("an ordinary member is not shown invitations, groups or the danger zone");

  /* -------------------------------------------------- roles and refusal -- */
  console.log("\nSTEP 6 — the owner cannot demote themselves while they are the only owner");
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page, 3500);

  const roleSelects = page.locator("select[id^='role-']");
  const roleCount = await roleSelects.count();
  if (roleCount === 0) {
    fail("no role control is offered for the members of this organization");
  } else {
    note(`${roleCount} member role control(s) rendered`);
  }

  /*
   * THE OTHER PERSON'S ROW, FOUND BY WHO IT IS NOT.
   *
   * A member is shown by their profile name when they have one, so looking for
   * the invited address finds nothing once onboarding has given them a name —
   * which is the ordinary case, not an edge one. The row marked "(you)" is the
   * owner's; the other one is the colleague's.
   */
  const colleagueRow = page
    .locator("li")
    .filter({ has: page.locator("select[id^='role-']") })
    .filter({ hasNotText: "(you)" })
    .last();
  const colleagueRole = colleagueRow.locator("select[id^='role-']");
  if ((await colleagueRole.count()) === 0) {
    fail("the newly joined member has no role control");
  } else {
    await colleagueRole.selectOption("admin");
    await settle(page, 2500);
    const promoted = await page.getByText(/is now an admin/i).count();
    if (promoted === 0) fail("promoting a member to admin did not report success");
    else note("a member was promoted to admin, and the page said so");
  }

  console.log("\nSTEP 7 — last-owner protection is visible before it is enforced");
  const ownerRow = page
    .locator("li")
    .filter({ hasText: /\(you\)/ })
    .first();
  const removeOwner = ownerRow.getByRole("button", { name: /^remove/i });
  if ((await removeOwner.count()) === 0) {
    note("the owner's own row offers no remove control at all");
  } else if (await removeOwner.first().isEnabled()) {
    fail("the last owner can be removed from the screen");
  } else {
    const reason = await removeOwner.first().getAttribute("title");
    if (!reason || !/last owner/i.test(reason)) {
      fail(`the disabled remove control does not say why: ${reason ?? "no title"}`);
    } else {
      note(`removing the last owner is disabled, and says why: "${reason}"`);
    }
  }

  /* ------------------------------------------------- ownership and exit -- */
  console.log("\nSTEP 8 — the last owner is warned BEFORE they try to delete their account");
  /*
   * §O: "Transfer organization ownership before owner deletion." The server
   * refuses, and refuses before it destroys anything — but being told at the end
   * of a typed confirmation that this was never going to work is a bad way to
   * find out, and the thing they must do happens on a different screen. So the
   * warning belongs here, with the way there.
   */
  await page.goto(`${BASE}/settings/account`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 3500);
  const warning = page.getByText(/only owner of/i);
  if ((await warning.count()) === 0) {
    fail("the last owner is not warned that deleting their account will be refused");
  } else {
    const text = ((await warning.first().textContent()) ?? "").replace(/\s+/g, " ");
    if (!/Northwind Traders/.test(text)) {
      fail(`the warning does not name the organization: ${text.slice(0, 160)}`);
    } else {
      note(`the warning names the organization: "${text.slice(0, 120)}"`);
    }
    const wayThere = page.getByRole("link", { name: /open organization/i });
    if ((await wayThere.count()) === 0) {
      fail("the warning tells somebody to hand over a workspace with no way to get there");
    } else {
      note("and offers the route to hand it over");
    }
  }

  await page.goto(`${BASE}/organization`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 3500);

  /* ------------------------------------------------------- what is allowed -- */
  /*
   * PLAN.md §21 and §G: a workspace decides what its members may use, and the
   * decision has to REACH them. Two halves, and the second is the one that
   * cannot be checked by reading source: an administrator ticks a box in one
   * browser, and a different person, signed in as somebody else, sees it.
   */
  console.log("\nSTEP 9 — an organization can withhold a capability, and members are told");
  const policyHeading = page.getByRole("heading", { name: /what this organization allows/i });
  if ((await policyHeading.count()) === 0) {
    fail("an owner is not offered the policy panel");
  } else {
    const machineControl = page.getByLabel("Computer control", { exact: true });
    if ((await machineControl.count()) === 0) {
      fail("the policy panel offers no capability to withhold");
    } else {
      await machineControl.check();
      await settle(page, 300);
      const save = page.getByRole("button", { name: /save what is allowed/i });
      if (!(await save.isEnabled())) fail("ticking a capability did not enable Save");
      await save.click({ timeout: 15000 });
      await settle(page, 3000);

      if (!(await machineControl.isChecked())) {
        fail("the saved policy did not come back from the server");
      } else {
        note("an owner withheld machine control, and the server kept it");
      }

      const trail = await page.getByText(/policy\.changed/).count();
      if (trail === 0) fail("withholding a capability left no audit row");
      else note("the change is in the organization's activity log");
    }
  }

  /* ------------------------------------------- and the member can see it -- */
  /*
   * DEMOTED FIRST, because STEP 6 made this person an admin and an admin is
   * meant to be able to edit the policy. The property worth proving here is the
   * other one: that an ORDINARY member is shown what their workspace withheld,
   * read-only, with the reason — a disabled form and no explanation is how
   * somebody concludes the product is broken.
   */
  const demoteRow = page
    .locator("li")
    .filter({ has: page.locator("select[id^='role-']") })
    .filter({ hasNotText: "(you)" })
    .last();
  await demoteRow.locator("select[id^='role-']").selectOption("member");
  await settle(page, 2500);
  if ((await page.getByText(/is now a member/i).count()) === 0) {
    fail("demoting the admin back to member did not report success");
  } else {
    note("the admin was returned to an ordinary member");
  }

  await colleague.goto(`${BASE}/organization`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await settle(colleague, 3500);

  const memberPolicy = colleague.getByRole("heading", { name: /what this organization allows/i });
  if ((await memberPolicy.count()) === 0) {
    fail("a member cannot see the policy that governs them");
  } else {
    const theirBox = colleague.getByLabel("Computer control", { exact: true });
    if (!(await theirBox.isChecked())) {
      fail("the member's browser does not show what their organization withheld");
    } else if (await theirBox.isEnabled()) {
      fail("a member can edit their own organization's policy");
    } else {
      note("the member sees the withheld capability, and cannot change it");
    }
    if ((await colleague.getByText(/Only an owner or admin can change this/i).count()) === 0) {
      fail("the member is shown a disabled form with no explanation");
    } else {
      note("and is told why the form is not theirs to change");
    }
  }

  /* --------------------------------------------------------- danger zone -- */
  console.log("\nSTEP 10 — deletion needs the name typed, and the server checks it");
  const dangerHeading = page.getByRole("heading", { name: /danger zone/i });
  if ((await dangerHeading.count()) === 0) {
    fail("an owner is not offered organization deletion");
  } else {
    const deleteButton = page.getByRole("button", { name: /delete organization/i });
    if (await deleteButton.isEnabled()) {
      fail("the delete control is live before the name has been typed");
    } else {
      note("delete stays disabled until the name is typed");
    }
    await page.getByLabel(/to confirm/i).fill("northwind traders");
    await settle(page, 400);
    if (await deleteButton.isEnabled()) {
      fail("a near-miss of the name enabled deletion");
    } else {
      note("a near-miss does not enable it — the comparison is exact");
    }
    await page.getByLabel(/to confirm/i).fill("Northwind Traders");
    await settle(page, 400);
    if (!(await deleteButton.isEnabled())) fail("the exact name did not enable deletion");

    /* ------------------------------------------- and it asks who is asking -- */
    /*
     * PLAN.md §B and §G: the highest-risk actions need RECENT proof, not merely
     * an authorized session. A session is what somebody who walked up to an
     * unlocked laptop already has.
     *
     * So the proof is aged past the ten-minute window before the button is
     * pressed. Everything after that is the real path: the server refuses with
     * `reauthentication_required`, the screen turns that into a password field
     * rather than a red sentence, and answering it RETRIES the deletion — the
     * name does not have to be typed again, which is the difference between a
     * security prompt people answer and one they learn to avoid.
     */
    await fetch(`${STUB}/__fixture/age-proof`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seconds: 1200 }),
    });

    await deleteButton.click({ timeout: 15000 });
    await settle(page, 3000);

    const stillHere = await page.getByRole("heading", { name: /danger zone/i }).count();
    if (stillHere === 0) {
      fail("a session whose last proof was twenty minutes old deleted the organization");
    } else {
      note("a stale session is refused, and the organization is still there");
    }

    const proofField = page.getByLabel("Your password", { exact: true });
    if ((await proofField.count()) === 0) {
      fail("the refusal offers no way to prove it is you — it is a dead end");
    } else {
      note("the refusal offers the password field, not an apology");

      const stillTyped = await page.getByLabel(/to confirm/i).inputValue();
      if (stillTyped !== "Northwind Traders") {
        fail(`the typed confirmation was wiped by the refusal — now ${JSON.stringify(stillTyped)}`);
      } else {
        note("the typed confirmation survived the refusal");
      }

      await proofField.fill(PASSWORD);
      await page.getByRole("button", { name: /confirm and continue/i }).click({ timeout: 15000 });
      await settle(page, 4000);
    }

    const gone = await page.getByRole("heading", { name: /new organization/i }).count();
    if (gone === 0) fail("after deletion the page does not return to the empty state");
    else note("proving identity retried the deletion, and the page returned to its empty state");
  }

  /*
   * AND IT IS GONE FOR THE OTHER PERSON TOO. A deletion that only cleared one
   * browser's view would look identical here and be a far worse defect.
   */
  await colleague.reload({ waitUntil: "domcontentloaded" });
  await settle(colleague, 3000);
  if ((await colleague.getByText(/Northwind Traders/).count()) > 0) {
    fail("the deleted organization is still visible to the other member");
  } else {
    note("the deletion reached the other member's browser too");
  }

  await colleagueContext.close();
} catch (error) {
  fail(`the journey threw: ${error instanceof Error ? error.message : String(error)}`);
}

/* ------------------------------------------------------------- report -- */
console.log("\nCONSOLE AND NETWORK");
let accounted = 0;
for (const line of [...consoleErrors, ...failedRequests]) {
  if (expected(line)) {
    accounted += 1;
    continue;
  }
  fail(`unexplained: ${line.slice(0, 220)}`);
}
if (accounted > 0) {
  note(`${accounted} expected message(s): ${EXPECTED.map((e) => e.why).join("; ")}`);
}
if (consoleErrors.length + failedRequests.length === accounted) {
  note("nothing unexplained in the console or on the network");
}

await browser.close();
console.log(
  `\n${problems.length === 0 ? "ORGANIZATION JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
