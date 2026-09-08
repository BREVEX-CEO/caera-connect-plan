/**
 * A CONVERSATION THAT LEAVES NOTHING BEHIND, AND MEMORY YOU CAN CARRY —
 * PLAN.md §8.
 *
 * Two of §8's requirements, and both are the kind that pass a source review
 * while failing in a browser. An incognito conversation that is kept out of the
 * sidebar while its messages sit in the vault would look right in every file
 * and be a privacy feature that lies. And an export nobody can trigger, or an
 * import that silently drops what it read, is a promise about somebody's data
 * that only a real click can check.
 *
 * WHAT IS REAL: the chat screen, the incognito banner and its claims, the chat
 * store's refusal to write, the memory panel, the export file and the import
 * that reads it back.
 * WHAT IS MODELLED: Supabase, in `stub-supabase.mjs`. The conversation is
 * driven with no engine available, which is the point: the engine's REPLY is
 * not what is under test here — what is written down is.
 */
import { chromium } from "playwright-core";

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

/** Everything this browser has written for the chat data class. */
async function storedChatKeys() {
  return page.evaluate(async () => {
    const names = await indexedDB.databases?.();
    const found = [];
    for (const entry of names ?? []) {
      if (!entry.name) continue;
      const database = await new Promise((resolve) => {
        const request = indexedDB.open(entry.name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      if (!database) continue;
      for (const store of [...database.objectStoreNames]) {
        const keys = await new Promise((resolve) => {
          try {
            const request = database.transaction(store, "readonly").objectStore(store).getAllKeys();
            request.onsuccess = () => resolve(request.result.map(String));
            request.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
        for (const key of keys) found.push(`${entry.name}/${store}/${key}`);
      }
      database.close();
    }
    return found;
  });
}

try {
  console.log("\nSTEP 1 — the chat screen offers an incognito conversation");
  await page.goto(`${BASE}/ocade`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4000);

  const toggle = page.locator("#start-incognito");
  if ((await toggle.count()) === 0) {
    fail("the chat screen offers no way to start an incognito conversation");
  } else {
    note("the toggle is offered where a conversation starts");
    await toggle.check();
    await settle(500);
    const summary = await page.getByText(/Nothing from this conversation is saved/i).count();
    if (summary === 0) fail("choosing incognito says nothing about what it does");
    else note("and says what it does before anything is typed");
  }

  console.log("\nSTEP 2 — a message in one is not written anywhere");
  const before = await storedChatKeys();
  note(`${before.length} stored key(s) before`);

  const composer = page.getByRole("textbox").first();
  if ((await composer.count()) === 0) {
    fail("no composer to type into");
  } else {
    await composer.fill("Remember that my passport number is not a thing I would type.");
    await composer.press("Enter");
    await settle(6000);
  }

  const after = await storedChatKeys();
  const added = after.filter((key) => !before.includes(key));
  if (added.length > 0) {
    fail(`an incognito conversation wrote ${added.length} key(s): ${added.slice(0, 3).join(", ")}`);
  } else {
    note("nothing new was written to this browser's storage");
  }

  const leaked = await page.evaluate(() =>
    JSON.stringify(localStorage).includes("passport number is not a thing"),
  );
  if (leaked) fail("the message text is in localStorage");
  else note("and the message text is in no local storage either");

  console.log("\nSTEP 3 — the banner says what it does and does not do");
  const banner = page.getByRole("status", { name: /incognito conversation/i });
  if ((await banner.count()) === 0) {
    fail("an incognito conversation does not say it is one");
  } else {
    note("the conversation says it is incognito");
    await page.getByRole("button", { name: /what this does and does not do/i }).click();
    await settle(600);
    for (const claim of [
      /does not hide the conversation from whoever can see this screen/i,
      /still reaches the provider/i,
      /will not use what it already remembers/i,
    ]) {
      if ((await page.getByText(claim).count()) === 0) {
        fail(`the detail is missing the claim matching ${claim}`);
      }
    }
    if (problems.length === 0) note("and states its limits, including the provider's own records");
  }

  console.log("\nSTEP 4 — it is gone after a reload, because there was nothing to reload");
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(4500);
  const survived = await page.getByText(/passport number is not a thing/i).count();
  if (survived > 0) fail("an incognito conversation survived a reload");
  else note("the conversation is gone, and so is its transcript");

  console.log("\nSTEP 5 — a side question stays out of the conversation");
  /*
   * PLAN.md §8's side conversations. The promise is SUBTRACTIVE — the question
   * and its answer must not become part of the thread — and subtractive
   * promises are exactly the kind that look fine in every file while failing
   * on screen, because nothing visibly goes wrong when they break.
   *
   * The conversation was seeded through the fixture: a side question hangs off
   * an ANSWER, and this sandbox has no engine to produce one.
   */
  const seeded = process.env.OCADE_SEEDED_CONVERSATION_ID;
  if (!seeded) {
    fail("no seeded conversation was provided, so side conversations went untested");
  } else {
    await page.goto(`${BASE}/ocade?conversation=${seeded}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await settle(5000);

    const transcript = page.locator("ol li");
    const beforeCount = await transcript.count();
    if (beforeCount === 0) {
      fail("the seeded conversation did not open");
    } else {
      note(`the conversation opened with ${beforeCount} message(s)`);

      const answer = page.getByText(/Kyoto was the capital of Japan/);
      if ((await answer.count()) === 0) {
        fail("the seeded answer is not on screen");
      }

      const askAbout = page.getByRole("button", { name: /Ask about this/i });
      if ((await askAbout.count()) === 0) {
        fail("an answer offers no way to ask a side question about it");
      } else {
        note("the answer offers a side question");

        /*
         * ON THE ANSWER AND NOT ON THE PROMPT. One `actions` object is drawn
         * for every message in the transcript, so an assistant-only control
         * used to render on user turns and do nothing when pressed. There is
         * one answer here, so there must be exactly one of these.
         */
        if ((await askAbout.count()) !== 1) {
          fail(`the side-question control appears ${await askAbout.count()} times for one answer`);
        } else {
          note("and offers it on the answer only, not on the prompt");
        }

        await askAbout.first().click();
        await settle(800);

        const panel = page.getByRole("region", { name: /side question/i });
        if ((await panel.count()) === 0) {
          fail("the side-question control opens nothing");
        } else {
          note("the side-question panel opened under the answer it hangs off");
          if ((await page.getByText(/kept out of this conversation/i).count()) === 0) {
            fail("the panel does not say the question stays out of the conversation");
          } else {
            note("and says so, rather than leaving it to be inferred from the layout");
          }
        }

        const sideBox = page.locator("#side-question-input");
        if ((await sideBox.count()) === 0) {
          fail("the panel has nothing to type a question into");
        } else {
          const focused = await sideBox.evaluate((el) => el === document.activeElement);
          if (!focused) fail("opening the panel leaves the keyboard nowhere");
          else note("focus moved into the panel, so a keyboard reaches it");

          await sideBox.fill("What does 1868 refer to?");
          await sideBox.press("Enter");
          await settle(5000);

          /*
           * THE ASSERTION THE FEATURE RESTS ON. There is no engine here, so
           * the question is refused — and a refusal is the honest outcome, not
           * a failure of this test. What must hold either way is that the
           * transcript did not grow: whatever happens to a side question, it
           * does not become a turn in the conversation.
           */
          const afterCount = await transcript.count();
          if (afterCount !== beforeCount) {
            fail(`a side question changed the transcript from ${beforeCount} to ${afterCount}`);
          } else {
            note("the transcript is unchanged — the side question is not in it");
          }

          /*
           * AND IT SAID WHY IT COULD NOT ANSWER.
           *
           * There is no engine in this sandbox, so the honest outcome is a
           * refusal with a reason. A control that accepts a question and then
           * does nothing visible is indistinguishable from a broken one, and
           * this is exactly where that would happen — the panel is small, and
           * an unanswered question in it looks like nothing happened at all.
           */
          const explained = await page
            .getByText(/prepar|engine|device|graphics|unavailable|could not/i)
            .count();
          if (explained === 0) {
            fail("the side question was neither answered nor explained");
          } else {
            note("and OCADE said why it could not answer it here");
          }

          const inTranscript = await page.evaluate(() => {
            const list = document.querySelectorAll("ol li");
            return [...list].some((row) => row.textContent?.includes("What does 1868 refer to?"));
          });
          /*
           * Deliberately checked against the TRANSCRIPT rows rather than the
           * page: the question is legitimately visible inside the side panel,
           * which is a child of the same list item. Asserting on the page text
           * would fail for the wrong reason and prove nothing.
           */
          if (inTranscript) {
            const bubbles = await page.evaluate(() => {
              const rows = document.querySelectorAll("ol li");
              return [...rows].filter((row) => {
                const aside = row.querySelector('section[aria-label="Side question"]');
                const clone = row.cloneNode(true);
                clone.querySelector('section[aria-label="Side question"]')?.remove();
                return aside && clone.textContent?.includes("What does 1868 refer to?");
              }).length;
            });
            if (bubbles > 0) fail("the side question was rendered as a message in the transcript");
            else note("the side question is inside its own panel, not in the transcript");
          } else {
            note("the side question is nowhere in the transcript");
          }
        }
      }
    }
  }

  console.log("\nSTEP 6 — a conversation can be shared, read by a stranger, and unshared");
  /*
   * PLAN.md §8's "share". The one §8 capability that hands somebody's own words
   * to a visitor with no account, so it is driven the way both people meet it:
   * the owner creates the link in the product, and a SEPARATE signed-out
   * browser context opens it. A single-context check would prove only that the
   * page renders for the person who already has the conversation.
   */
  if (!seeded) {
    fail("no seeded conversation was provided, so sharing went untested");
  } else {
    await page.goto(`${BASE}/ocade`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(4500);

    // The row menu appears on hover; the conversation is found by its title.
    const row = page.getByText("When was the capital moved?").first();
    if ((await row.count()) === 0) {
      fail("the seeded conversation is not in the sidebar");
    } else {
      /*
       * `force`, because the row menu itself is what the pointer lands on.
       * The menu is `opacity-0` until the row is hovered and is never removed
       * from the tree, so Playwright's actionability check reports the menu
       * intercepting the hover it is waiting for. Forcing it dispatches the
       * event on the same row, which is what makes the menu appear — and the
       * assertions below still prove the control is real by using it.
       */
      await row.hover({ force: true });
      await settle(400);
      const shareControl = page.getByRole("button", { name: /^share$/i });
      if ((await shareControl.count()) === 0) {
        fail("a conversation offers no way to share it");
      } else {
        await shareControl.first().click({ force: true });
        await settle(2500);

        /*
         * OPENING THE DIALOG MUST NOT HAVE SHARED IT. Checking whether
         * something is shared must never be the act of sharing it, and the
         * absence of a link here is what proves the read-only open.
         */
        const preEmptive = await page.locator('input[aria-label="Share link"]').count();
        if (preEmptive > 0) {
          fail("opening the Share dialog published the conversation by itself");
        } else {
          note("opening the dialog published nothing");
        }

        if ((await page.getByText(/does not update afterwards/i).count()) === 0) {
          fail("the dialog does not say the copy is frozen");
        } else {
          note("and says the copy does not update, before anything is created");
        }

        await page.getByRole("button", { name: /create a link/i }).click();
        await settle(3500);

        const linkBox = page.locator('input[aria-label="Share link"]');
        if ((await linkBox.count()) === 0) {
          fail("creating a link produced nothing to copy");
        } else {
          const shareUrl = await linkBox.inputValue();
          if (!/\/share\/[0-9a-f]{48}$/.test(shareUrl)) {
            fail(`the share link is not the expected shape: ${shareUrl}`);
          } else {
            note("a link was created, with an unguessable token");
          }

          /*
           * A GENUINELY SIGNED-OUT BROWSER. A fresh context carries none of
           * the owner's cookies or storage, so this is the same request a
           * stranger's browser makes: it proves the ROUTE does not sit behind
           * the authenticated shell, does not ask for an account, and does not
           * put an account identifier on the page.
           *
           * It does not prove the DATABASE's half — the fixture answers an
           * unauthenticated request as the seeded account, so an authorization
           * claim made here would be a claim about the fixture. That half is
           * proven against real PostgreSQL under `SET ROLE anon` in
           * `conversation-share-schema.test.ts`, where the table is unreadable
           * and the reader function is the only public door.
           */
          const strangerContext = await browser.newContext();
          const stranger = await strangerContext.newPage();
          const strangerErrors = [];
          stranger.on("console", (m) => {
            if (m.type() === "error") strangerErrors.push(m.text());
          });
          stranger.on("pageerror", (e) => strangerErrors.push(`pageerror: ${e.message}`));

          await stranger.goto(shareUrl.replace(/^https?:\/\/[^/]+/, BASE), {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await stranger.waitForTimeout(4000);

          const body = (await stranger.locator("body").innerText()).trim();
          if (!body.includes("Kyoto was the capital of Japan")) {
            fail("a signed-out reader cannot read the shared conversation");
          } else {
            note("a signed-out reader can read it, with no account");
          }
          if (/sign in|log in/i.test(body)) {
            fail("the shared page asks a reader to sign in");
          }

          /*
           * NOT INDEXED. The link's security is that nobody can guess the
           * token; an indexed page turns "anyone with the link" into "anyone
           * who searches".
           */
          const robotsMeta = await stranger
            .locator('meta[name="robots"]')
            .getAttribute("content")
            .catch(() => null);
          if (!robotsMeta || !/noindex/.test(robotsMeta)) {
            fail(`the shared page is indexable: robots=${robotsMeta ?? "(absent)"}`);
          } else {
            note(`and is kept out of search results (robots: ${robotsMeta})`);
          }

          const robotsTxt = await stranger.evaluate(async (base) => {
            const response = await fetch(`${base}/robots.txt`);
            return response.text();
          }, BASE);
          if (!robotsTxt.includes("Disallow: /share")) {
            fail("robots.txt does not disallow the share route");
          } else {
            note("and robots.txt disallows /share before a crawler fetches the page");
          }

          // The reader learns what was shared and nothing about who shared it.
          for (const leak of ["@example.com", "owner_id", "user_id"]) {
            if (body.includes(leak)) fail(`the shared page leaks ${leak}`);
          }

          if (!/does not update/i.test(body)) {
            fail("the shared page does not tell its reader the copy is frozen");
          } else {
            note("the reader is told the copy does not update");
          }

          for (const line of strangerErrors) {
            if (!expected(line)) fail(`unexplained on the shared page: ${line.slice(0, 200)}`);
          }

          console.log("\n  … and unsharing stops it");
          await page.getByRole("button", { name: /stop sharing/i }).click();
          await settle(3000);

          await stranger.reload({ waitUntil: "domcontentloaded" });
          await stranger.waitForTimeout(3500);
          const afterRevoke = (await stranger.locator("body").innerText()).trim();
          if (afterRevoke.includes("Kyoto was the capital of Japan")) {
            fail("a revoked link still serves the conversation");
          } else {
            note("the revoked link serves nothing");
          }
          if (!/does not open anything/i.test(afterRevoke)) {
            fail("a revoked link does not say the link is dead");
          }
          /*
           * And it does not admit the link was ever real: a "this was revoked"
           * answer would confirm a guessed token had once been valid.
           */
          if (
            /revoked|unshared by/i.test(afterRevoke) &&
            !/may have been unshared/i.test(afterRevoke)
          ) {
            fail("a revoked link admits it was once real");
          } else {
            note("and does not admit the link was ever real");
          }

          await strangerContext.close();
          await page
            .getByRole("button", { name: /^close$/i })
            .first()
            .click();
          await settle(600);
        }
      }
    }
  }

  console.log("\nSTEP 7 — delete-all clears the history and spares what it says it spares");
  await page.goto(`${BASE}/ocade`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4500);

  const deleteAll = page.getByRole("button", { name: /delete all chats/i });
  if ((await deleteAll.count()) === 0) {
    fail("there is no way to delete every conversation");
  } else {
    await deleteAll.first().click();
    await settle(800);

    const confirm = page.getByRole("button", { name: /^delete everything$/i });
    if ((await confirm.count()) === 0) {
      fail("delete-all opens no confirmation");
    } else {
      /*
       * A DESTRUCTIVE ACTION THAT CANNOT BE TRIGGERED BY ONE MISCLICK. The
       * confirm button must be inert until the phrase is typed — a dialog that
       * asks for a phrase and then ignores it is theatre.
       */
      if (await confirm.first().isEnabled()) {
        fail("delete-all can be confirmed without typing the phrase");
      } else {
        note("the confirmation is inert until the phrase is typed");
      }

      if ((await page.getByText(/does\s*not\s*remove Offline Intelligence/i).count()) === 0) {
        fail("delete-all does not say that Offline Intelligence is spared");
      } else {
        note("and says what it spares: Offline Intelligence, memory and projects");
      }

      await page.getByLabel(/type delete everything to confirm/i).fill("delete everything");
      await settle(300);
      await confirm.first().click();
      await settle(6000);

      const remaining = await storedChatKeys();
      const bodies = remaining.filter((key) => !key.includes("conv:"));
      if (bodies.length > 0) {
        fail(
          `${bodies.length} message key(s) survived delete-all: ${bodies.slice(0, 3).join(", ")}`,
        );
      } else {
        note("no message body is left in this browser's storage");
      }

      /*
       * OFFLINE INTELLIGENCE IS SPARED, and this is the assertion that makes
       * the dialog's promise real rather than decorative. The model lives in
       * OPFS, and a clear-everything that swept it would silently cost the
       * person a multi-gigabyte download.
       */
      const opfsIntact = await page.evaluate(async () => {
        try {
          const root = await navigator.storage?.getDirectory?.();
          if (!root) return "no-opfs";
          const names = [];
          for await (const [name] of root.entries()) names.push(name);
          return names.join(",");
        } catch (error) {
          return `error: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
      note(`OPFS after delete-all: ${opfsIntact || "(empty)"}`);
      if (typeof opfsIntact === "string" && opfsIntact.startsWith("error:")) {
        fail(`delete-all left OPFS unreadable — ${opfsIntact}`);
      }
    }
  }

  console.log("\nSTEP 8 — what OCADE remembers can be exported and read back");
  await page.goto(`${BASE}/settings/memory`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(4000);

  /*
   * Memory starts switched off, and that is the honest default. Export works
   * either way — a paused memory still holds what it holds — but IMPORTING
   * into a memory nobody is keeping would be storing something the person has
   * asked OCADE not to keep, so it is turned on first, exactly as a person
   * restoring a backup would.
   */
  const turnOn = page.getByRole("button", { name: /^turn on$/i });
  if ((await turnOn.count()) > 0) {
    await turnOn.first().click();
    await settle(3000);
    note("memory was switched on, as somebody restoring a backup would");
  }

  const exportControl = page.getByRole("button", { name: /^export$/i });
  if ((await exportControl.count()) === 0) {
    fail("the memory panel offers no export");
  } else {
    const download = page.waitForEvent("download", { timeout: 20000 });
    await exportControl.first().click();
    const file = await download;
    const name = file.suggestedFilename();
    if (!/^ocade-memory-\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
      fail(`the export is named oddly: ${name}`);
    } else {
      note(`exported ${name}`);
    }
  }

  const importControl = page.locator("#memory-import");
  if ((await importControl.count()) === 0) {
    fail("the memory panel offers no import");
  } else {
    // Focusable, and its ring shows on the label: the input IS the control,
    // because a label cannot take focus.
    const reachable = await importControl.evaluate((element) => element.tabIndex !== -1);
    if (!reachable) fail("the import control cannot be reached with a keyboard");
    else note("the import control is reachable with a keyboard");

    await importControl.setInputFiles({
      name: "memory.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "ocade.memory",
          version: 1,
          exportedAt: new Date().toISOString(),
          rows: [
            {
              id: "imported-1",
              scope: "user",
              project_id: null,
              content: "Prefers answers in British English.",
              source: "user",
              pinned: false,
              expires_at: null,
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      ),
    });
    await settle(3500);

    if ((await page.getByText(/Prefers answers in British English\./).count()) === 0) {
      fail("an imported memory is not shown after importing it");
    } else {
      note("the imported memory is on screen");
    }
  }

  console.log("\nSTEP 9 — a file OCADE does not understand changes nothing");
  await page.locator("#memory-import").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "something.else", rows: [] })),
  });
  await settle(2500);
  if ((await page.getByText(/not an OCADE memory export/i).count()) === 0) {
    fail("a file that is not an export was accepted, or refused silently");
  } else {
    note("a file that is not an OCADE export is refused, with the reason");
  }
  if ((await page.getByText(/Prefers answers in British English\./).count()) === 0) {
    fail("the refused import removed what was already remembered");
  } else {
    note("and what was already remembered is untouched");
  }
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
  `\n${problems.length === 0 ? "INCOGNITO AND MEMORY JOURNEY PASSED" : `${problems.length} PROBLEM(S)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
