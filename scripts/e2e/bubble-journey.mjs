/**
 * The floating JARVIS bubble on a phone-sized screen, in a real browser.
 *
 * It shows only when signed in, on phones, outside JARVIS itself; drags and
 * snaps to an edge and stays there after a reload; opens to the current task
 * with a Stop that stops it; hands a typed question to JARVIS, which asks it
 * exactly once; hides, and comes back from Settings; and shows one account's
 * task to that account only.
 *
 * Android-sized Chromium is web compatibility evidence, never proof of the
 * Android companion or of a bubble drawn over other apps.
 *
 * Usage: node scripts/e2e/bubble-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium, devices } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

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
const rest = (session, table, body) =>
  fetch(`${SUPABASE}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
      prefer: "return=representation",
    },
    body: JSON.stringify(body),
  }).then((response) => response.json());

const a = await signIn(`bubble-a-${stamp}@ocade.test`);
const [conversation] = await rest(a, "ocade_conversations", { title: "Tidy", surface: "jarvis" });
const [task] = await rest(a, "jarvis_tasks", {
  conversation_id: conversation.id,
  title: "Tidy my downloads folder",
  plan: ["List", "Sort", "Report"],
  current_step: 1,
  status: "running",
});
const b = await signIn(`bubble-b-${stamp}@ocade.test`);

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const errors = [];

async function phone(session) {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  await context.addInitScript(
    ([key, value]) => {
      if (value) window.localStorage.setItem(key, value);
    },
    [storageKey, session ? JSON.stringify(session) : ""],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));
  return page;
}

const visible = (locator, timeout = 20_000) =>
  locator.waitFor({ timeout }).then(
    () => true,
    () => false,
  );

try {
  /* --- signed out: no bubble ---------------------------------------------- */
  const guest = await phone(null);
  await guest.goto(`${BASE}/help`, { waitUntil: "load" });
  await guest.waitForTimeout(2500);
  check(
    "signed out, there is no bubble",
    (await guest.getByRole("button", { name: /^JARVIS, / }).count()) === 0,
  );

  /* --- Account A, with a running task -------------------------------------- */
  const page = await phone(a);
  const bubble = page.getByRole("button", { name: /^JARVIS, / });
  const panel = page.getByRole("dialog", { name: "JARVIS" });
  await page.goto(`${BASE}/library`, { waitUntil: "load" });
  check("signed in on a phone, the bubble is there", await visible(bubble));
  check(
    "it says JARVIS is working",
    await visible(page.getByRole("button", { name: "JARVIS, Working · step 2 of 3" })),
  );

  const start = await bubble.boundingBox();
  await page.mouse.move(start.x + 26, start.y + 26);
  await page.mouse.down();
  await page.mouse.move(120, 300, { steps: 8 });
  await page.mouse.move(90, 320, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check("dragged left, it snaps to the left edge", (await bubble.boundingBox()).x === 8);
  await page.reload({ waitUntil: "load" });
  await bubble.waitFor();
  await page.waitForTimeout(500);
  check("and stays there after a reload", (await bubble.boundingBox()).x === 8);

  await page.mouse.move(40, 330);
  await page.mouse.down();
  await page.mouse.move(2000, 3000, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const flung = await bubble.boundingBox();
  const size = page.viewportSize();
  check(
    "flung off the screen, it stays on it",
    flung.x + flung.width <= size.width && flung.y + flung.height <= size.height,
  );

  await bubble.click();
  check("a tap opens the mini JARVIS", await visible(panel, 5000));
  check(
    "which shows the current task",
    (await panel.innerText()).includes("Tidy my downloads folder"),
  );
  check(
    "without pushing the page sideways",
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
  );
  await page.keyboard.press("Escape");
  check("Escape closes it", (await panel.count()) === 0);

  /* --- Account B never sees Account A's task -------------------------------- */
  const other = await phone(b);
  await other.goto(`${BASE}/library`, { waitUntil: "load" });
  check(
    "another account's bubble shows its own state, not the first account's task",
    await visible(other.getByRole("button", { name: "JARVIS, Ready" })),
  );

  /* --- Stop, from the bubble ------------------------------------------------ */
  await bubble.click();
  await panel.getByRole("button", { name: "Stop", exact: true }).click();
  check(
    "Stop in the bubble stops the task",
    await visible(page.getByRole("button", { name: "JARVIS, Ready" }), 10_000),
  );
  const stored = await fetch(
    `${SUPABASE}/rest/v1/jarvis_tasks?id=eq.${task.id}&select=status`,
  ).then((response) => response.json());
  check("and the task is stopped on the server", stored[0]?.status === "stopped");

  /* --- the mini chat answers in the bubble --------------------------------- */
  await panel.getByPlaceholder("Ask JARVIS…").fill("What is 2 + 2?");
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  const mini = panel.locator("[aria-label='Mini chat']");
  check(
    "a question is answered inside the bubble",
    await visible(mini.getByText("stubbed OCADE answer")),
  );
  check("without leaving the page", page.url().includes("/library"));

  /* --- work moves to the full page, asked exactly once ---------------------- */
  await fetch(`${SUPABASE}/__fixture/jarvis-script`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      trigger: "bubble-work",
      steps: [
        { tool: "start_task", args: { title: "Open a page", where: "browser", steps: ["Open"] } },
        { text: "That needs a connected device." },
      ],
    }),
  });
  await panel.getByPlaceholder("Ask JARVIS…").fill("bubble-work open example.com");
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForURL(/ocade-jarvis\?c=/, { timeout: 20_000 });
  check("asking for work opens full JARVIS", (await bubble.count()) === 0);
  check(
    "where the same conversation carries on",
    await visible(page.getByText("That needs a connected device.").last(), 30_000),
  );
  await page.goBack({ waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.goForward({ waitUntil: "load" });
  await page.waitForTimeout(2500);
  const transcript = page.locator("section[aria-label=Conversation]");
  check(
    "the work request was saved once, even after Back and Forward",
    (await transcript.getByText("bubble-work open example.com", { exact: true }).count()) === 1,
  );
  check(
    "and the bubble's earlier answer is in the same conversation",
    (await transcript.getByText("What is 2 + 2?", { exact: true }).count()) === 1,
  );

  /* --- hide, and bring back from Settings ----------------------------------- */
  await page.goto(`${BASE}/library`, { waitUntil: "load" });
  await bubble.click();
  await panel.getByRole("button", { name: "Hide bubble", exact: true }).click();
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2500);
  check("hidden, it stays hidden after a reload", (await bubble.count()) === 0);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: /bubble-a-.*@ocade.test/ }).click();
  await page.getByRole("menuitem", { name: /Settings/ }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("button", { name: "Appearance" }).click();
  await settings.getByRole("switch", { name: "JARVIS bubble" }).click();
  await page.keyboard.press("Escape");
  check("Settings › Appearance brings it back", await visible(bubble, 5000));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  check("on a wide screen there is no bubble", (await bubble.count()) === 0);
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the bubble journey runs", false, String(error).slice(0, 300));
} finally {
  await browser.close();
}

process.stdout.write(
  failures === 0 ? "\nBubble journey passed.\n" : `\n${failures} bubble checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
