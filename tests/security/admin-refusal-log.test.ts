/** ADMIN-08: a refused staff or support change is logged with who tried and why it was refused. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { logRefusedChange } from "../../src/lib/admin/refusal-log.ts";

test("a refusal is one structured line naming the actor and the sentence, nothing else", () => {
  const lines: string[] = [];
  const warn = console.warn;
  console.warn = (line: string) => void lines.push(line);
  try {
    logRefusedChange("staff", "11111111-1111-4111-8111-111111111111", "Nobody grants themselves.");
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(JSON.parse(lines[0]!), {
    event: "admin_change_refused",
    area: "staff",
    actor: "11111111-1111-4111-8111-111111111111",
    sentence: "Nobody grants themselves.",
  });
});

test("both refusal translators log, and every caller names the actor", () => {
  for (const [file, name] of [
    ["src/lib/admin/staff.functions.ts", "staffFailure"],
    ["src/lib/admin/access.functions.ts", "adminFailure"],
  ] as const) {
    const source = readFileSync(file, "utf8");
    const body = source.slice(source.indexOf(`function ${name}(`));
    assert.match(body.slice(0, body.indexOf("\n}\n")), /logRefusedChange\(/, `${name} logs`);
    const calls = source.match(new RegExp(`${name}\\([^)]*\\)`, "g")) ?? [];
    assert.ok(calls.length > 1);
    for (const call of calls.filter((call) => !call.includes("message: string")))
      assert.match(call, /context\.userId/, `${file}: ${call}`);
  }
});
