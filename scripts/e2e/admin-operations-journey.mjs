/**
 * THE OPERATIONS CONSOLE, AND THE DOOR IN FRONT OF IT — PLAN.md §G.
 *
 * §G ends with "Ordinary users receive neither the route content nor the
 * underlying data", and that is two claims, not one. The database half is
 * proven against real PostgreSQL in `admin-operations-schema.test.ts`, where
 * every request runs under `SET ROLE authenticated` and row-level security
 * actually applies. This is the other half, and it is the half that cannot be
 * checked by reading source: whether an ordinary account is sent away, whether
 * an operator's screen renders at all, and whether what it renders is real.
 *
 * THE ORDINARY ACCOUNT GOES FIRST, deliberately. Running it after the grant
 * would mean the refusal was never observed on an account that could not have
 * been refused for some other reason.
 *
 * WHAT IS REAL: the route, the gate, the three reads, the canonical table, the
 * counts, the attention notice.
 * WHAT IS MODELLED: Supabase, in `stub-supabase.mjs`, including the admin read
 * policies — because a screen driven against a 404 would report an empty
 * deployment as a healthy one.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;
const STUB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const EMAIL = process.env.OCADE_AUDIT_EMAIL ?? "audit@ocade.test";

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
  console.log("\nSTEP 1 — an ordinary account is sent away, and told which door it is at");
  await page.goto(`${BASE}/admin/operations`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);

  if (new URL(page.url()).pathname === "/admin/operations") {
    fail("an account with no admin role reached the operations console");
  } else if (!/access-denied/.test(page.url())) {
    fail(`an ordinary account was sent somewhere unexpected: ${page.url()}`);
  } else {
    note("an ordinary account is sent to the access-denied screen");
    const reason = await page.getByText(/requires the admin role/i).count();
    if (reason === 0) fail("the refusal does not say what is missing");
    else note("and is told which role it needs, rather than being shown a blank page");
  }

  /*
   * SOMETHING FOR THE AUDIT LOG TO HOLD.
   *
   * Done BEFORE the role is granted, so the event is written by an ordinary
   * account and read afterwards by an operator — the read the panel exists for.
   * Without it the log is legitimately empty and STEP 4 would assert nothing,
   * which is the shape a check takes when it has quietly stopped working.
   */
  console.log("\nSTEP 2 — an ordinary account does something an operator will read about");
  await page.goto(`${BASE}/organization`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);
  const nameField = page.locator("#organization-name");
  if ((await nameField.count()) === 0) {
    fail("the organization screen offers no way to create one");
  } else {
    await nameField.fill("Ridgeline Operations");
    await settle(400);
    await page.getByRole("button", { name: /create organization/i }).click({ timeout: 15000 });
    await settle(3000);
    note("an organization was created, so the audit log has something in it");
  }

  console.log("\nSTEP 3 — with the role, the console renders and its reads succeed");
  const granted = await fetch(`${STUB}/__fixture/grant-admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!granted.ok) fail(`the audit account could not be made an administrator: ${granted.status}`);

  await page.goto(`${BASE}/admin/operations`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4000);

  if (new URL(page.url()).pathname !== "/admin/operations") {
    fail(`an administrator was still sent away: ${page.url()}`);
  } else {
    note("an administrator reaches the console");
  }

  for (const heading of [
    /commercial usage windows/i,
    /organization audit log/i,
    /notification delivery, last seven days/i,
  ]) {
    if ((await page.getByRole("heading", { name: heading }).count()) === 0) {
      fail(`the console is missing the panel matching ${heading}`);
    }
  }
  if (problems.length === 0) note("all three panels rendered");

  /*
   * NOT MERELY PRESENT — SETTLED. A table stuck on its loading state looks
   * identical to source inspection and is a screen nobody can use, and it is
   * the shape a read that quietly failed takes.
   */
  await settle(2500);
  const stillLoading = await page.getByText(/^Loading/i).count();
  if (stillLoading > 0) fail(`${stillLoading} panel(s) never finished loading`);
  else note("every panel settled rather than sitting on a spinner");

  console.log("\nSTEP 4 — the delivery panel says what it will not show, and counts honestly");
  const promise = page.getByText(/Counts only\./i);
  if ((await promise.count()) === 0) {
    fail("the delivery panel does not say it shows counts rather than messages");
  } else {
    note("the delivery panel says titles and bodies are not readable by any admin role");
  }

  const bodies = await page.getByText(/From a new device/i).count();
  if (bodies > 0) fail("a notification body reached the operations console");
  else note("no notification content is on the page");

  console.log("\nSTEP 5 — the audit log carries what happened to organizations");
  const auditRows = await page.getByText(/organization\.created/).count();
  if (auditRows === 0) {
    fail("the operator cannot see the organization that was just created");
  } else {
    note("the operator sees the event the ordinary account caused");
  }
  const named = await page.getByText(/Ridgeline Operations/).count();
  if (named === 0) {
    // A log of opaque identifiers is not a log anybody can read, which is why
    // the organizations are read alongside the events.
    fail("the audit log shows identifiers rather than the organization's name");
  } else {
    note("and the organization is named rather than shown as an identifier");
  }
  /* ------------------------------------------ publishing to the status page -- */
  /*
   * PLAN.md §K's administrator incident controls, and §G's status management.
   *
   * The point of a status page is that OUTSIDERS can rely on it, so the last
   * check is made by a browser with no session at all: an incident published
   * here has to be readable by somebody who is not signed in, and by the public
   * JSON feed a monitor polls. A screen that published to a table only its
   * author could read would pass every check but the one that matters.
   */
  console.log("\nSTEP 6 — an administrator publishes an incident");
  await page.goto(`${BASE}/admin/status`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);

  const headline = page.locator("#incident-title");
  if ((await headline.count()) === 0) {
    fail("the status admin screen offers no way to publish an incident");
  } else {
    await headline.fill("Sign-in is slow");
    await page.locator("#incident-body").fill("We are looking into slow sign-ins.");
    await page.locator("#incident-component-account-authentication").check();
    await settle(400);
    await page.getByRole("button", { name: /^publish$/i }).click({ timeout: 15000 });
    await settle(3500);

    if ((await page.getByText(/Signed-out visitors can read it now/i).count()) === 0) {
      fail("publishing an incident did not report success");
    } else {
      note("an incident was published");
    }

    const live = page.getByRole("heading", { name: /affecting ocade now/i });
    if ((await live.count()) === 0) {
      fail("the published incident does not appear as affecting OCADE now");
    } else {
      note("and appears in the live list on the admin screen");
    }
  }

  console.log("\nSTEP 7 — an update moves it, and resolving it closes it");
  const updateBody = page.locator("input[id^='update-body-']").first();
  if ((await updateBody.count()) === 0) {
    fail("a live incident offers no way to post an update");
  } else {
    await updateBody.fill("A slow query on the sessions table.");
    await page.locator("select[id^='update-state-']").first().selectOption("identified");
    await page
      .getByRole("button", { name: /post update/i })
      .first()
      .click({ timeout: 15000 });
    await settle(3000);
    if ((await page.getByText(/Update published\./i).count()) === 0) {
      fail("posting an update did not report success");
    } else {
      note("an update was published and the incident moved to Identified");
    }
  }

  console.log("\nSTEP 8 — a signed-out visitor reads it, and so does the machine feed");
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`${BASE}/status`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await visitor.waitForTimeout(4000);

  if ((await visitor.getByText(/Sign-in is slow/).count()) === 0) {
    fail("a signed-out visitor cannot see the published incident");
  } else {
    note("a signed-out visitor sees the incident on /status");
  }
  if ((await visitor.getByText(/A slow query on the sessions table\./).count()) === 0) {
    fail("the visitor sees the incident but not what was said about it");
  } else {
    note("and reads the update that was posted");
  }
  if ((await visitor.getByText(/does not publish an incident history yet/i).count()) > 0) {
    fail("the page still says OCADE publishes no incident history");
  } else {
    note("the page no longer claims it publishes nothing");
  }

  const feed = await visitor.evaluate(async () => {
    const response = await fetch("/api/public/status");
    return response.json();
  });
  if (!Array.isArray(feed.incidents) || feed.incidents.length === 0) {
    fail("the public JSON feed carries no incident");
  } else if (feed.incidents[0].title !== "Sign-in is slow") {
    fail(`the feed's incident is not the one published: ${feed.incidents[0].title}`);
  } else {
    note("the public JSON feed carries the incident too");
  }
  if (typeof feed.incidentsNote !== "string" || feed.incidentsNote.length === 0) {
    fail("the feed dropped the sentence that says what an empty list means");
  }

  /* -------------------------------------------- editing the Help Center -- */
  /*
   * PLAN.md §L's publishing workflow and §G's help-content management.
   *
   * Three things a source read cannot establish: that a published edit reaches
   * a signed-out reader, that it reaches SEARCH as well as its own page, and
   * that a draft reaches neither. The last is the one worth a browser: a screen
   * that merely declines to link to a draft would pass a source review and
   * still leak half-written guidance into the search box.
   */
  console.log("\nSTEP 9 — an editor changes an answer, and a visitor reads the new one");
  await page.goto(`${BASE}/admin/help`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3500);

  const picker = page.locator("#help-article");
  if ((await picker.count()) === 0) {
    fail("the help-content screen offers no article to edit");
  } else {
    await picker.selectOption("what-is-ocade");
    await settle(800);
    const bodyField = page.locator("#help-body");
    if ((await bodyField.count()) === 0) {
      fail("choosing an article does not open it for editing");
    } else {
      await bodyField.fill("OCADE is a hedgehog-friendly assistant.");
      await page.locator("#help-keywords").fill("hedgehog");
      await page.getByRole("button", { name: /^publish$/i }).click({ timeout: 15000 });
      await settle(3000);
      if ((await page.getByText(/Anybody can read it now/i).count()) === 0) {
        fail("publishing an edited article did not report success");
      } else {
        note("an article was edited and published");
      }
    }
  }

  const helpVisitorContext = await browser.newContext();
  const helpVisitor = await helpVisitorContext.newPage();
  await helpVisitor.goto(`${BASE}/support/what-is-ocade`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await helpVisitor.waitForTimeout(4000);
  if ((await helpVisitor.getByText(/hedgehog-friendly assistant/i).count()) === 0) {
    fail("a signed-out visitor still reads the shipped answer after it was edited");
  } else {
    note("a signed-out visitor reads the edited answer");
  }

  await helpVisitor.goto(`${BASE}/support`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await helpVisitor.waitForTimeout(3000);
  await helpVisitor.getByRole("searchbox").first().fill("hedgehog");
  await helpVisitor.waitForTimeout(1500);
  // Asserted on the count the page states, not on prose: "1 article matches"
  // is the page's own answer to the search, and it is unambiguous where a
  // title fragment could be matched by a category listing behind the results.
  const searchAnswer = await helpVisitor
    .getByText(/article(s)? match|No article matches that yet/i)
    .first()
    .textContent();
  if (!searchAnswer || /No article matches/i.test(searchAnswer)) {
    fail(`the edited answer is on its own page but not findable by search: ${searchAnswer}`);
  } else {
    note(`and finds it by a word that exists only in the new text — ${searchAnswer.trim()}`);
  }

  console.log("\nSTEP 10 — a draft reaches nobody");
  await page.goto(`${BASE}/admin/help`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(3000);
  await page.locator("#help-article").selectOption("what-is-ocade");
  await settle(800);
  await page.getByRole("button", { name: /save as draft/i }).click({ timeout: 15000 });
  await settle(3000);
  if ((await page.getByText(/Nobody outside the admin role can read it/i).count()) === 0) {
    fail("returning an article to a draft did not report success");
  } else {
    note("the article was returned to a draft");
  }

  await helpVisitor.goto(`${BASE}/support`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await helpVisitor.waitForTimeout(4000);
  await helpVisitor.getByRole("searchbox").first().fill("hedgehog");
  await helpVisitor.waitForTimeout(1500);
  const draftAnswer = await helpVisitor
    .getByText(/article(s)? match|No article matches that yet/i)
    .first()
    .textContent();
  if (!draftAnswer || !/No article matches/i.test(draftAnswer)) {
    fail(`a draft is still findable by a signed-out visitor's search: ${draftAnswer}`);
  } else {
    note("a signed-out visitor cannot find the draft");
  }

  await helpVisitor.goto(`${BASE}/support/what-is-ocade`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await helpVisitor.waitForTimeout(4000);
  if ((await helpVisitor.getByText(/hedgehog-friendly assistant/i).count()) > 0) {
    fail("a draft is still readable at its own URL");
  } else {
    note("and cannot read it at its own URL either");
  }

  await helpVisitorContext.close();
  await visitorContext.close();
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
if (consoleErrors.length + failedRequests.length === accounted) {
  note("nothing unexplained in the console or on the network");
}

await browser.close();
console.log(
  `\n${problems.length === 0 ? "ADMIN OPERATIONS JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
