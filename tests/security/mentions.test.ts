/**
 * The JARVIS @ picker (plan 14E.3): finds the typed @word, ranks a computer's apps with allowed
 * ones first, and inserts exactly the `@exe` form the planner and the database read to limit a
 * task. Naming an app grants nothing; that is the authority's check (`jarvis_app_in_scope`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { insertMention, mentionQuery, rankApps } from "../../src/lib/jarvis/mentions.ts";

const APPS = [
  { name: "Microsoft Excel", exe: "excel.exe" },
  { name: "Microsoft PowerPoint", exe: "powerpnt.exe" },
  { name: "Notepad", exe: "notepad.exe" },
  { name: "Notepad", exe: "notepad.exe" },
  { name: "Visual Studio Code", exe: "code.exe" },
];

test("only an @ that starts a word, right before the caret, opens the list", () => {
  assert.deepEqual(mentionQuery("open @exc", 9), { start: 5, query: "exc" });
  assert.deepEqual(mentionQuery("@", 1), { start: 0, query: "" });
  assert.equal(mentionQuery("mail me@example", 15), null);
  assert.equal(mentionQuery("open @excel now", 15), null);
  assert.deepEqual(mentionQuery("open @excel now", 11), { start: 5, query: "excel" });
});

test("allowed apps come first, matches rank by quality, duplicates appear once", () => {
  const allowed = new Set(["app:notepad.exe"]);
  const all = rankApps(APPS, allowed, "");
  assert.equal(all[0]!.exe, "notepad.exe");
  assert.equal(all[0]!.allowed, true);
  assert.equal(all.filter((app) => app.exe === "notepad.exe").length, 1);
  assert.deepEqual(
    rankApps(APPS, new Set(), "ex").map((app) => app.exe),
    ["excel.exe"],
  );
  // Letters in order find an app whose name does not start with them.
  assert.ok(rankApps(APPS, new Set(), "pwpt").some((app) => app.exe === "powerpnt.exe"));
  assert.ok(rankApps(APPS, new Set(), "studio").some((app) => app.exe === "code.exe"));
  assert.deepEqual(rankApps(APPS, new Set(), "zzz"), []);
});

test("a pick replaces the typed word with @exe and a space, keeping the rest", () => {
  assert.deepEqual(insertMention("open @exc and sum B", 5, 9, "excel.exe"), {
    text: "open @excel.exe and sum B",
    caret: 16,
  });
  assert.deepEqual(insertMention("@", 0, 1, "notepad.exe"), { text: "@notepad.exe ", caret: 13 });
});

test("the inserted form is the one the task scope reads", () => {
  // Same rule as taskApps / jarvis_app_in_scope: @exe followed by the end or a character no
  // app name has.
  const { text } = insertMention("total in @ex", 10, 12, "excel.exe");
  const at = text.indexOf("@excel.exe");
  assert.ok(at >= 0);
  assert.doesNotMatch(text.charAt(at + "@excel.exe".length), /[a-z0-9._()+-]/);
});
