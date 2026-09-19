import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE PROOF THAT AN ERASURE HAPPENED, WHICH WAS NEVER WRITTEN.
 *
 * `deleteMyAccount` ends by writing one line to `compliance_audit_log`, and the
 * comment above it explains that `user_id` is `ON DELETE SET NULL` so the line
 * survives the identity deletion with its subject removed. That is true of a row
 * that already exists when the user is deleted. This row is written AFTERWARDS,
 * and it named the user who had just been deleted — so the foreign key refused
 * the insert, every time, and the `catch` beside it swallowed the refusal.
 *
 * The result was a deletion record that could not exist: no evidence an erasure
 * was carried out, and nothing anywhere saying so. Exactly the outcome a
 * best-effort `catch` is written to tolerate, on a path where the thing being
 * tolerated never worked at all.
 *
 * `ON DELETE SET NULL` is the constraint, so `null` is what the row must carry.
 */
let twin: DatabaseTwin;

const GONE = "55555555-eeee-4eee-8eee-555555555555";

const insertAudit = (userId: string | null) =>
  twin.asServiceRole(
    `insert into public.compliance_audit_log (user_id, action, category, feature_id, result)
     values (${userId === null ? "null" : `'${userId}'`}, 'account.deleted', 'deletion',
             'settings.account', '{"reference":"OCD-TEST"}'::jsonb)`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((migration) => !migration.ok).map((migration) => migration.file)).toEqual(
    [],
  );
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${GONE}', 'erased@invalid.test')
     on conflict (id) do nothing`,
  );
}, 180_000);

afterAll(async () => {
  await twin?.close();
});

describe("the line that outlives the account", () => {
  it("cannot name a user who has already been deleted", async () => {
    await twin.execSuperuser(`delete from auth.users where id = '${GONE}'`);

    // The defect, exactly: the insert the handler used to make.
    await expect(insertAudit(GONE)).rejects.toThrow(/foreign key|violates/i);
  });

  it("is accepted with no subject, which is the state the constraint describes", async () => {
    await insertAudit(null);
    const rows = await twin.asServiceRole<{ user_id: string | null; action: string }>(
      `select user_id, action from public.compliance_audit_log where action = 'account.deleted'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBeNull();
  });

  it("is what the handler actually writes", () => {
    const source = readFileSync("src/lib/account.functions.ts", "utf8");
    const insert = source.slice(source.indexOf('.from("compliance_audit_log")'));
    expect(insert.slice(0, 300)).toContain("user_id: null");
    // And it still carries the reference, which is the whole point of the row.
    expect(insert.slice(0, 400)).toContain("reference: receipt.reference");
  });
});
