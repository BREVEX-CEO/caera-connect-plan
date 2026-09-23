/**
 * Chat, signed in, in a real browser.
 *
 * The session is minted against the loopback stub and written into the same
 * storage key the Supabase client reads, because there is no way to complete a
 * provider handshake inside this sandbox. Everything after that is the real
 * product: the composer, the permit, the transcript, persistence, a reload, a
 * rename, a delete, and the refusal when the allowance runs out.
 *
 * WHAT THIS DOES NOT PROVE, and must never be read as proving: that Gemini
 * answers, that row-level security holds, or that the hosted project behaves
 * this way. The first is the provider's, the second is proven against real
 * PostgreSQL in the database tests, and the third needs egress this sandbox
 * does not have.
 *
 * Usage: node scripts/e2e/chat-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

/**
 * The storage key `@supabase/supabase-js` writes its session under.
 *
 * The library derives it from the first label of the host — the project ref on
 * a hosted URL, and `127` against the loopback stub. Deriving it the same way
 * here rather than hard-coding a string keeps this correct if the stub ever
 * moves to a named host.
 */
function storageKey(url) {
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

/*
 * A FRESH ACCOUNT PER RUN, because the stub keeps rows between runs and a
 * proof that inherits the previous run's conversations is not proving what it
 * claims. The address decides the account id, so a unique one is a blank slate.
 */
const EMAIL = `proof-${Date.now()}@ocade.test`;

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
        /* Nothing to recover; the proof will fail visibly at the first check. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "a signed-in visitor sees their account, not a sign-in button",
    (await page.locator('aside button[aria-haspopup="menu"]').count()) === 1,
  );

  // Send, and watch the answer arrive.
  await page.fill("#ocade-composer", "What is OCADE?");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("an answer streams into the transcript", true);
  check(
    "the question is in the transcript too",
    (await page.locator("text=What is OCADE?").count()) >= 1,
  );
  check("the composer is cleared after sending", (await page.inputValue("#ocade-composer")) === "");

  // The conversation is real: it is in the sidebar and survives a reload.
  await page.waitForSelector('nav[aria-label="Primary"]');
  await page.waitForTimeout(500);
  check(
    "the conversation appears in the sidebar",
    (await page.locator("aside ul li").count()) >= 1,
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const recent = page.locator("aside ul li button").first();
  check("the conversation survives a reload", (await recent.count()) === 1);
  await recent.click();
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("opening it reads the transcript back", true);

  // Rename it, and see the new name.
  await page.hover("aside ul li");
  await page.click('aside ul li button[aria-label^="More options"]');
  await page.click('role=menuitem[name="Rename"]');
  await page.fill('input[aria-label="Conversation name"]', "Renamed by the proof");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  check(
    "a conversation can be renamed",
    (await page.locator("aside", { hasText: "Renamed by the proof" }).count()) === 1,
  );

  // Highlight part of an answer, then Ask OCADE quotes it into this composer.
  await page.evaluate(() => {
    const target = [...document.querySelectorAll("[data-transcript] p")].find((node) =>
      node.textContent?.includes("stubbed OCADE answer"),
    );
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new PointerEvent("pointerup"));
  });
  await page.getByRole("button", { name: "Ask OCADE", exact: true }).click();
  check(
    "Ask OCADE quotes the highlighted words into this chat's composer",
    (await page.inputValue("#ocade-composer")).startsWith("> "),
  );
  await page.fill("#ocade-composer", "");

  // Archive hides it from recent chats but keeps it reachable, and it comes back.
  await page.hover("aside ul li");
  await page.click('aside ul li button[aria-label^="More options"]');
  await page.click('role=menuitem[name="Archive"]');
  await page.waitForTimeout(400);
  check(
    "an archived chat is listed under Archived, not lost",
    (await page.locator("aside p", { hasText: "Archived" }).count()) === 1 &&
      (await page.locator("aside", { hasText: "Renamed by the proof" }).count()) === 1,
  );
  await page.hover("aside ul li");
  await page.click('aside ul li button[aria-label^="More options"]');
  await page.click('role=menuitem[name="Unarchive"]');
  await page.waitForTimeout(400);
  check(
    "and Unarchive brings it back",
    (await page.locator("aside p", { hasText: "Archived" }).count()) === 0,
  );

  // Copy is offered on an answer, and on nothing else.
  check("an answer offers Copy", (await page.getByRole("button", { name: "Copy" }).count()) >= 1);

  /* --- the three controls that are one operation -------------------------- */

  const turns = () => page.locator("div.group").filter({ hasText: "stubbed OCADE answer" });

  /*
   * WAIT FOR THE TRANSCRIPT TO SETTLE, DO NOT SAMPLE IT.
   *
   * Regenerate removes the old answer and streams a new one, so for a frame or
   * two both are on screen. Counting immediately after the new text appears
   * reads that frame and fails about one run in ten — a flake in the test, not
   * in the product, and the kind that teaches people to re-run rather than
   * look.
   */
  const settledAnswers = async (expected) => {
    await page
      .waitForFunction(
        (want) =>
          [...document.querySelectorAll("div.group")].filter((node) =>
            node.textContent?.includes("stubbed OCADE answer"),
          ).length === want,
        expected,
        { timeout: 20_000 },
      )
      .catch(() => undefined);
    return turns().count();
  };

  check(
    "an answer offers Regenerate",
    (await page.getByRole("button", { name: "Regenerate" }).count()) >= 1,
  );
  await page.getByRole("button", { name: "Regenerate" }).first().click();
  await page.waitForTimeout(1200);
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check(
    "Regenerate replaces the answer rather than stacking a second one",
    (await settledAnswers(1)) === 1,
    `${await turns().count()} answers`,
  );
  check(
    "and the question is still there, asked once",
    (await page.getByText("What is OCADE?", { exact: true }).count()) === 1,
  );

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.fill('textarea[id^="edit-"]', "What is OCADE, in one line?");
  await page.getByRole("button", { name: "Send edit" }).click();
  /*
   * WAIT FOR THE THING BEING TESTED, NOT FOR TEXT THAT IS ALREADY THERE.
   *
   * This waited for the answer text, which the PREVIOUS answer already
   * satisfied, so it returned immediately and the checks below sampled the
   * transcript before the edit had landed. Whether they passed depended on how
   * many round trips the edit took — and the edit gained one the moment the
   * allowance was asked before anything was deleted. The edited question is
   * what proves the edit happened, so that is what is waited for.
   */
  await page.waitForSelector('text="What is OCADE, in one line?"', { timeout: 20_000 });
  check(
    "editing a question replaces it rather than adding one",
    (await page.getByText("What is OCADE?", { exact: true }).count()) === 0 &&
      (await page.getByText("What is OCADE, in one line?", { exact: true }).count()) === 1,
  );
  check("and the edit is answered", (await settledAnswers(1)) === 1, `${await turns().count()}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("aside ul li button").first().click();
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check(
    "the replaced question does not come back on reload",
    (await page.getByText("What is OCADE?", { exact: true }).count()) === 0,
  );

  /* --- deleting one turn, not the conversation ---------------------------- */

  const before = await page.locator("div.group").count();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await page.waitForTimeout(600);
  check("a single turn can be deleted", (await page.locator("div.group").count()) < before);

  /*
   * A DELETION THAT FAILED MUST NOT LOOK LIKE ONE THAT WORKED.
   *
   * The screen removed the turn and swallowed the database's refusal, so
   * private text somebody had deleted came back on the next reload — it had
   * never left the account. The DOM check above cannot see that, because the
   * DOM is exactly what the defect got right.
   */
  await fetch(`${SUPABASE}/__fixture/refuse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ table: "ocade_messages", method: "DELETE" }),
  });
  const beforeRefused = await page.locator("div.group").count();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await page.waitForTimeout(800);
  check(
    "a turn the account refused to delete stays on the screen",
    (await page.locator("div.group").count()) === beforeRefused,
    `${await page.locator("div.group").count()} against ${beforeRefused}`,
  );
  check(
    "and the person is told rather than left believing it is gone",
    /could not|try again|reach/i.test(await page.locator("body").innerText()),
  );
  await fetch(`${SUPABASE}/__fixture/refuse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  /* --- recent history is grouped by when, not one flat run ---------------- */

  check(
    "recent history is grouped by when it happened",
    (await page.locator("aside", { hasText: "Today" }).count()) >= 1,
  );

  /* --- one conversation, saved to a file ---------------------------------- */

  await page.hover("aside ul li");
  await page.click('aside ul li button[aria-label^="More options"]');
  const [saved] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.click('role=menuitem[name="Export"]'),
  ]);
  const exported = await saved.createReadStream().then(async (stream) => {
    let text = "";
    for await (const chunk of stream) text += chunk;
    return text;
  });
  check(
    "a single conversation exports what was actually said",
    saved.suggestedFilename().endsWith(".md") &&
      exported.includes("# Renamed by the proof") &&
      exported.includes("What is OCADE, in one line?"),
    saved.suggestedFilename(),
  );

  /* --- deleting a conversation asks first ---------------------------------- */

  await page.hover("aside ul li");
  await page.click('aside ul li button[aria-label^="More options"]');
  await page.click('role=menuitem[name="Delete"]');
  await page.waitForTimeout(400);
  check(
    "one click on Delete asks rather than deletes",
    (await page.locator("aside ul li").count()) >= 1 &&
      (await page.getByRole("menuitem", { name: "Delete for good" }).count()) === 1,
  );
  await page.click('role=menuitem[name="Delete for good"]');
  await page.waitForTimeout(500);
  check("and confirming deletes it", (await page.locator("aside ul li").count()) === 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check(
    "and it is gone for good, not in a trash that a reload restores",
    (await page.locator("aside ul li").count()) === 0,
  );

  /* --- an attached file reaches the answer, and hostile ones do not -------- */

  await page
    .getByRole("button", { name: "New chat" })
    .first()
    .click()
    .catch(() => undefined);
  await page.goto(`${BASE}/?new=true`, { waitUntil: "networkidle" });

  await page.setInputFiles('input[aria-label="Attach files"]', {
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("region,total\nnorth,4210\n"),
  });
  await page.waitForTimeout(600);
  await page.fill("#ocade-composer", "What is the north total?");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  const withFile = await page.locator("body").innerText();
  check(
    "an attached file visibly reaches the answer",
    withFile.includes("sales.csv") && withFile.includes("north,4210"),
    withFile.split("\n").find((line) => line.includes("sales.csv")) ?? "",
  );

  // Bytes that are not the image they claim to be.
  await page.goto(`${BASE}/?new=true`, { waitUntil: "networkidle" });
  await page.setInputFiles('input[aria-label="Attach files"]', {
    name: "payload.png",
    mimeType: "image/png",
    buffer: Buffer.from("MZ\u0090 this is not a png"),
  });
  await page.waitForTimeout(600);
  check(
    "a renamed binary claiming to be an image is refused",
    /not an image/i.test(await page.locator("body").innerText()),
  );

  // An archive is never opened, so there is no extraction to bound.
  await page.goto(`${BASE}/?new=true`, { waitUntil: "networkidle" });
  await page.setInputFiles('input[aria-label="Attach files"]', {
    name: "bundle.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\u0003\u0004 lots of nested entries"),
  });
  await page.waitForTimeout(600);
  check(
    "an archive is refused rather than extracted",
    /cannot read/i.test(await page.locator("body").innerText()),
  );

  /* --- a temporary chat writes nothing, anywhere --------------------------- */

  // Counted first: earlier sections leave real conversations behind, and what
  // this proves is that a temporary one ADDS nothing, not that history is empty.
  const savedBefore = await page.locator("aside ul li").count();
  await page.getByRole("button", { name: "Temporary" }).click();
  await page.fill("#ocade-composer", "Nothing about this is saved");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("a temporary chat still answers", true);
  check(
    "and it never reaches the sidebar",
    (await page.locator("aside ul li").count()) === savedBefore,
    `${await page.locator("aside ul li").count()} rows against ${savedBefore}`,
  );
  /*
   * A FILE IS PART OF "NOTHING IS SAVED", AND IT WAS NOT.
   *
   * Every readable attachment was copied into Library, with no check for
   * temporary mode at all — so somebody who turned Temporary on to ask about a
   * document found that document on their account afterwards. The transcript
   * checks above all passed while that was true, which is why this one counts
   * Library rather than the sidebar.
   */
  await page.setInputFiles('input[aria-label="Attach files"]', {
    name: "private-notes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("secret,value\nkeep,private\n"),
  });
  await page.waitForSelector("text=private-notes.csv", { timeout: 10_000 });
  await page.fill("#ocade-composer", "What does this say?");
  await page.click('button[aria-label="Send"]');
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });

  // Library is where a person looks for their files, so Library is what is
  // asked. The pair is what makes this non-vacuous: the file from the ordinary
  // conversation above MUST be there, and this one must not.
  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const library = await page.locator("body").innerText();
  check(
    "a file attached in an ordinary chat is kept in Library",
    library.includes("sales.csv"),
    library.slice(0, 160).replaceAll("\n", " "),
  );
  check("a file attached in a temporary chat is not", !library.includes("private-notes.csv"));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check(
    "and a reload finds no trace of it",
    (await page.locator("aside ul li").count()) === savedBefore &&
      !(await page.locator("body").innerText()).includes("Nothing about this is saved"),
  );

  // Phone width still works.
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await phone.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* See above. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const small = await phone.newPage();
  await small.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await small.fill("#ocade-composer", "Hello from a phone");
  await small.click('button[aria-label="Send"]');
  await small.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("Chat works at phone width", true);
  check(
    "the phone layout does not scroll sideways",
    await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  check(
    "no provider or runtime identifier is on screen",
    !/qwen|gguf|webgpu|wasm|gemini|wllama/i.test(await page.locator("body").innerText()),
  );
  /*
   * DICTATION EXISTS OR IT DOES NOT — it is never a button that does nothing.
   * Headless Chromium has no recogniser, so the control is absent here; on a
   * browser that has one it appears. Either way there is no inert microphone.
   */
  check(
    "the microphone is present only where the browser can actually listen",
    (await page.getByRole("button", { name: /Dictate/ }).count()) ===
      (await page.evaluate(() =>
        Number("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
      )),
  );

  /* --- signing out takes the transcript with it, in this tab, now ---------- */

  /*
   * THE PRIVACY BOUNDARY, WITHOUT A RELOAD.
   *
   * Sign-out cleared the conversation list and left everything else exactly
   * where it was: the open conversation, its transcript, the streaming answer.
   * The next person to sign in on the same machine — a shared laptop, a library
   * computer, a demo at a desk — could be looking at the previous person's
   * words, and a read that was already in flight could put them back even after
   * a clear. A reload would have hidden it, so this deliberately does not
   * reload: it signs out and looks at the same document.
   */
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("aside ul li button").first().click();
  await page.waitForSelector("text=stubbed OCADE answer", { timeout: 20_000 });
  check("a signed-in tab is showing a transcript", true);

  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForTimeout(1500);
  const afterSignOut = await page.locator("body").innerText();
  check(
    "signing out empties the transcript in the same document",
    !afterSignOut.includes("stubbed OCADE answer"),
    afterSignOut.split("\n").find((line) => line.includes("stubbed")) ?? "",
  );
  check(
    "and takes the conversation list with it",
    (await page.locator("aside ul li").count()) === 0,
    `${await page.locator("aside ul li").count()} rows`,
  );

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
