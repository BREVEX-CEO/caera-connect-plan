/** FRONTEND-02: the public bundle scanner fails on a secret-shaped string and a server-only name, and passes a clean bundle. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scan = (content: string) => {
  const dir = mkdtempSync(join(tmpdir(), "ocade-bundle-"));
  try {
    writeFileSync(join(dir, "app.js"), content);
    return spawnSync(process.execPath, ["scripts/scan-bundle-secrets.mjs", dir], {
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("a clean bundle passes", () => {
  assert.equal(scan('console.log("hello");').status, 0);
});

test("a service-role key, a private key block and a server-only name each fail the scan", () => {
  const serviceRole = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", iss: "supabase" })}.abcdefghijklmnop`;
  assert.notEqual(scan(`const k="${serviceRole}"`).status, 0, "service-role JWT");
  assert.notEqual(
    scan('const k="-----BEGIN PRIVATE KEY-----\\nabc"').status,
    0,
    "private key block",
  );
  assert.notEqual(scan("process.env.SUPABASE_SERVICE_ROLE_KEY").status, 0, "server-only name");
});

test("a publishable (anon-role) key is allowed in the bundle", () => {
  const anon = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "anon", iss: "supabase" })}.abcdefghijklmnop`;
  assert.equal(scan(`const k="${anon}"`).status, 0);
});
