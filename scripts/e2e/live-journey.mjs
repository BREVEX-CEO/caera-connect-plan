/**
 * ONE REQUEST, A REAL MODEL, SEVERAL APPS: what a person would actually ask.
 *
 * A signed-in person gives JARVIS a single natural-language request that needs
 * the browser (three real Wikipedia pages), a workbook with a formula and a chart,
 * and a written summary, on their own computer (the real Device Agent on this
 * disposable VM). The model is Gemini through OCADE's own boundary code
 * (`OCADE_LIVE_GEMINI_KEY`, a capped staging key); nothing is scripted. The
 * person only says it once; a "Confirm this step" is answered as they would.
 *
 * Checked from the files themselves and the source pages, not from what JARVIS
 * says: each population in the workbook appears on that city's own page, the
 * total is a SUM formula, a chart is there, and the summary names the city the
 * workbook shows largest.
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

const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `live-${Date.now()}@ocade.test`, password: "proof" }),
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
  const started = Date.now();
  await page.locator("#jarvis-composer").fill(REQUEST);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  let confirmations = 0;
  const finished = await until(async () => {
    const ask = page.getByRole("alertdialog", { name: "Confirm this step" });
    if ((await ask.count()) === 1) {
      confirmations += 1;
      await ask.getByRole("button", { name: "Confirm" }).click();
    }
    const [task] = await table(
      "jarvis_tasks",
      `user_id=eq.${USER}&select=status,result&order=created_at.desc&limit=1`,
    );
    return task && !["running", "waiting"].includes(task.status);
  }, 20 * 60_000);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const [task] = await table(
    "jarvis_tasks",
    `user_id=eq.${USER}&select=status,result,blocker&order=created_at.desc&limit=1`,
  );
  check(
    "one request is carried to the end without being asked again",
    finished && task?.status === "completed",
    `${task?.status} after ${seconds}s, ${confirmations} confirmations: ${task?.result ?? task?.blocker ?? ""}`.slice(
      0,
      400,
    ),
  );

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
  if (failures) {
    process.stdout.write(`device log tail:\n${deviceLog.slice(-1500)}\n`);
    // What the model last saw and called, so a failure shows its own cause.
    const { turns = [] } = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) =>
      r.json(),
    );
    for (const turn of turns.slice(-24)) {
      process.stdout.write(`TURN  ${turn.role}: ${String(turn.content).replace(/\s+/g, " ")}\n`);
    }
  }
} finally {
  await fetch(`${SUPABASE}/__fixture/live-model`, { method: "POST", body: '{"on":false}' }).catch(
    () => undefined,
  );
  device?.kill();
  await browser.close();
}
process.stdout.write(failures === 0 ? "\nLive journey passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
