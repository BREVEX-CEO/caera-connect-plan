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
 * 3. Photo: a photo made here (red left half, blue right half) edited in a real
 *    browser editor (miniPaint, MIT, its public demo): cropped, resized,
 *    brightened, exported. Checked from the exported file's pixels.
 *
 * 4. Recurring workflows (PLAN Phase 18): reconcile a ledger against a bank export,
 *    fill a client pack and save it as PDF, collect order statuses from pages
 *    served here. OCADE_LIVE_CASES held-out cases each (seeded; OCADE_LIVE_SEED
 *    is the first), checked by `workflow_cases.py`, never by JARVIS's words.
 *
 * Usage: node scripts/e2e/live-journey.mjs [--base=…] [--supabase=…]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { BASE, EXECUTABLE, SUPABASE } from "./common.mjs";

const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const CITIES = ["Tokyo", "Delhi", "Shanghai"];
const VIDEO_TITLE = "NASA's Fermi Spies a Supercharged Supernova (SVS15041)";
const CAPTIONS = `https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(
  `TimedText:${VIDEO_TITLE}.webm.en.srt`,
)}&action=raw`;
const PHOTO_REQUEST =
  "Using the photo editor at https://viliusle.github.io/miniPaint/, open photo.jpg from my work " +
  "folder, crop it to its left half, resize it to 400 pixels wide keeping its proportions, make " +
  "it brighter, and export it as a PNG into my work folder.";
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

/** Which of the tasks to run (OCADE_LIVE_TASKS=research,video,photo,reconcile,pack,status); all when unset. */
const TASKS = ["research", "video", "photo", "reconcile", "pack", "status"];
const wanted = (name) =>
  !process.env.OCADE_LIVE_TASKS || process.env.OCADE_LIVE_TASKS.split(",").includes(name);
// A misspelt task would run nothing and still end "passed" (PLAN V25).
const unknown = (process.env.OCADE_LIVE_TASKS ?? "")
  .split(",")
  .filter((t) => t && !TASKS.includes(t));
if (unknown.length) {
  process.stdout.write(
    `FAIL  unknown live tasks: ${unknown.join(", ")} (known: ${TASKS.join(", ")})\n`,
  );
  process.exit(1);
}

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
    ([key, value, prompt]) => {
      window.localStorage.setItem(key, value);
      // The A/B of the instructions: OCADE_LIVE_PROMPT=v2 opts this browser in (system-prompt.ts).
      if (prompt) window.localStorage.setItem("ocade.prompt", prompt);
    },
    [storageKey, JSON.stringify(session), process.env.OCADE_LIVE_PROMPT ?? ""],
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
  // Devices & Access lives in Settings (owner, 21 Oct).
  await page
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Settings" })
    .click();
  await page
    .getByRole("navigation", { name: "Settings categories" })
    .getByRole("button", { name: "Devices & Access" })
    .click();
  const files = page.getByRole("switch", { name: /Files in the workspace/ });
  await until(() => files.isEnabled(), 30_000);
  await files.click();
  // The order-status pages are served on this machine: allowed as a person would allow them.
  if (wanted("status")) {
    await page.locator("#jarvis-allow-site").fill("127.0.0.1");
    await page.getByRole("button", { name: "Allow site", exact: true }).click();
    await until(() => page.getByRole("switch", { name: "127.0.0.1" }).isChecked());
  }
  await page.keyboard.press("Escape");

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
    const counts = async () => {
      const said = await fetch(`${SUPABASE}/__fixture/jarvis-script`).then((r) => r.json());
      return {
        boundary: said.boundary ?? 0,
        gemini: said.gemini ?? 0,
        chars: said.chars ?? 0,
        promptTokens: said.promptTokens ?? 0,
        outputTokens: said.outputTokens ?? 0,
      };
    };
    const before = await counts();
    // Each request in a conversation of its own, as a person starts something new.
    await page
      .getByRole("navigation", { name: "JARVIS" })
      .getByRole("button", { name: "New conversation" })
      .click();
    await page
      .waitForURL((url) => !url.search.includes("c="), { timeout: 10_000 })
      .catch(() => undefined);
    const started = Date.now();
    await page.locator("#jarvis-composer").fill(words);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    let confirmations = 0;
    // A request that never became a task says why on the page; waiting longer would hide it.
    const begun = await until(async () => {
      const [task] = await table(
        "jarvis_tasks",
        `user_id=eq.${USER}&select=created_at&order=created_at.desc&limit=1`,
      );
      return task && Date.parse(task.created_at) >= started - 2_000;
    }, 180_000);
    if (!begun) {
      const said = (
        await page
          .locator("main")
          .innerText()
          .catch(() => "")
      ).replace(/\s+/g, " ");
      check(`${label}: the request starts a task`, false, said.slice(-400));
      await dumpTurns();
      return { steps: [], status: null, confirmations };
    }
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
      `task_id=eq.${task?.id}&select=status,action,result,summary`,
    );
    const after = await counts();
    process.stdout.write(
      `RESULT  ${label} | ${task?.status} | ${((Date.now() - started) / 1000).toFixed(0)} s | ${after.boundary - before.boundary} planner requests | ${after.gemini - before.gemini} upstream Gemini requests | ${
        steps.filter((step) => step.action).length
      } steps | ${steps.filter((step) => ["failed", "refused"].includes(step.status)).length} failed | ${confirmations} confirmations | ${after.chars - before.chars} request chars | ${after.promptTokens - before.promptTokens} prompt tokens | ${after.outputTokens - before.outputTokens} output tokens\n`,
    );
    process.stdout.write(
      `INFO  steps: ${steps.map((step) => `${step.action?.action ?? "?"}${step.action?.op ? `:${step.action.op}` : ""}=${step.status}`).join(" ")}\n`,
    );
    // Why each failed step failed, in the device's own words: the first thing a fix needs.
    for (const step of steps.filter((entry) => entry.status === "failed")) {
      process.stdout.write(
        `INFO  failed ${step.action?.op ?? step.action?.action}: ${step.summary}\n`,
      );
    }
    check(
      `${label}: one request is carried to the end without being asked again`,
      finished && task?.status === "completed",
      `${task?.status}: ${task?.result ?? task?.blocker ?? ""}`.slice(0, 400),
    );
    if (task?.status !== "completed") {
      await dumpTurns();
      // As a person would before asking something else: STOP the unfinished task, or the next
      // request is taken as an answer to it.
      await page
        .getByTestId("jarvis-task")
        .getByRole("button", { name: "Stop", exact: true })
        .click({ timeout: 10_000 })
        .catch(() => undefined);
      await until(async () => {
        const [last] = await table("jarvis_tasks", `id=eq.${task?.id}&select=status`);
        return !last || !["running", "waiting"].includes(last.status);
      }, 30_000);
    }
    return { steps, status: task?.status, confirmations };
  };
  const dumpTurns = async () => {
    process.stdout.write(`device log tail:\n${deviceLog.slice(-1500)}\n`);
    // What the model last saw and called, so a failure shows its own cause.
    const { agentTurns = [] } = await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) =>
      r.json(),
    );
    for (const turn of agentTurns.slice(-40)) {
      process.stdout.write(`TURN  ${turn.role}: ${String(turn.content).replace(/\s+/g, " ")}\n`);
    }
  };

  if (wanted("research")) {
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
sys.path.insert(0, "scripts/e2e")
from workflow_cases import recalculated
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb.active
rows = [[c.value for c in r] for r in ws.iter_rows(max_col=2)]
# The totals as another engine calculates them, not as the file says (PLAN V25).
calc = openpyxl.load_workbook(recalculated(__import__("pathlib").Path(sys.argv[1])), data_only=True).active
values = [[c.value for c in r] for r in calc.iter_rows(max_col=2)]
kinds = [c.tagname for s in wb.worksheets for c in s._charts]
print(json.dumps({"rows": rows, "values": values, "charts": len(kinds), "kinds": kinds}, default=str))`,
          sheetPath,
        ],
        { encoding: "utf8" },
      );
      const sheet = JSON.parse(read.stdout || '{"rows":[],"charts":0}');
      const values = {};
      process.stdout.write(`INFO  workbook rows: ${JSON.stringify(sheet.rows).slice(0, 600)}\n`);
      for (const city of CITIES) {
        const row = sheet.rows.find((r) => String(r[0] ?? "").includes(city));
        const value = Number(String(row?.[1] ?? "").replace(/[^\d.]/g, ""));
        values[city] = value;
        // The check's own read of the source: once more after Wikipedia's own wait when it says
        // "too many requests", and never a crash on its refusal page.
        let source = "";
        for (let tried = 0; tried < 2; tried += 1) {
          const answer = await fetch(
            `https://en.wikipedia.org/w/api.php?action=parse&page=${city}&prop=text&format=json&formatversion=2`,
            { headers: { "user-agent": "OCADE-e2e/1.0 (cloud acceptance test)" } },
          );
          if (answer.ok) {
            source = String((await answer.json()).parse?.text ?? "").replace(/<[^>]+>/g, " ");
            break;
          }
          process.stdout.write(
            `INFO  the check could not read ${city}'s page: HTTP ${answer.status}\n`,
          );
          if (answer.status !== 429) break;
          await new Promise((r) =>
            setTimeout(r, (Number(answer.headers.get("retry-after")) || 10) * 1000),
          );
        }
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
      const counted = (sheet.values ?? []).find((r) => /total/i.test(String(r[0] ?? "")));
      const expected = CITIES.reduce((sum, city) => sum + values[city], 0);
      check(
        "the total, recalculated by LibreOffice, is the three cities' sum",
        Number(counted?.[1]) === expected,
        `${counted?.[1]} vs ${expected}`,
      );
      check(
        "the workbook has a bar chart",
        (sheet.kinds ?? []).includes("barChart"),
        String(sheet.kinds),
      );
      const largest = CITIES.reduce((a, b) => (values[a] >= values[b] ? a : b));
      const summaryPath = path.join(workspace, "summary.md");
      const summary = existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : "";
      check(
        "the summary names the city the workbook shows largest",
        // Only with a population read for every city: with none, any city "is" the largest.
        CITIES.every((city) => values[city] > 0) && summary.includes(largest),
        summary.slice(0, 200),
      );
    }
  }

  if (wanted("video")) {
    /* --- 2. a video: found, played, paused exactly, captions summarised ------ */
    const { steps: videoSteps } = await ask(
      "video → pause at 0:30 → captions → summary",
      VIDEO_REQUEST,
    );
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
  }

  if (wanted("photo")) {
    /* --- 3. a photo: cropped, resized, brightened, exported ------------------ */
    // The person's own photo: 1200×800, a red left half and a blue right half, mid-bright.
    spawnSync(PYTHON, [
      "-c",
      `from PIL import Image, ImageDraw
im = Image.new("RGB", (1200, 800), (40, 40, 140)); d = ImageDraw.Draw(im)
d.rectangle([0, 0, 599, 799], fill=(140, 40, 40)); d.ellipse([150, 250, 450, 550], fill=(110, 90, 30))
im.save(${JSON.stringify(path.join(workspace, "photo.jpg"))}, quality=95)`,
    ]);
    await ask("photo → crop, resize, brighten, export", PHOTO_REQUEST);
    const measured = spawnSync(
      PYTHON,
      [
        "-c",
        `import json, pathlib, sys
from PIL import Image, ImageStat
root = pathlib.Path(sys.argv[1])
pngs = sorted(root.rglob("*.png"), key=lambda f: f.stat().st_mtime)
if not pngs: print("{}"); raise SystemExit
im = Image.open(pngs[-1]).convert("RGB")
r, g, b = ImageStat.Stat(im).mean
print(json.dumps({"file": str(pngs[-1].relative_to(root)), "size": im.size, "rgb": [round(r), round(g), round(b)]}))`,
        workspace,
      ],
      { encoding: "utf8" },
    );
    const photo = JSON.parse(measured.stdout || "{}");
    check("an edited PNG is in the work folder", Boolean(photo.file), measured.stderr.slice(-200));
    if (photo.file) {
      const [width, height] = photo.size;
      // The left half is 600×800: at 400 wide, 533 or 534 high.
      check(
        "cropped to the left half and resized to 400 wide",
        width === 400 && Math.abs(height - 533) <= 1,
        `${width}×${height}`,
      );
      // Only the left half's colours: red over blue, as the original's left half (140, 40, 40).
      const [red, green, blue] = photo.rgb;
      check(
        "only the left half remains (red, not the blue right half)",
        red > blue + 40,
        photo.rgb.join(","),
      );
      // Brighter than the original left half (mean 136, 47, 39: luminance 72.8, measured).
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      check("and it is brighter than the original", luminance > 82, luminance.toFixed(1));
    }
  }

  /* --- 4. recurring workflows: held-out cases, independent checks ----------- */
  const cases = Number(process.env.OCADE_LIVE_CASES ?? 1);
  const firstSeed = Number(process.env.OCADE_LIVE_SEED ?? 1);
  const caseDir = mkdtempSync(path.join(tmpdir(), "ocade-live-cases-"));
  const siteDir = path.join(caseDir, "site");
  mkdirSync(siteDir);
  const site = createServer((request, response) => {
    const name = path.basename(new URL(request.url, "http://x").pathname);
    const file = path.join(siteDir, name);
    if (!name.endsWith(".html") || !existsSync(file))
      return response.writeHead(404).end("Not found");
    response.writeHead(200, { "content-type": "text/html" }).end(readFileSync(file));
  });
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
  const siteBase = `http://127.0.0.1:${site.address().port}`;
  const today = new Date().toISOString().slice(0, 10);
  const workflowCase = (command, workflow, seed) =>
    spawnSync(
      PYTHON,
      [
        "scripts/e2e/workflow_cases.py",
        command,
        workflow,
        String(seed),
        workspace,
        siteDir,
        today,
        siteBase,
      ],
      { encoding: "utf8" },
    );
  for (const workflow of ["reconcile", "pack", "status"].filter(wanted)) {
    let verified = 0;
    let interventions = 0;
    for (let seed = firstSeed; seed < firstSeed + cases; seed += 1) {
      // Each case starts from its own inputs only: nothing of the last case is left to copy.
      for (const entry of readdirSync(workspace))
        rmSync(path.join(workspace, entry), { recursive: true });
      const made = workflowCase("make", workflow, seed);
      if (made.status !== 0) {
        check(`${workflow} case ${seed}: inputs made`, false, made.stderr.slice(-300));
        continue;
      }
      const { status, confirmations } = await ask(
        `${workflow} case ${seed}`,
        JSON.parse(made.stdout).request,
      );
      interventions += confirmations;
      const checked = workflowCase("check", workflow, seed);
      const results = JSON.parse(checked.stdout || "[]");
      for (const result of results)
        check(`${workflow} case ${seed}: ${result.name}`, result.ok, result.detail);
      if (checked.status !== 0)
        check(`${workflow} case ${seed}: checked`, false, checked.stderr.slice(-300));
      if (status === "completed" && results.length && results.every((result) => result.ok))
        verified += 1;
      // A task that said completed while a check failed is a false completion: never allowed.
      if (status === "completed" && results.some((result) => !result.ok)) {
        check(`${workflow} case ${seed}: no false completion`, false);
      }
    }
    process.stdout.write(
      `WORKFLOW  ${workflow} | ${verified}/${cases} cases completed and independently verified | ${interventions} confirmations\n`,
    );
  }
  site.close();
} finally {
  await fetch(`${SUPABASE}/__fixture/live-model`, { method: "POST", body: '{"on":false}' }).catch(
    () => undefined,
  );
  device?.kill();
  await browser.close();
}
process.stdout.write(failures === 0 ? "\nLive journey passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
