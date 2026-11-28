/** ADMIN-04 and ADMIN-05: exports are redacted, approved by a second person and expire; break-glass is two-person and time-bound. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  issueGrant,
  redactForExport,
  retentionDeadline,
  verifyGrant,
} from "../../src/lib/admin/dual-control.ts";

const secret = "s".repeat(40);
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const now = 1_000_000;
const base = {
  kind: "break_glass",
  scope: "jarvis_agent",
  requester: a,
  approver: b,
  ttlMs: 600_000,
  now,
} as const;
const expected = {
  kind: "break_glass",
  scope: "jarvis_agent",
  requester: a,
  now: now + 1,
} as const;

test("a second person's approval is accepted once and only for its scope", () => {
  const token = issueGrant(base, secret);
  assert.equal(verifyGrant(token, expected, secret).approver, b);
  assert.throws(
    () => verifyGrant(token, { ...expected, scope: "jarvis_execution" }, secret),
    /not valid/,
  );
  assert.throws(() => verifyGrant(token, { ...expected, requester: b }, secret), /not valid/);
  assert.throws(
    () => verifyGrant(token, { ...expected, kind: "audit_export" }, secret),
    /not valid/,
  );
});

test("nobody approves their own request", () => {
  assert.throws(() => issueGrant({ ...base, approver: a }, secret), /second person/);
});

test("break-glass expires and cannot be issued for longer than an hour", () => {
  const token = issueGrant(base, secret);
  assert.throws(() => verifyGrant(token, { ...expected, now: now + 600_001 }, secret), /expired/);
  assert.throws(() => issueGrant({ ...base, ttlMs: 3_600_001 }, secret), /too long/);
  assert.throws(() => issueGrant({ ...base, ttlMs: 0 }, secret), /too long/);
});

test("a tampered or foreign-signed token is refused", () => {
  const token = issueGrant(base, secret);
  const [payload, mac] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(payload!, "base64url").toString()),
      expiresAt: now + 9e9,
    }),
  ).toString("base64url");
  assert.throws(() => verifyGrant(`${forged}.${mac}`, expected, secret), /not valid/);
  assert.throws(() => verifyGrant(token, expected, "x".repeat(40)), /not valid/);
  assert.throws(() => verifyGrant("garbage", expected, secret), /not valid/);
  assert.throws(() => issueGrant(base, "short"), /not configured/);
});

test("export redaction hides secret fields, secret values, emails and long digit runs", () => {
  const out = redactForExport({
    action: "grant",
    apiKey: "abc",
    nested: {
      authorization: "Bearer x",
      note: "mail ana@example.com card 4111 1111 1111 1111 key AKIAABCDEFGHIJKLMNOP",
    },
    list: [{ session_token: "t" }, "ok"],
    count: 3,
  });
  assert.deepEqual(out, {
    action: "grant",
    apiKey: "[redacted]",
    nested: {
      authorization: "[redacted]",
      note: "mail ***@example.com card [redacted] key [redacted]",
    },
    list: [{ session_token: "[redacted]" }, "ok"],
    count: 3,
  });
});

test("an export is kept for seven days", () => {
  assert.equal(retentionDeadline(Date.UTC(2026, 10, 1)), "2026-11-08T00:00:00.000Z");
});

test("the export and the break-glass server functions check a grant and write the record", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/lib/admin/staff.functions.ts", "utf8");
  for (const name of ["exportAudit", "breakGlassServiceControl"]) {
    const body = source.slice(source.indexOf(`export const ${name}`));
    const end = body.indexOf("\nexport const", 10);
    const part = end > 0 ? body.slice(0, end) : body;
    assert.match(part, /verifyGrant\(/, `${name} verifies a second person's approval`);
    assert.match(part, /ocade_admin_actions/, `${name} writes the record`);
    assert.match(part, /requireAssurance\(HIGH_RISK\)/, `${name} needs a recent second factor`);
  }
  assert.match(source, /redactForExport\(rows\)/);
});
