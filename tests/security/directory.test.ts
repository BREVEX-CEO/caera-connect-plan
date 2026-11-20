/**
 * Apps & Websites (plan 14E.6, REPO-19): the directory lists only real resources with their true
 * state, and accounts are findable but never offered as connectable before an integration exists.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCOUNT_SERVICES, directory, search } from "../../src/lib/jarvis/directory.ts";

const devices = [
  {
    id: "d1",
    name: "Work PC",
    installed_apps: [
      { name: "Microsoft Excel", exe: "excel.exe" },
      { name: "Microsoft Excel", exe: "excel.exe" },
      { name: "Blender", exe: "blender.exe" },
    ],
    capabilities: { mcp: [{ id: "github", publisher: "GitHub", tools: [{}, {}] }] },
  },
];

test("entries come only from what the computer reports and what the person allowed", () => {
  const all = directory(devices, new Map([["d1", ["app:excel.exe", "site:example.com"]]]), [
    { name: "weekly", title: "Weekly" },
  ]);
  const of = (kind: string) => all.filter((e) => e.kind === kind);
  assert.deepEqual(
    of("app").map((e) => [e.detail, e.state]),
    [
      ["excel.exe", "allowed"],
      ["blender.exe", "needs_permission"],
    ],
  );
  assert.deepEqual(
    of("website").map((e) => e.name),
    ["example.com"],
  );
  assert.equal(of("tools")[0]!.state, "approved");
  assert.equal(of("tools")[0]!.detail, "GitHub · 2 tools");
  assert.equal(of("skill")[0]!.name, "/weekly");
  assert.equal(of("account").length, ACCOUNT_SERVICES.length);
  assert.ok(
    of("account").every((e) => e.state === "not_available"),
    "no fake Connect state",
  );
});

test("search matches every word across name, detail and computer", () => {
  const all = directory(devices, new Map(), []);
  assert.deepEqual(
    search(all, "excel work").map((e) => e.name),
    ["Microsoft Excel"],
  );
  assert.deepEqual(
    search(all, "email").map((e) => e.name),
    ["Gmail"],
  );
  assert.equal(search(all, "").length, all.length);
});
