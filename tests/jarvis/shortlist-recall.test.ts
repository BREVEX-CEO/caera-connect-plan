/**
 * Shortlist recall (plan §23.4, target ≥98%): for varied requests across the §19 categories,
 * the operations a correct first plan needs must be among the ≤12 offered after the first
 * look at the folder. Labels are a person's judgement of what each request minimally needs,
 * written before measuring; the shortlist never sees them. The rate and every miss are
 * printed so a regression shows exactly which request lost which tool.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { offeredOperations, shortlistOperations } from "../../src/lib/jarvis/planner.server.ts";

const ALL = ["files", "browser", "apps", "screen", "computer_control"];
type Case = [objective: string, folder: string[], needed: string[]];

const CASES: Case[] = [
  // Files and documents
  [
    "Sort the photos in here into one folder per year",
    ["a.jpg", "b.jpg", "c.png"],
    ["fs.manage", "fs.list"],
  ],
  ["Move every PDF into a folder called Invoices", ["x.pdf", "y.pdf", "notes.txt"], ["fs.manage"]],
  [
    "Delete the duplicate copies of my reports, keep one of each",
    ["r.docx", "r (1).docx"],
    ["fs.manage", "fs.read_text"],
  ],
  ["Rename the scans so they start with the date", ["scan1.pdf", "scan2.pdf"], ["fs.manage"]],
  [
    "The report.docx is corrupted, recover what you can into a new document",
    ["report.docx"],
    ["fs.read_text", "office.write_document"],
  ],
  [
    "Reconcile bank.xlsx against ledger.xlsx and list the differences in a workbook",
    ["bank.xlsx", "ledger.xlsx"],
    ["office.inspect_workbook", "office.write_workbook"],
  ],
  [
    "Produce an editable financial report from Q3 figures.csv",
    ["Q3 figures.csv"],
    ["fs.read_text", "office.write_document"],
  ],
  [
    "Pull every email address out of these files into a CSV",
    ["a.txt", "b.docx", "c.pdf"],
    ["fs.read_text", "fs.write_text"],
  ],
  [
    "Fix the typo in config.yaml where port is written as prot",
    ["config.yaml"],
    ["fs.read_text", "fs.edit_text"],
  ],
  [
    "Make the script run.sh executable and fix its line endings",
    ["run.sh"],
    ["fs.read_text", "fs.manage"],
  ],
  [
    "Summarise meeting-notes.md into a one-page Word document",
    ["meeting-notes.md"],
    ["fs.read_text", "office.write_document"],
  ],
  [
    "Total the second column of sales.csv and save it in total.txt",
    ["sales.csv"],
    ["fs.read_text", "fs.write_text"],
  ],
  ["Convert data.yaml to JSON", ["data.yaml"], ["fs.read_text", "fs.write_text"]],
  // System and software
  ["My program will not start, find out why", ["app.log"], ["system.diagnose", "fs.read_text"]],
  ["Which process is using port 8080 and what is it?", [], ["system.diagnose"]],
  ["Check whether python and node are installed and which versions", [], ["system.inspect"]],
  ["Install the missing ffmpeg so the video export works", [], ["system.inspect", "shell.run"]],
  ["Run the test suite and tell me which tests fail", ["tests", "package.json"], ["shell.run"]],
  [
    "Render the project with the export script, it takes about an hour",
    ["export.sh"],
    ["job.start", "job.status"],
  ],
  ["Show me what crashed on this computer today", [], ["system.diagnose"]],
  ["Run this PowerShell command to list my services", [], ["shell.run"]],
  // Browser
  [
    "Find the opening hours on example.com and put them in a note",
    [],
    ["web.open", "web.read", "fs.write_text"],
  ],
  [
    "Fill in the contact form on the test site with my details from details.txt",
    ["details.txt"],
    ["web.open", "web.fill", "fs.read_text"],
  ],
  ["Download the latest invoice from the billing site", [], ["web.open", "web.download"]],
  ["Upload report.pdf to the portal", ["report.pdf"], ["web.open", "web.upload"]],
  [
    "Compare prices on two tabs of the shop site and tell me the cheaper",
    [],
    ["web.open", "web.read"],
  ],
  // Media and design
  [
    "Cut a 30 second cinematic advert from car footage with music and sound effects",
    ["drive.mp4", "music.mp3"],
    ["media.render_timeline", "media.analyze", "media.preview"],
  ],
  [
    "Trim the first ten seconds off interview.mp4",
    ["interview.mp4"],
    ["media.trim", "media.inspect"],
  ],
  [
    "Look at chart.png and describe the trend in a note",
    ["chart.png"],
    ["media.preview", "fs.write_text"],
  ],
  [
    "Design a red and black 3D sports car and give me a 4K image of it",
    [],
    ["scene.render", "media.preview"],
  ],
  ["How long is the voiceover and what format is it?", ["voiceover.wav"], ["media.inspect"]],
  // Desktop applications and robustness
  [
    "In the Zorblax Pro window, press the Export button",
    [],
    ["apps.list", "ui.inspect", "ui.invoke"],
  ],
  ["Open Notepad and type a shopping list", [], ["apps.launch", "ui.set_value"]],
  ["Close the popup that keeps appearing in the accounting app", [], ["ui.inspect", "ui.invoke"]],
  ["Change the zoom setting in the drawing program to 150%", [], ["ui.inspect", "ui.set_value"]],
  [
    "Click the canvas tool that has no label in the paint app",
    [],
    ["ui.inspect", "ui.click_point"],
  ],
  ["Press Ctrl+S in the editor window to save", [], ["ui.send_keys"]],
  [
    "Open the unknown app Qwrtz and tell me what its main window shows",
    [],
    ["apps.list", "ui.inspect"],
  ],
  ["Restart the stuck backup job and watch it finish", [], ["job.status", "job.start"]],
  ["Stop the render you started earlier", [], ["job.cancel"]],
];

/**
 * Written after the ranking words were chosen and never used to tune them: the honest
 * measure. Tuning on these would turn them into a second training set.
 */
const HELD_OUT: Case[] = [
  [
    "Put all the screenshots from last week into a new folder named Week 44",
    ["s1.png", "s2.png"],
    ["fs.manage"],
  ],
  ["Get rid of the empty temp files in this folder", ["t1.tmp", "t2.tmp"], ["fs.manage"]],
  ["What does the error at the bottom of server.log mean?", ["server.log"], ["fs.read_text"]],
  [
    "Turn budget.csv into a proper Excel workbook with a totals row",
    ["budget.csv"],
    ["fs.read_text", "office.write_workbook"],
  ],
  [
    "Write a cover letter as a Word file using the facts in cv.txt",
    ["cv.txt"],
    ["fs.read_text", "office.write_document"],
  ],
  ["Lock settings.ini so nothing can change it by accident", ["settings.ini"], ["fs.manage"]],
  [
    "Replace every tab with two spaces in layout.py",
    ["layout.py"],
    ["fs.read_text", "fs.edit_text"],
  ],
  ["Is there enough disk space to unpack a 20 GB archive here?", [], ["system.inspect"]],
  ["Something is eating all my memory, which program is it?", [], ["system.diagnose"]],
  ["Build the website project with npm, it can take a while", ["package.json"], ["job.start"]],
  ["Has the build I started finished yet?", [], ["job.status"]],
  ["Use cmd to print the Windows version", [], ["shell.run"]],
  ["Check the train times on rail.example.org for tomorrow morning", [], ["web.open", "web.read"]],
  [
    "Sign in to the supplier portal and download the October statement",
    [],
    ["web.open", "web.download"],
  ],
  ["Choose the express shipping option on the checkout page", [], ["web.select"]],
  ["Take a picture of the dashboard page for my records", [], ["web.open", "web.screenshot"]],
  ["Make the product video 15 seconds long by cutting the end", ["product.mp4"], ["media.trim"]],
  ["What resolution is banner.jpg?", ["banner.jpg"], ["media.inspect"]],
  [
    "Edit the holiday clips into a two minute film with music",
    ["c1.mov", "c2.mov", "song.mp3"],
    ["media.render_timeline"],
  ],
  ["Model a simple wooden chair in 3D and render it", [], ["scene.render"]],
  ["In the invoicing program, set the tax rate field to 20", [], ["ui.inspect", "ui.set_value"]],
  [
    "Tick the 'remember me' box in the open login window of the app",
    [],
    ["ui.inspect", "ui.invoke"],
  ],
  ["Start the calculator application", [], ["apps.launch"]],
  ["Find out which apps are open right now", [], ["apps.list"]],
  [
    "The export button in the design tool has no name, click it",
    [],
    ["ui.inspect", "ui.click_point"],
  ],
];

function recall(cases: Case[]) {
  const usable = offeredOperations(ALL, null);
  let needed = 0;
  const misses: string[] = [];
  for (const [objective, folder, wanted] of cases) {
    const look = {
      intent: { operation: "fs.list" },
      status: "done",
      receipt: { status: "observed", evidence: { entries: folder.map((name) => ({ name })) } },
    };
    const offered = shortlistOperations(usable, { objective, checks: [], steps: [look] as never });
    assert.ok(offered.length <= 12, objective);
    for (const operation of wanted) {
      needed += 1;
      if (!offered.includes(operation as never)) misses.push(`${operation} <- ${objective}`);
    }
  }
  return { cases: cases.length, needed, recall: (needed - misses.length) / needed, misses };
}

test("shortlist recall over the §19 categories is at least 98%", () => {
  const tuning = recall(CASES);
  const heldOut = recall(HELD_OUT);
  console.log(`OCADE_SHORTLIST_RECALL:${JSON.stringify({ tuning, heldOut })}`);
  assert.ok(
    tuning.recall >= 0.98,
    `recall ${tuning.recall.toFixed(3)}; missing:\n${tuning.misses.join("\n")}`,
  );
  // The held-out rate is the measure reported in plan.md; it may not fall below 90%.
  assert.ok(
    heldOut.recall >= 0.9,
    `held-out recall ${heldOut.recall.toFixed(3)}: ${heldOut.misses}`,
  );
});
