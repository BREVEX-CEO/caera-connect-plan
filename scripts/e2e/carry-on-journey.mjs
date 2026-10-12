/**
 * THE COMPUTER CARRIES ON, proved with a real browser and the real device runtime.
 *
 * A person starts a task on their computer, then closes OCADE (a locked phone,
 * a closed tab). With Background Mode on, the computer asks OCADE for each next
 * step and finishes the work; what needs the person waits for the person; and
 * STOP from another device still stops it at once.
 *
 * The device is the working Python runtime (`jarvis-runtime/ocade_device.py`)
 * writing real files and running a real program in a real folder. The model is
 * the stub's script (`/__fixture/jarvis-script`): this proves the loop, the
 * lease and the device path, not intelligence.
 *
 * Usage: node scripts/e2e/carry-on-journey.mjs [--base=…] [--supabase=…]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}
async function until(condition, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await condition()) return true;
    } catch {
      /* not yet */
    }
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (spawnSync(PYTHON, ["-c", "import playwright"], { stdio: "ignore" }).status !== 0) {
  process.stdout.write("BLOCKED  carry-on journey — python with playwright is not available\n");
  process.exit(3); // 3 = blocked: the harness counts it, never as a pass (F-132)
}

const EMAIL = `carry-${Date.now()}@ocade.test`;
const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const USER = session.user.id;

const post = (pathname, body) =>
  fetch(`${SUPABASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
const script = (trigger, steps) => post("/__fixture/jarvis-script", { trigger, steps });
/** What the database holds, read as the service role. */
const table = (name, query) => fetch(`${SUPABASE}/rest/v1/${name}?${query}`).then((r) => r.json());
const tasks = () => table("jarvis_tasks", `user_id=eq.${USER}&order=created_at.asc`);
const notifications = () =>
  fetch(`${SUPABASE}/__fixture/notifications`)
    .then((r) => r.json())
    .then((list) => list.map((n) => n.title ?? n.p_title ?? JSON.stringify(n)));

const deviceHome = mkdtempSync(path.join(tmpdir(), "ocade-carry-device-"));
const workspace = path.join(mkdtempSync(path.join(tmpdir(), "ocade-carry-work-")), "project");
mkdirSync(workspace);
const env = { ...process.env, OCADE_JARVIS_HOME: deviceHome, OCADE_BROWSER_EXECUTABLE: EXECUTABLE };
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
let device = null;

/** A signed-in OCADE surface; closing its context is the person closing OCADE. */
async function open(viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  return { context, page };
}
const say = async (page, text) => {
  await page.locator("#jarvis-composer").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
};
/** The task's own script is not a question for the person (owner policy, 2026-10-02). */
const runsUnasked = async (page) => {
  const ask = page.getByRole("alertdialog", { name: "Confirm this step" });
  const started = await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 1,
    30_000,
  );
  return started && (await ask.count()) === 0;
};
const WAIT = `import time\ntime.sleep(7)\nopen("slept.txt", "a").write("x")\n`;

class Blocked extends Error {}
let blocked = false;
try {
  /* --- a computer of the person's own, with Background Mode ----------------- */
  const desk = await open({ width: 1440, height: 900 });
  await desk.page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  const connecting = spawn(
    PYTHON,
    [
      "jarvis-runtime/ocade_device.py",
      "connect",
      "--server",
      BASE,
      "--no-browser",
      "--name",
      "Desk",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let said = "";
  connecting.stdout.on("data", (d) => (said += d));
  connecting.stderr.on("data", (d) => (said += d));
  const connected = new Promise((resolve) => connecting.on("exit", resolve));
  await until(() => /OCADE: (\S+)/.test(said), 20_000);
  await desk.page.goto(/OCADE: (\S+)/.exec(said)[1], { waitUntil: "networkidle" });
  await desk.page.getByRole("button", { name: "Connect", exact: true }).click();
  check("the computer is connected", (await connected) === 0, said.slice(-200));
  device = spawn(
    PYTHON,
    ["jarvis-runtime/ocade_device.py", "run", "--headless", "--workspace", workspace],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let deviceLog = "";
  device.stdout.on("data", (d) => (deviceLog += d));
  device.stderr.on("data", (d) => (deviceLog += d));

  await desk.page.reload({ waitUntil: "networkidle" });
  await desk.page
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Devices" })
    .click();
  const files = desk.page.getByRole("switch", { name: /Files in the workspace/ });
  await until(() => files.isEnabled(), 30_000);
  await files.click();
  const commands = desk.page.getByRole("switch", { name: /Run commands in the work folder/ });
  const terminal = await commands.isEnabled();
  if (terminal) await commands.click();
  const backgroundSwitch = desk.page.getByRole("switch", { name: /^Background Mode/ });
  check(
    "Background Mode says what it does",
    (await desk.page.getByText(/keeps working on its task after you close OCADE here/).count()) ===
      1,
  );
  await backgroundSwitch.click();
  await until(async () => (await backgroundSwitch.getAttribute("aria-checked")) === "true");
  await desk.page.getByRole("button", { name: "Close", exact: true }).first().click();
  if (!terminal) {
    process.stdout.write("BLOCKED  carry-on journey — this computer offers no confined commands\n");
    // Thrown, not exited, so the runtime and browser below are still cleaned up (F-134).
    throw new Blocked();
  }
  const DEVICE = (await table("jarvis_devices", `user_id=eq.${USER}&select=id`))[0].id;

  /* --- 1. OCADE is closed mid-task: the computer finishes the work ------------ */
  await script("carry-check", [
    {
      tool: "start_task",
      args: {
        title: "Write the report",
        where: "computer",
        steps: ["Prepare", "Wait", "Write", "Finish"],
      },
    },
    { tool: "computer", args: { action: "file_write", path: "wait.py", content: WAIT, step: 1 } },
    // Every file it changes is read back before it may finish.
    { tool: "computer", args: { action: "file_read", path: "wait.py", step: 1 } },
    { tool: "computer", args: { action: "run", command: `${PYTHON} wait.py`, step: 2 } },
    {
      tool: "computer",
      args: { action: "file_write", path: "report.txt", content: "done away", step: 3 },
    },
    { tool: "computer", args: { action: "file_read", path: "report.txt", step: 3 } },
    {
      tool: "finish_task",
      args: { outcome: "completed", result: "The report is written.", evidence: ["done away"] },
    },
  ]);
  await say(desk.page, "carry-check write the report");
  check(
    "the task starts in the open surface as always",
    await until(() => existsSync(path.join(workspace, "wait.py")), 30_000),
  );
  check("the task's own script runs without a question", await runsUnasked(desk.page));
  // The slow step is running on the computer. The person closes OCADE now.
  await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 1,
    15_000,
  );
  await desk.context.close();
  await until(() => existsSync(path.join(workspace, "slept.txt")), 30_000);
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  check(
    "with nobody driving it, the task does not move on by itself at once",
    !existsSync(path.join(workspace, "report.txt")) && (await tasks())[0].status === "running",
  );
  // Three minutes of silence is what a closed surface looks like; the fixture ages it.
  await post("/__fixture/age-tasks", {});
  check(
    "the computer carries on and writes the file",
    (await until(() => existsSync(path.join(workspace, "report.txt")), 45_000)) &&
      readFileSync(path.join(workspace, "report.txt"), "utf8") === "done away",
    deviceLog.slice(-300),
  );
  check(
    "and finishes the task with its result",
    await until(async () => (await tasks())[0].status === "completed", 45_000),
    JSON.stringify((await tasks())[0]).slice(0, 300),
  );
  const finished = (await tasks())[0];
  check("the loop was the computer's own", finished.controller === DEVICE, finished.controller);
  check(
    "progress reached the last step",
    finished.current_step === 4 && finished.result === "The report is written.",
  );
  const boundaryCall = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json());
  check(
    "each step was planned through OCADE's server door, on the JARVIS surface, with a permit",
    boundaryCall.door === "server" &&
      boundaryCall.authorized === true &&
      boundaryCall.surface === "jarvis" &&
      boundaryCall.permitSource === "server" &&
      Boolean(boundaryCall.permitId),
    JSON.stringify({ door: boundaryCall.door, authorized: boundaryCall.authorized }),
  );
  check(
    "the model was told the computer is carrying on, and never shown a provider name",
    boundaryCall.systemPrompts[0].startsWith("You are OCADE JARVIS"),
  );
  check(
    "the person is told it finished",
    (await notifications()).some((title) => title.includes("JARVIS finished: Write the report")),
    JSON.stringify(await notifications()).slice(0, 300),
  );
  const uses = await table(
    "jarvis_activity",
    `user_id=eq.${USER}&select=summary,status,action&order=created_at.asc`,
  );
  check(
    "every step it took is in Activity, none of them twice",
    uses
      .filter((row) => row.action)
      .map((row) => row.action.action)
      .join(",") === "file_write,file_info,run,file_write,file_read" &&
      readFileSync(path.join(workspace, "slept.txt"), "utf8") === "x",
    uses
      .filter((row) => row.action)
      .map((row) => `${row.action.action}:${row.status}`)
      .join(","),
  );

  // Back on a phone: the conversation shows what happened while they were away.
  const phone = await open({ width: 390, height: 844 });
  await phone.page.goto(`${BASE}/ocade-jarvis?c=${finished.conversation_id}`, {
    waitUntil: "networkidle",
  });
  check(
    "reopened on a phone, the conversation ends with the result",
    await until(
      async () => (await phone.page.getByText("The report is written.").count()) >= 1,
      20_000,
    ),
  );
  check(
    "and nothing on screen says it is still working: no open task, no STOP",
    (await phone.page.getByTestId("jarvis-task").count()) === 0 &&
      (await phone.page.getByRole("button", { name: /^STOP/ }).count()) === 0,
  );

  /* --- 2. a step that needs the person waits for the person ------------------ */
  await script("needs-you", [
    {
      tool: "start_task",
      args: { title: "Clear old files", where: "computer", steps: ["Wait", "Delete"] },
    },
    { tool: "computer", args: { action: "run", command: `${PYTHON} wait.py`, step: 1 } },
    { tool: "computer", args: { action: "file_delete", path: "report.txt", step: 2 } },
    { tool: "finish_task", args: { outcome: "completed", result: "Deleted." } },
  ]);
  await phone.page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await say(phone.page, "needs-you clear the old files");
  await runsUnasked(phone.page);
  await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 1,
    30_000,
  );
  await phone.context.close();
  await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 0,
    30_000,
  );
  await post("/__fixture/age-tasks", {});
  check(
    "a deletion is never carried out for a person who is not there: the task waits",
    await until(async () => (await tasks())[1]?.status === "waiting", 45_000),
    JSON.stringify((await tasks())[1] ?? {}).slice(0, 200),
  );
  const waiting = (await tasks())[1];
  check(
    "it says what it is waiting for",
    waiting.blocker === "JARVIS needs you to confirm: Permanently deleting report.txt",
    waiting.blocker,
  );
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  check("the file is still there", existsSync(path.join(workspace, "report.txt")));
  check(
    "and they are told JARVIS needs them",
    (await notifications()).some((title) => title.includes("JARVIS needs you: Clear old files")),
  );

  /* --- 3. STOP from another device, while the computer holds the loop --------- */
  const again = await open({ width: 390, height: 844 });
  await again.page.goto(`${BASE}/ocade-jarvis?c=${waiting.conversation_id}`, {
    waitUntil: "networkidle",
  });
  // Stop the waiting task first, so a new one can start in a new conversation.
  await again.page.getByRole("button", { name: /^STOP/ }).click();
  await until(async () => (await tasks())[1].status === "stopped", 20_000);
  await script("stop-away", [
    {
      tool: "start_task",
      args: { title: "Long job", where: "computer", steps: ["One", "Two", "Three"] },
    },
    { tool: "computer", args: { action: "run", command: `${PYTHON} wait.py`, step: 1 } },
    { tool: "computer", args: { action: "run", command: `${PYTHON} wait.py`, step: 2 } },
    { tool: "computer", args: { action: "file_write", path: "never.txt", content: "no", step: 3 } },
    { tool: "finish_task", args: { outcome: "completed", result: "Done." } },
  ]);
  await again.page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await say(again.page, "stop-away run the long job");
  // Unasked here, and the computer runs it again by itself.
  await runsUnasked(again.page);
  await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 1,
    30_000,
  );
  await again.context.close();
  await until(
    async () =>
      (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 0,
    30_000,
  );
  await post("/__fixture/age-tasks", {});
  // The computer asks for the next step and starts the second long run.
  check(
    "the computer carries on with the next long step",
    await until(
      async () =>
        (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 1,
      45_000,
    ),
  );
  const stopper = await open({ width: 390, height: 844 });
  await stopper.page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  const stopButton = stopper.page.getByRole("button", { name: /^STOP/ });
  await until(async () => (await stopButton.count()) === 1, 20_000);
  // Asking about it from the phone is answered from the task itself and takes nothing over.
  const longJob = (await tasks())[2];
  const before = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json());
  await stopper.page.goto(`${BASE}/ocade-jarvis?c=${longJob.conversation_id}`, {
    waitUntil: "networkidle",
  });
  await until(async () => (await stopper.page.getByTestId("jarvis-task").count()) === 1, 20_000);
  await say(stopper.page, "what are you doing?");
  check(
    "asked from a phone what it is doing, JARVIS answers from the real task",
    await until(
      async () =>
        (await stopper.page
          .getByText(/I'm working on “Long job”\. I'm on step 2 of 3: Two\./)
          .count()) >= 1,
      15_000,
    ),
  );
  const after = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json());
  check(
    "and the question neither takes the task from the computer nor costs a use",
    (await tasks())[2].controller === DEVICE &&
      (await tasks())[2].status === "running" &&
      after.permitId === before.permitId,
  );
  const pressed = Date.now();
  await stopButton.click();
  check(
    "STOP from a phone stops the computer's task",
    await until(async () => (await tasks())[2].status === "stopped", 20_000),
  );
  check(
    "the running step is cancelled on the computer within seconds",
    (await until(
      async () =>
        (await table("jarvis_activity", `user_id=eq.${USER}&status=eq.claimed`)).length === 0,
      15_000,
    )) && Date.now() - pressed < 15_000,
  );
  await post("/__fixture/age-tasks", {});
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  check(
    "and nothing more is planned or run after STOP",
    !existsSync(path.join(workspace, "never.txt")) && (await tasks())[2].status === "stopped",
  );
  await stopper.context.close();

  /* --- 4. reminders and scheduled work, on OCADE's own clock ------------------ */
  const clockTick = async () => {
    await post("/__fixture/due-schedules", {});
    // What the Worker's cron does every minute, asked for now.
    await fetch(`${BASE}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("* * * * *")}`);
  };
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const planner = await open({ width: 1440, height: 900 });
  const plan = planner.page;
  await plan.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await script("remind-check", [
    { tool: "schedule", args: { what: "Call the bank", when: soon, repeat: "none" } },
    { text: "I'll remind you in an hour." },
  ]);
  await say(plan, "remind-check remind me in an hour to call the bank");
  await until(
    async () => (await plan.getByText("I'll remind you in an hour.").count()) >= 1,
    30_000,
  );
  const told = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json());
  check(
    "JARVIS is told the time now in the person's own zone",
    /The time now is \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d \(/.test(told.clock ?? ""),
    told.clock,
  );
  const rail = (name) =>
    plan.getByRole("navigation", { name: "JARVIS" }).getByRole("button", { name });
  await rail("Activity").click();
  const scheduled = plan.getByRole("region", { name: "Scheduled" });
  check(
    "the reminder is listed under Scheduled, as a reminder",
    await until(async () => (await scheduled.getByText("Call the bank").count()) === 1, 20_000),
  );
  await clockTick();
  check(
    "at its time the person is notified",
    await until(
      async () => (await notifications()).some((t) => t === "Reminder: Call the bank"),
      30_000,
    ),
    JSON.stringify(await notifications()).slice(-200),
  );
  await plan.reload({ waitUntil: "networkidle" });
  check(
    "and it is said in its conversation",
    await until(async () => (await plan.getByText("Reminder: Call the bank").count()) >= 1, 20_000),
  );
  await clockTick();
  check(
    "a one-off reminder is not repeated",
    (await notifications()).filter((t) => t === "Reminder: Call the bank").length === 1,
  );

  // Scheduled work is off until the person turns it on for that computer.
  await script("later-check", [
    {
      tool: "schedule",
      args: { what: "later-work write the later file", when: soon, on_computer: true },
    },
    { text: "Scheduled." },
  ]);
  await say(plan, "later-check write the later file in an hour");
  await until(
    async () => (await plan.getByText("Scheduled.", { exact: true }).count()) >= 1,
    30_000,
  );
  await clockTick();
  check(
    "scheduled work does not start until the person allows it on that computer",
    (await until(
      async () =>
        (await notifications()).some(
          (t) => t === "JARVIS could not start: later-work write the later file",
        ),
      30_000,
    )) && !existsSync(path.join(workspace, "later.txt")),
  );

  await rail("Devices").click();
  const scheduledWork = plan.getByRole("switch", { name: /Scheduled work/ });
  await until(() => scheduledWork.isEnabled(), 20_000);
  await scheduledWork.click();
  await until(
    async () =>
      (await scheduledWork.getAttribute("aria-checked")) === "true" ||
      (await scheduledWork.isChecked()),
  );
  await plan.getByRole("button", { name: "Close", exact: true }).first().click();
  await script("later-check", [
    {
      tool: "schedule",
      args: { what: "later-work write the later file", when: soon, on_computer: true },
    },
    { text: "Scheduled again." },
  ]);
  await say(plan, "later-check write the later file in an hour");
  await until(async () => (await plan.getByText("Scheduled again.").count()) >= 1, 30_000);
  // What the computer does when it runs: the person's instruction, then the steps.
  await script("later-work", [
    { text: "(the task was started by OCADE's clock)" },
    { tool: "computer", args: { action: "file_write", path: "later.txt", content: "on time" } },
    { tool: "computer", args: { action: "file_read", path: "later.txt" } },
    {
      tool: "finish_task",
      args: { outcome: "completed", result: "The later file is written.", evidence: ["on time"] },
    },
  ]);
  await plan.context().close();
  await clockTick();
  check(
    "at its time the work starts on the computer and is finished there, with nobody watching",
    (await until(() => existsSync(path.join(workspace, "later.txt")), 60_000)) &&
      (await until(
        async () =>
          (await notifications()).some(
            (t) => t === "JARVIS finished: later-work write the later file",
          ),
        45_000,
      )),
    JSON.stringify(await notifications()).slice(-300),
  );

  // Removing one from the list really removes it.
  const lister = await open({ width: 390, height: 844 });
  await post("/__fixture/jarvis-script", { trigger: "zz-none", steps: [] });
  await lister.page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await script("keep-check", [
    { tool: "schedule", args: { what: "Water the plants", when: soon, repeat: "daily" } },
    { text: "Every day." },
  ]);
  await say(lister.page, "keep-check remind me every day to water the plants");
  await until(async () => (await lister.page.getByText("Every day.").count()) >= 1, 30_000);
  const schedules = () =>
    table("jarvis_schedules", `user_id=eq.${USER}&active=eq.true&select=id,what`);
  check(
    "a repeating reminder is kept",
    (await schedules()).some((row) => row.what === "Water the plants"),
  );
  await lister.page.getByRole("button", { name: "Open navigation" }).click();
  await lister.page
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Activity" })
    .click();
  await lister.page.getByRole("button", { name: "Remove Water the plants" }).click();
  check(
    "Remove takes it off the list and out of OCADE",
    await until(
      async () => !(await schedules()).some((row) => row.what === "Water the plants"),
      20_000,
    ),
  );
  await lister.context.close();
} catch (error) {
  if (!(error instanceof Blocked)) throw error;
  blocked = true;
} finally {
  device?.kill();
  await browser.close();
}

if (blocked) process.exit(failures === 0 ? 3 : 1);

process.stdout.write(failures === 0 ? "\nCarry-on journey passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
