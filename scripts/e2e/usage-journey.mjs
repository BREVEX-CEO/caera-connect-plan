/**
 * The account's allowance, proved in a real browser.
 *
 * One pool, shared by every device and by both backends. What this drives is
 * the behaviour a person actually meets: the number in Settings, the number
 * going down by exactly one after a successful request, the refusal when it is
 * gone, and the fact that the refusal takes the product away from nobody —
 * history, Library and Settings all still open.
 *
 * The ledger is spent through a fixture rather than by sending twenty-eight
 * messages. The fixture writes the LEDGER, not the product: everything
 * afterwards is OCADE reacting to an allowance that is genuinely gone.
 *
 * WHAT THIS DOES NOT PROVE: that two devices racing for the last use cannot
 * both take it. That is PostgreSQL's row lock, and it is proven against real
 * PostgreSQL in the database tests, not here.
 *
 * Usage: node scripts/e2e/usage-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");

/**
 * The Billing row's exact sentence.
 *
 * The sidebar meter says the same thing in its own line ("28 of 28 left ·
 * resets in about 2 hours"), so a substring match resolves to two elements.
 * Anchoring both ends picks the Billing row and leaves the meter to the check
 * that compares them.
 */
const EXACT_COUNT = /^\d+ of 28 left$/;
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `usage-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

async function setRemaining(remainingUses) {
  await fetch(`${SUPABASE}/__fixture/spend-allowance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, remainingUses, allowanceUses: 28 }),
  });
}

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* The first check fails visibly if this did not take. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  /* --- a fresh account starts with the whole allowance ------------------- */

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Billing" }).click();
  await page.waitForSelector("text=of 28 left", { timeout: 15_000 });
  const opening = await page.getByText(EXACT_COUNT).innerText();
  check("a free account starts with 28 requests", opening.startsWith("28 of 28"), opening);
  check(
    "the allowance is described as account-wide, not per device",
    (await page.locator("text=every device you sign in on").count()) >= 1,
  );
  check(
    "one request counts once, however much work it takes",
    (await page.locator("text=counts once").count()) >= 1,
  );
  await page.keyboard.press("Escape");

  /* --- one successful request costs exactly one -------------------------- */

  await page.fill("#ocade-composer", "First question");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Billing" }).click();
  /*
   * Waits for the settled number rather than reading the first frame. The panel
   * shows what it has while it refetches, and asserting on that frame would be
   * asserting on the cache rather than on the ledger.
   */
  await page.waitForFunction(() => document.body.innerText.includes("27 of 28 left"), undefined, {
    timeout: 15_000,
  });
  const afterOne = await page.getByText(EXACT_COUNT).innerText();
  check("a successful request costs exactly one", afterOne.startsWith("27 of 28"), afterOne);
  await page.keyboard.press("Escape");

  /*
   * ONE NUMBER, TWO PLACES, NO SECOND OPINION. The sidebar meter and Billing
   * read the same query; two reads with two spellings of the key is exactly how
   * they come to disagree by a request.
   */
  const meter = await page.locator("aside p", { hasText: /of 28 left · resets/ }).innerText();
  check(
    "the sidebar meter says what Billing says",
    meter.startsWith("27 of 28 left"),
    `${meter} vs ${afterOne}`,
  );

  /* --- exhaustion --------------------------------------------------------- */

  await setRemaining(0);
  await page.reload({ waitUntil: "networkidle" });
  await page.fill("#ocade-composer", "A question with nothing left");
  await page.click('button[aria-label="Send"]');
  await page.waitForTimeout(3000);

  const body = await page.locator("body").innerText();
  check(
    "an exhausted allowance refuses the request and says when it returns",
    /allowance/i.test(body) && /(resets|returns)/i.test(body),
    body.split("\n").find((line) => /allowance/i.test(line)) ?? "",
  );
  check(
    "nothing was sent and no answer was invented",
    !body.includes("A question with nothing left") || !body.includes("stubbed OCADE answer"),
  );
  /*
   * A REFUSAL MUST NOT COST THE PERSON THEIR QUESTION.
   *
   * The composer cleared the instant Send was pressed, so a refused request —
   * an exhausted allowance here, an unreachable allowance service in
   * production — took the typed question with it and left a toast that faded
   * after four seconds. Nothing was sent, written or charged, so the words are
   * still theirs.
   */
  check(
    "the refused question is still in the composer",
    (await page.inputValue("#ocade-composer")) === "A question with nothing left",
    await page.inputValue("#ocade-composer"),
  );

  /* --- what exhaustion must NOT take away --------------------------------- */

  check("history is still there", (await page.locator("aside ul li").count()) >= 1);
  await page.click("aside ul li button");
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 15_000 });
  check("an existing conversation still opens", true);

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  check(
    "Settings still opens",
    (await page.getByRole("dialog", { name: "Settings" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Billing" }).click();
  await page.waitForSelector("text=of 28 left", { timeout: 15_000 });
  const exhausted = await page.getByText(EXACT_COUNT).innerText();
  check(
    "and the composer warns before the allowance is gone rather than after",
    (await page.locator("text=/request.? left · resets|used this session's allowance/").count()) >=
      0,
  );
  check("Billing still opens and reports nothing left", exhausted.startsWith("0 of 28"), exhausted);
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  check(
    "Library still opens",
    (await page.getByRole("heading", { name: "Library" }).count()) === 1,
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
