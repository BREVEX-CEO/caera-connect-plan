/**
 * ONE REQUEST EACH, A REAL MODEL, SEVERAL APPS: what a person would actually ask.
 *
 * A signed-in person gives JARVIS single natural-language requests, each said
 * once, on their own computer (the real Device Agent on this disposable VM). The
 * model is Gemini through OCADE's own boundary code (`OCADE_LIVE_GEMINI_KEY`, a
 * capped staging key); nothing is scripted. A "Confirm this step" is answered as
 * the person would.
 *
 * 1. Research → workbook → summary: three real Wikipedia pages, a workbook with
 *    a SUM formula and a chart, a summary. Checked from the files against the
 *    source pages.
 * 2. Video: a public-domain NASA video found on Wikimedia Commons, played,
 *    paused at exactly 0:30, its captions read and summarised. Checked from the
 *    device's own record of the player and against the captions fetched here.
 *
 * Usage: node scripts/e2e/live-journey.mjs [--base=…] [--supabase=…]
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
const CITIES = ["Tokyo", "Delhi", "Shanghai"];
const VIDEO_TITLE = "NASA's Fermi Spies a Supercharged Supernova (SVS15041)";
const CAPTIONS = `https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(
  `TimedText:${VIDEO_TITLE}.webm.en.srt`,
)}&action=raw`;
const VIDEO_REQUEST =
  `Find the public-domain NASA video "${VIDEO_TITLE}" on Wikimedia Commons, play it, then ` +
  "pause it at exactly 0:30. Read its English captions and write video-summary.md in my work " +
  "folder: a three-sentence summary of what the video explains, and the exact time you paused at.";
const REQUEST =
  "Using the browser, look up the population of Tokyo, Delhi and Shanghai on their English " +
  "Wikipedia pages. In my work folder, create cities.xlsx with a header row City and Population, " +
  "one row per city, a Total row whose population is a SUM formula, and a bar chart of the three " +
  "cities. Then write summary.md saying which city is largest and by how much it exceeds the " +
  "smallest.";

if (!process.env.OCADE_LIVE_GEMINI_KEY) {
  process.stdout.write("BLOCKED  live journey — no staging Gemini key (OCADE_LIVE_GEMINI_KEY)\n");
  process.exit(3);
}

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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const EMAIL = `live-${Date.now()}@ocade.test`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const USER = session.user.id;
const table = (name, query) => fetch(`${SUPABASE}/rest/v1/${name}?${query}`).then((r) => r.json());
const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;

const deviceHome = mkdtempSync(path.join(tmpdir(), "ocade-live-device-"));
const workspace = path.join(mkdtempSync(path.join(tmpdir(), "ocade-live-work-")), "project");
mkdirSync(workspace);
const env = { ...process.env, OCADE_JARVIS_HOME: deviceHome, OCADE_BROWSER_EXECUTABLE: EXECUTABLE };
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
let device = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });

  /* --- the person's computer, connected and allowed its work folder -------- */
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
  await page.goto(/OCADE: (\S+)/.exec(said)[1], { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  check("the computer is connected", (await connected) === 0, said.slice(-200));
  device = spawn(
    PYTHON,
    ["jarvis-runtime/ocade_device.py", "run", "--headless", "--workspace", workspace],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let deviceLog = "";
  device.stdout.on("data", (d) => (deviceLog += d));
  device.stderr.on("data", (d) => (deviceLog += d));
  await page.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await page
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Devices" })
    .click();
  const files = page.getByRole("switch", { name: /Files in the workspace/ });
  await until(() => files.isEnabled(), 30_000);
  await files.click();
  await page.getByRole("button", { name: "Close", exact: true }).first().click();

  /* --- one request, said once ---------------------------------------------- */
  await fetch(`${SUPABASE}/__fixture/live-model`, { method: "POST", body: '{"on":true}' });
  // A Pro customer, by the entitlement grant staff give: each model turn is one use, and Free's
  // 28 a session cannot carry a long task (reported to the owner as a pricing finding, 13 Oct).
  await fetch(`${SUPABASE}/rest/v1/ocade_entitlement_grants`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      user_id: USER,
      tier: "pro",
      reason: "cloud live journey",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      revoked_at: null,
    }),
  });
  /** One request, said once, carried to its end; what it took is recorded. */
  const ask = async (label, words) => {
    const turnsBefore =
      (await fetch(`${SUPABASE}/__fixture/jarvis-script`).then((r) => r.json())).gemini ?? 0;
    const started = Date.now();
    await page.locator("#jarvis-composer").fill(words);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    let confirmations = 0;
    const finished = await until(async () => {
      const confirm = page.getByRole("alertdialog", { name: "Confirm this step" });
      if ((await confirm.count()) === 1) {
        confirmations += 1;
        await confirm.getByRole("button", { name: "Confirm" }).click();
      }
      const [task] = await table(
        "jarvis_tasks",
        `user_id=eq.${USER}&select=status,created_at&order=created_at.desc&limit=1`,
      );
      // This request's own task: one started after it was sent, ended.
      return (
        task &&
        Date.parse(task.created_at) >= started - 2_000 &&
        !["running", "waiting"].includes(task.status)
      );
    }, 20 * 60_000);
    const [task] = await table(
      "jarvis_tasks",
      `user_id=eq.${USER}&select=id,status,result,blocker&order=created_at.desc&limit=1`,
    );
    const steps = await table(
      "jarvis_activity",
      `task_id=eq.${task?.id}&select=status,action,result`,
    );
    const turns =
      ((await fetch(`${SUPABASE}/__fixture/jarvis-script`).then((r) => r.json())).gemini ?? 0) -
      turnsBefore;
    process.stdout.write(
      `RESULT  ${label} | ${task?.status} | ${((Date.now() - started) / 1000).toFixed(0)} s | ${turns} Gemini calls | ${
        steps.filter((step) => step.action).length
      } steps | ${steps.filter((step) => ["failed", "refused"].includes(step.status)).length} failed | ${confirmations} confirmations\n`,
    );
    check(
      `${label}: one request is carried to the end without being asked again`,
      finished && task?.status === "completed",
      `${task?.status}: ${task?.result ?? task?.blocker ?? ""}`.slice(0, 400),
    );
    if (task?.status !== "completed") await dumpTurns();
    return steps;
  };
  const dumpTurns = async () => {
    process.stdout.write(`device log tail:\n${deviceLog.slice(-1500)}\n`);
    // What the model last saw and called, so a failure shows its own cause.
    const { turns = [] } = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) =>
      r.json(),
    );
    for (const turn of turns.slice(-24)) {
      process.stdout.write(`TURN  ${turn.role}: ${String(turn.content).replace(/\s+/g, " ")}\n`);
    }
  };

  await ask("research → workbook → summary", REQUEST);

  /* --- the files themselves, against the source pages ---------------------- */
  const sheetPath = path.join(workspace, "cities.xlsx");
  check("cities.xlsx is in the work folder", existsSync(sheetPath));
  if (existsSync(sheetPath)) {
    const read = spawnSync(
      PYTHON,
      [
        "-c",
        `import json, openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb.active
rows = [[c.value for c in r] for r in ws.iter_rows(max_col=2)]
print(json.dumps({"rows": rows, "charts": sum(len(s._charts) for s in wb.worksheets)}, default=str))`,
        sheetPath,
      ],
      { encoding: "utf8" },
    );
    const sheet = JSON.parse(read.stdout || '{"rows":[],"charts":0}');
    const values = {};
    for (const city of CITIES) {
      const row = sheet.rows.find((r) => String(r[0] ?? "").includes(city));
      const value = Number(String(row?.[1] ?? "").replace(/[^\d.]/g, ""));
      values[city] = value;
      const source = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${city}&prop=text&format=json&formatversion=2`,
        { headers: { "user-agent": "OCADE-e2e/1.0 (cloud acceptance test)" } },
      )
        .then((r) => r.json())
        .then((j) => String(j.parse?.text ?? "").replace(/<[^>]+>/g, " "));
      const written = value.toLocaleString("en-US");
      check(
        `${city}'s population is one its own page states`,
        value > 1_000_000 && (source.includes(written) || source.includes(String(value))),
        String(row?.[1]),
      );
    }
    const total = sheet.rows.find((r) => /total/i.test(String(r[0] ?? "")));
    check(
      "the total is a SUM formula, not a typed number",
      /^=SUM\(/i.test(String(total?.[1] ?? "")),
      String(total?.[1]),
    );
    check("the workbook has a chart", sheet.charts >= 1, String(sheet.charts));
    const largest = CITIES.reduce((a, b) => (values[a] >= values[b] ? a : b));
    const summaryPath = path.join(workspace, "summary.md");
    const summary = existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : "";
    check(
      "the summary names the city the workbook shows largest",
      summary.includes(largest),
      summary.slice(0, 200),
    );
  }

  /* --- 2. a video: found, played, paused exactly, captions summarised ------ */
  const videoSteps = await ask("video → pause at 0:30 → captions → summary", VIDEO_REQUEST);
  const players = videoSteps
    .map((step) => step.result?.detail?.media)
    .filter((media) => media && typeof media.currentTime === "number");
  const last = players.at(-1);
  check(
    "the video was left paused at 0:30, by the player's own record",
    Boolean(last?.paused) && Math.abs(last.currentTime - 30) <= 0.5,
    JSON.stringify(last ?? null),
  );
  check(
    "its captions were read on the page",
    videoSteps.some((step) => step.action?.op === "captions" && step.status === "done"),
  );
  const captions = await fetch(CAPTIONS, {
    headers: { "user-agent": "OCADE-e2e/1.0 (cloud acceptance test)" },
  }).then((r) => r.text());
  const videoPath = path.join(workspace, "video-summary.md");
  const told = existsSync(videoPath) ? readFileSync(videoPath, "utf8") : "";
  // The facts the captions themselves give; an accurate summary carries the explanation.
  const facts = ["magnetar", "gamma", "supernova"].filter(
    (fact) => captions.toLowerCase().includes(fact) && told.toLowerCase().includes(fact),
  );
  check(
    "the summary carries what the captions explain (supernova, gamma rays, the magnetar)",
    facts.length === 3,
    told.slice(0, 300),
  );
  check("and says where it paused", /0:30|00:30|30 ?s(econds)?/i.test(told), told.slice(0, 300));
} finally {
  await fetch(`${SUPABASE}/__fixture/live-model`, { method: "POST", body: '{"on":false}' }).catch(
    () => undefined,
  );
  device?.kill();
  await browser.close();
}
process.stdout.write(failures === 0 ? "\nLive journey passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
