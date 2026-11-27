/** SUPPLY-03: a compromised CI job starts with the least privilege and never runs fork code with secrets. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const folder = ".github/workflows";
const workflows = readdirSync(folder)
  .filter((name) => name.endsWith(".yml"))
  .map((name) => ({ name, text: readFileSync(`${folder}/${name}`, "utf8") }));

test("there are workflows to check", () => {
  assert.ok(workflows.length >= 6);
});

test("every workflow's default token is read-only contents", () => {
  for (const { name, text } of workflows) {
    const block = /^permissions:\n((?: {2}\S.*\n)+)/m.exec(text);
    assert.ok(block, `${name} has no top-level permissions block`);
    assert.deepEqual(
      block[1]!
        .trim()
        .split("\n")
        .map((line) => line.trim()),
      ["contents: read"],
      name,
    );
  }
});

test("no workflow gives a job a write permission or runs forked code with the base secrets", () => {
  for (const { name, text } of workflows) {
    assert.doesNotMatch(text, /^\s+(?:[a-z-]+): write\s*$/m, `${name} grants a write permission`);
    assert.doesNotMatch(text, /pull_request_target/, `${name} uses pull_request_target`);
  }
});

test("every third-party action is pinned to a full commit", () => {
  for (const { name, text } of workflows) {
    for (const [, reference] of text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      if (reference!.startsWith("./")) continue;
      assert.match(reference!, /@[0-9a-f]{40}$/, `${name}: ${reference} is not pinned to a commit`);
    }
  }
});
