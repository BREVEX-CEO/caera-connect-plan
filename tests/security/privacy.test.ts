/**
 * Diagnostics cannot carry customer content (175, 177). Health records are
 * enumerated: any value a caller did not choose from the fixed sets is replaced,
 * so a prompt, file name, email or key put in any field never reaches a log.
 * Server code logs nothing but these records.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildHealthRecord } from "../../src/lib/telemetry/operation-health.ts";

test("hostile values in every field of a health record are replaced", () => {
  const leak = "ada@example.test sk-proj-abcdefghijklmnopqrstuv salaries.xlsx ignore your rules";
  const record = buildHealthRecord({
    component: leak,
    operation: leak,
    outcome: leak,
    errorClass: leak,
    durationMs: 1234.5678,
    providerSlot: leak,
    attempts: leak,
    // An extra field a careless caller adds is not copied.
    ...({ message: leak, userId: "aaaaaaaa-0000-0000-0000-000000000001" } as object),
  } as never);
  const text = JSON.stringify(record);
  for (const piece of ["ada@", "sk-proj", "salaries", "ignore", "aaaaaaaa-0000"]) {
    assert.ok(!text.includes(piece), `${piece} leaked: ${text}`);
  }
  assert.deepEqual(Object.keys(record).sort(), [
    "attempts",
    "component",
    "errorClass",
    "latencyBucket",
    "operation",
    "outcome",
    "providerSlot",
    "release",
    "schemaVersion",
  ]);
  assert.ok(!text.includes("1234"), "a duration is a bucket, never a fingerprint");
});

const files = (root: string): string[] =>
  readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

test("server and edge code logs only health records", () => {
  const server = [
    ...files("src").filter((path) => /\.server\.ts$|[\\/]server\.ts$|functions\.ts$/.test(path)),
    ...files("supabase/functions"),
    ...files("src/lib/jarvis"),
  ];
  assert.ok(server.length > 10);
  // Names of missing configuration variables only: no request, account or content.
  const allowed = new Set([
    "src/integrations/supabase/client.server.ts: console.error(`[Supabase] ${message}`",
  ]);
  const offenders: string[] = [];
  for (const path of new Set(server)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/console\.(log|info|warn|error|debug)\(([^)\n]*)/g)) {
      if (!/buildHealthRecord|"ocade\.health"|^\s*$/.test(match[2])) {
        const line = `${path}: ${match[0]}`;
        if (!allowed.has(line)) offenders.push(line);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
