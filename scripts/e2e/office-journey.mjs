/**
 * EXCEL, WORD AND A CODE FIX, FROM A JARVIS CONVERSATION, ON THE PERSON'S OWN COMPUTER.
 *
 * A signed-in person asks JARVIS to finish a sales workbook and a report. The
 * request goes from the browser through OCADE's action authority to the real
 * device runtime (`jarvis-runtime/ocade_device.py`), which works in this
 * computer's real Excel and Word: formulas and a lookup filled rather than
 * values typed, totals, number formats, borders, conditional formatting,
 * frozen headers, a sheet nobody asked about left exactly as it was; in the
 * report, replacements, a heading style, a table. Both are saved, reopened and
 * read back, and then checked here from the files themselves. Then a failing
 * test in a real git repository: JARVIS runs the tests, reads the code, fixes
 * it, runs them again and shows the diff — commands run directly in the work
 * folder, no terminal window.
 *
 * The model is the stub's script (`/__fixture/jarvis-script`): this proves the
 * path from conversation to Office and the result on disk, not intelligence.
 * The expected numbers are computed from the same rows the workbook is made
 * from, so nothing here is a remembered answer.
 *
 * Usage: node scripts/e2e/office-journey.mjs [--base=…] [--supabase=…]
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
const RUNTIME = path.resolve("jarvis-runtime");

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
/** Python with the runtime and its tests importable; prints one JSON line. */
function python(code) {
  const run = spawnSync(PYTHON, ["-c", code], {
    cwd: RUNTIME,
    env: {
      ...process.env,
      PYTHONPATH: `${RUNTIME}${path.delimiter}${path.join(RUNTIME, "tests")}`,
    },
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(run.stderr.slice(-400));
  return JSON.parse(run.stdout.trim().split("\n").pop());
}

const office = python(
  "import json, ocade_sheets, ocade_documents; print(json.dumps({'excel': ocade_sheets.excel_available(), 'word': ocade_documents.word_available()}))",
);
if (!office.excel || !office.word) {
  process.stdout.write(
    "BLOCKED  office journey — Microsoft Excel and Word are not both installed\n",
  );
  process.exit(0);
}

const EMAIL = `office-${Date.now()}@ocade.test`;
const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const USER = session.user.id;
const script = (trigger, steps) =>
  fetch(`${SUPABASE}/__fixture/jarvis-script`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trigger, steps }),
  });
const table = (name, query) => fetch(`${SUPABASE}/rest/v1/${name}?${query}`).then((r) => r.json());

const deviceHome = mkdtempSync(path.join(tmpdir(), "ocade-office-device-"));
const workspace = path.join(mkdtempSync(path.join(tmpdir(), "ocade-office-work-")), "finance");
mkdirSync(workspace);
const env = { ...process.env, OCADE_JARVIS_HOME: deviceHome, OCADE_BROWSER_EXECUTABLE: EXECUTABLE };

// The same realistic book and draft report the runtime's own Office tests use.
const rows = python(`
import json
from pathlib import Path
from test_sheets import ORDERS, RATES, workbook
from test_files_documents import _minimal_docx
root = Path(${JSON.stringify(workspace)})
workbook(root / "sales.xlsx")
_minimal_docx(root / "report.docx", ["Quarterly report DRAFT", "Revenue grew in every region.", "Contact: TBD"])
print(json.dumps({"orders": ORDERS, "rates": RATES}))
`);
const FINISH_ORDERS = python(
  "import json; from test_sheets import FINISH_ORDERS; print(json.dumps(FINISH_ORDERS))",
);

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

  /* --- this computer, connected, with files allowed in one folder ---------- */
  const connecting = spawn(
    PYTHON,
    [
      "jarvis-runtime/ocade_device.py",
      "connect",
      "--server",
      BASE,
      "--no-browser",
      "--name",
      "Office PC",
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

  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Devices" })
    .click();
  const files = page.getByRole("switch", { name: /Files in the workspace/ });
  await until(() => files.isEnabled(), 30_000);
  await files.click();
  await until(async () => (await files.getAttribute("aria-checked")) === "true");
  const commands = page.getByRole("switch", { name: /Run commands in the work folder/ });
  const terminal = await commands.isEnabled();
  if (terminal) {
    await commands.click();
    await until(async () => (await commands.getAttribute("aria-checked")) === "true");
  }
  await page.getByRole("button", { name: "Close", exact: true }).first().click();

  /* --- the request: structure first, then one edit each, then the result --- */
  await script("office-check", [
    {
      tool: "start_task",
      args: {
        title: "Finish the sales workbook and report",
        where: "computer",
        steps: ["Look at the workbook", "Finish the orders", "Finish the report"],
      },
    },
    { tool: "computer", args: { action: "sheet_inspect", path: "sales.xlsx", step: 0 } },
    {
      tool: "computer",
      args: {
        action: "sheet_edit",
        path: "sales.xlsx",
        sheet: "Orders",
        ops: FINISH_ORDERS,
        step: 1,
      },
    },
    {
      tool: "computer",
      args: {
        action: "doc_edit",
        path: "report.docx",
        step: 2,
        ops: [
          { op: "replace", find: "DRAFT", with: "Q3 2026" },
          { op: "replace", find: "TBD", with: "finance@example.com" },
          { op: "style", find: "Quarterly report", style: "Title" },
          { op: "append", text: "Regional results", style: "Heading 1" },
          {
            op: "table",
            rows: [["Region", "Units"], ...rows.orders.map((o) => [o[0], String(o[2])])],
          },
        ],
      },
    },
    {
      tool: "finish_task",
      args: { outcome: "completed", result: "Workbook and report finished." },
    },
  ]);
  await page.locator("#jarvis-composer").fill("office-check finish my sales workbook and report");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  const task = async () =>
    (await table("jarvis_tasks", `user_id=eq.${USER}&order=created_at.desc`))[0];
  check(
    "JARVIS finishes the task on the computer",
    await until(async () => (await task())?.status === "completed", 240_000),
    JSON.stringify(await task()).slice(0, 300) + deviceLog.slice(-300),
  );
  const activity = await table(
    "jarvis_activity",
    `user_id=eq.${USER}&order=created_at.asc&select=status,summary,action`,
  );
  const summaries = activity.map((row) => String(row.summary ?? ""));
  check(
    "it looked at the workbook's structure before changing it",
    summaries.some((s) => s.startsWith("Inspected sales.xlsx")),
    summaries.join(" | ").slice(0, 400),
  );
  check(
    "the workbook was changed in the person's Excel, not by rewriting the file",
    summaries.some((s) => /Updated sales\.xlsx \(\d+ changes, in Excel\)/.test(s)),
  );
  check(
    "the report was changed in Word",
    summaries.some((s) => /Updated report\.docx in Word/.test(s)),
  );
  check(
    "the person sees it done in the conversation",
    await until(async () => (await page.getByText("Workbook and report finished.").count()) > 0),
  );

  /* --- the files themselves --------------------------------------------------- */
  const book = python(`
import json
from openpyxl import load_workbook
p = ${JSON.stringify(path.join(workspace, "sales.xlsx"))}
v = load_workbook(p, data_only=True)["Orders"]
f = load_workbook(p)
o = f["Orders"]
print(json.dumps({
  "revenue": v["E8"].value, "tax": v["F8"].value,
  "e7": o["E7"].value, "f2": o["F2"].value, "e8": o["E8"].value,
  "header": o["A1"].fill.fgColor.rgb, "headerBold": o["A1"].font.b,
  "money": o["E3"].number_format, "border": o["C4"].border.left.style,
  "rules": len(o.conditional_formatting._cf_rules), "freeze": o.freeze_panes,
  "notes": f["Notes"]["A1"].value, "notesBold": f["Notes"]["A1"].font.b,
  "notesFormula": f["Notes"]["B2"].value, "sheets": f.sheetnames}))
`);
  const rate = Object.fromEntries(rows.rates);
  const revenue = rows.orders.reduce((sum, [, , units, price]) => sum + units * price, 0);
  const tax = rows.orders.reduce(
    (sum, [region, , units, price]) => sum + units * price * rate[region],
    0,
  );
  check(
    "Excel calculated the totals, saved in the file",
    Math.abs(book.revenue - revenue) < 1e-9 && Math.abs(book.tax - tax) < 1e-6,
    `${book.revenue} ${book.tax} (expected ${revenue} ${tax})`,
  );
  check(
    "as formulas filled down and a lookup, not typed numbers",
    book.e7 === "=C7*D7" &&
      book.f2 === "=E2*VLOOKUP(A2,Rates!$A$2:$B$5,2,FALSE)" &&
      book.e8 === "=SUM(E2:E7)",
    `${book.e7} ${book.f2} ${book.e8}`,
  );
  check(
    "formatted: header, currency, borders, a highlight rule, frozen header row",
    /1F4E79$/i.test(String(book.header)) &&
      book.headerBold === true &&
      String(book.money).includes("#,##0.00") &&
      book.border === "thin" &&
      book.rules === 1 &&
      book.freeze === "A2",
    JSON.stringify(book),
  );
  check(
    "and the rest of the workbook is exactly as it was",
    book.notes === "Prepared by finance" &&
      book.notesBold === true &&
      book.notesFormula === "=1+1" &&
      book.sheets.join(",") === "Orders,Rates,Notes",
  );
  const report = python(`
import json, ocade_documents
from pathlib import Path
text, _ = ocade_documents.extract_text(Path(${JSON.stringify(path.join(workspace, "report.docx"))}), 30_000)
print(json.dumps({"text": text}))
`).text;
  check(
    "the report says what was asked, and nothing it replaced is left",
    report.includes("Quarterly report Q3 2026") &&
      report.includes("finance@example.com") &&
      report.includes("Regional results") &&
      rows.orders.every(([region]) => report.includes(region)) &&
      !report.includes("DRAFT") &&
      !report.includes("TBD"),
    report.slice(0, 300),
  );

  /* --- a real bug in a real repository: test, read, fix, test again ------------ */
  if (!terminal) {
    process.stdout.write("BLOCKED  code fix — this computer offers no confined commands\n");
  } else {
    const repo = path.join(workspace, "invoice");
    mkdirSync(repo);
    const BUGGY = [
      "def total(items, discount=0.0):",
      "    # Sum of price x quantity, less a discount given as a rate (0.1 is 10%).",
      "    subtotal = sum(price * quantity for price, quantity in items)",
      "    return round(subtotal - discount, 2)",
      "",
    ].join("\n");
    const FIXED = BUGGY.replace("subtotal - discount", "subtotal * (1 - discount)");
    const TESTS = [
      "import unittest",
      "from invoice import total",
      "",
      "class Total(unittest.TestCase):",
      "    def test_discount_is_a_rate(self):",
      "        self.assertEqual(total([(10.0, 3), (5.5, 2)], discount=0.1), 36.9)",
      "",
      "    def test_no_discount(self):",
      "        self.assertEqual(total([(10.0, 3)]), 30.0)",
      "",
    ].join("\n");
    writeFileSync(path.join(repo, "invoice.py"), BUGGY);
    writeFileSync(path.join(repo, "test_invoice.py"), TESTS);
    const git = (...args) =>
      spawnSync(
        "git",
        ["-c", "user.name=OCADE proof", "-c", "user.email=proof@ocade.test", ...args],
        {
          cwd: repo,
          encoding: "utf8",
        },
      );
    git("init", "-q");
    git("add", ".");
    git("commit", "-qm", "Invoice totals");
    await script("code-check", [
      {
        tool: "start_task",
        args: {
          title: "Fix the failing invoice test",
          where: "computer",
          steps: ["Run the tests", "Find the bug", "Fix it", "Run the tests again"],
        },
      },
      {
        tool: "computer",
        args: { action: "run", command: "python -m unittest -v", cwd: "invoice", step: 0 },
      },
      { tool: "computer", args: { action: "file_read", path: "invoice/invoice.py", step: 1 } },
      {
        tool: "computer",
        args: { action: "file_write", path: "invoice/invoice.py", content: FIXED, step: 2 },
      },
      {
        tool: "computer",
        args: { action: "run", command: "python -m unittest -v", cwd: "invoice", step: 3 },
      },
      {
        tool: "computer",
        args: { action: "run", command: "git diff --stat", cwd: "invoice", step: 3 },
      },
      { tool: "finish_task", args: { outcome: "completed", result: "The discount bug is fixed." } },
    ]);
    const before = (await table("jarvis_activity", `user_id=eq.${USER}&select=id`)).length;
    await page.locator("#jarvis-composer").fill("code-check the invoice test fails, fix it");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    check(
      "JARVIS finishes the fix",
      await until(
        async () =>
          (await task())?.status === "completed" &&
          (await task())?.title === "Fix the failing invoice test",
        180_000,
      ),
      JSON.stringify(await task()).slice(0, 300) + deviceLog.slice(-300),
    );
    const runs = (
      await table(
        "jarvis_activity",
        `user_id=eq.${USER}&order=created_at.asc&select=summary,result,action`,
      )
    )
      .slice(before)
      .filter((row) => row.action?.action === "run");
    // What the computer reported back: exit code and the program's own output.
    const ran = (row) => row?.result?.detail ?? {};
    const outputOf = (row) => `${ran(row).stdout ?? ""}${ran(row).stderr ?? ""}`;
    check(
      "the tests were run first and failed on the bug",
      ran(runs[0]).exitCode === 1 && /FAIL: test_discount_is_a_rate/.test(outputOf(runs[0])),
      JSON.stringify(runs[0]?.result ?? {}).slice(0, 300),
    );
    check(
      "after the fix they pass",
      ran(runs[1]).exitCode === 0 && /Ran 2 tests[\s\S]*OK/.test(outputOf(runs[1])),
      JSON.stringify(runs[1]?.result ?? {}).slice(0, 300),
    );
    check(
      "the change is exactly the fix, in the repository's own history",
      /invoice\.py \| 2 \+-/.test(outputOf(runs[2] ?? {})) &&
        git("status", "--porcelain").stdout.trim() === "M invoice.py",
      outputOf(runs[2] ?? {}).slice(0, 200),
    );
    const again = spawnSync(PYTHON, ["-m", "unittest"], { cwd: repo, encoding: "utf8" });
    check(
      "and the tests pass when run here, outside JARVIS",
      again.status === 0,
      again.stderr.slice(-200),
    );
  }
} catch (error) {
  check("the office journey runs", false, String(error).slice(0, 600));
} finally {
  device?.kill();
  await browser.close();
  // Close only what this journey opened; the person's own workbooks and documents stay.
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `foreach ($name in 'Excel.Application','Word.Application') {
         try { $app = [Runtime.InteropServices.Marshal]::GetActiveObject($name) } catch { continue }
         $excel = $name -like 'Excel*'
         $open = @(if ($excel) { $app.Workbooks } else { $app.Documents })
         foreach ($item in $open) { if ($item.FullName -like '${workspace.replace(/'/g, "''")}*') { $item.Close($false) } }
         $left = if ($excel) { $app.Workbooks.Count } else { $app.Documents.Count }
         if ($left -eq 0) { $app.Quit() }
       }`,
    ],
    { stdio: "ignore" },
  );
}

process.stdout.write(
  failures === 0 ? "\nOffice journey passed.\n" : `\n${failures} office checks failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
