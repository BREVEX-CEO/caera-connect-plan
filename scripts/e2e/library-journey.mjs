/**
 * Library, proved in a real browser.
 *
 * `PLAN.md` Phase 8: one All | Images | Files surface with search, holding what
 * a person uploaded and what OCADE produced, with preview, download, delete and
 * delete-all, and no technical provenance in the ordinary interface.
 *
 * WHAT IS PROVEN ELSEWHERE. That one account cannot read, rename or delete
 * another's rows, that deleting tombstones the object so the bytes are chased,
 * and that an account deletion takes the library with it — all of that is
 * row-level security, and it is proven against real PostgreSQL under
 * `SET ROLE authenticated` in `library-schema.test.ts`. A browser signed in as
 * one account cannot demonstrate the absence of another's data.
 *
 * Usage: node scripts/e2e/library-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const EMAIL = `library-${Date.now()}@ocade.test`;

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((response) => response.json());

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
  /*
   * Every request the browser makes, so the signed link can be judged by what
   * was actually fetched. The opened tab itself is no use for this: the object
   * comes back as a download, so the popup never navigates and reports
   * about:blank forever.
   */
  const requested = [];
  context.on("request", (request) => requested.push(request.url()));

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  /* --- an empty library says so, without inventing anything --------------- */

  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  check("Library opens", (await page.getByRole("heading", { name: "Library" }).count()) === 1);
  check(
    "an empty library says what will appear here",
    (await page.getByText("Nothing here yet").count()) === 1,
  );
  check(
    "it offers All, Images and Files and nothing else",
    (await page.getByRole("tab").allInnerTexts()).join("|") === "All|Images|Files",
  );

  /* --- adding something --------------------------------------------------- */

  await page.setInputFiles('input[aria-label="Add a file to your library"]', {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A file the person kept."),
  });
  await page.waitForSelector("text=notes.txt", { timeout: 15_000 });
  check("a file the person adds appears in their library", true);
  check(
    "and its size is shown in units a person reads",
    /\d+\s?(B|KB|MB)/.test(await page.locator("li", { hasText: "notes.txt" }).innerText()),
  );

  /* --- it survives a reload, because it is on the account ------------------ */

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=notes.txt", { timeout: 15_000 });
  check("it is still there after a reload — it is the account's, not the tab's", true);

  /* --- the filters and the search box ------------------------------------- */

  await page.getByRole("tab", { name: "Images" }).click();
  check("filtering to Images hides a text file", (await page.getByText("notes.txt").count()) === 0);
  await page.getByRole("tab", { name: "Files" }).click();
  check("filtering to Files shows it again", (await page.getByText("notes.txt").count()) === 1);
  await page.getByRole("tab", { name: "All" }).click();

  await page.fill('input[placeholder="Search"]', "nothing like this");
  check("a search with no matches says so", (await page.getByText("No matches").count()) === 1);
  await page.fill('input[placeholder="Search"]', "notes");
  check("and a search that matches finds it", (await page.getByText("notes.txt").count()) === 1);
  await page.fill('input[placeholder="Search"]', "");

  /* --- opening it hands over a signed link, not a public one --------------- */

  await page.getByRole("button", { name: "Download notes.txt" }).click();
  await page.waitForTimeout(2500);
  /*
   * The MINTING happens server-side — the server function holds the caller's
   * session and asks Supabase — so the browser only ever sees the result. What
   * it sees is the thing that matters: a token-bearing URL rather than a
   * permanent public address for a private object.
   */
  const fetched = requested.filter((url) => url.includes("/storage/v1/object/"));
  check(
    "the link it opens carries a token rather than being a public address",
    fetched.some((url) => /\/object\/library\/.+token=/.test(url)),
    fetched.join(" "),
  );

  /* --- what the ordinary interface does NOT show --------------------------- */

  const body = await page.locator("body").innerText();
  check(
    "no storage path, bucket, digest or provenance is on screen",
    !/library\/|bucket|sha256|lineage|provenance|storage_path/i.test(body),
  );

  /* --- deleting one ------------------------------------------------------- */

  await page.getByRole("button", { name: "Delete notes.txt" }).click();
  await page.waitForSelector("text=Nothing here yet", { timeout: 15_000 });
  check("deleting an item removes it", true);

  /* --- and emptying it from Data Controls ---------------------------------- */

  await page.setInputFiles('input[aria-label="Add a file to your library"]', [
    { name: "one.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
  ]);
  await page.waitForSelector("text=one.txt", { timeout: 15_000 });

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Privacy & Security" }).click();
  await page.waitForSelector("text=1 item", { timeout: 15_000 });
  check("Data Controls says how much is in the library", true);

  await page.getByRole("button", { name: "Delete everything" }).click();
  check(
    "and asks before it deletes something that cannot come back",
    (await page.getByRole("button", { name: "Keep" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Nothing is in your Library"),
    undefined,
    { timeout: 15_000 },
  );
  check("emptying the library from Data Controls works", true);

  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  check(
    "and the library really is empty afterwards",
    (await page.getByText("Nothing here yet").count()) === 1,
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
