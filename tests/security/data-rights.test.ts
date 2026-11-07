/**
 * Export and deletion cover everything an account owns (179). Every table that names an
 * account is either in a data class (exported, and deleted on request unless a stated
 * retention applies) or listed here with why it is not. A new table that names an account
 * fails this test until someone decides which.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACCOUNT_DATA_CLASSES } from "../../src/lib/account/data-classes.ts";

const NOT_EXPORTED: Record<string, string> = {
  compliance_audit_log: "security audit; kept without the account (ON DELETE SET NULL)",
  ocade_admin_actions: "staff actions about an account; kept without it (SET NULL)",
  ocade_staff: "staff membership, not customer data; removed with the account",
  user_roles: "authorisation roles; removed with the account",
  ocade_mfa_recovery_codes: "secret hashes, never exported; removed with the account",
  ocade_mfa_recovery_attempts: "rate-limit counters; removed with the account",
  ocade_generation_permits: "short-lived usage reservations; removed with the account",
  ocade_device_usage_keys: "offline-usage signing keys; removed with the account",
  ocade_device_usage_leases: "offline-usage leases; removed with the account",
  ocade_support_cases: "staff case records about the account; removed with it",
  ocade_support_shares: "time-limited shares the person made; removed with the account",
};

test("every table that names an account is exported or excluded with a reason", () => {
  const types = readFileSync(
    new URL("../../src/integrations/supabase/types.ts", import.meta.url),
    "utf8",
  );
  const tables = types.slice(types.indexOf("Tables: {"), types.indexOf("Views: {"));
  const owning = [...tables.matchAll(/^ {6}(\w+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}/gm)]
    .filter(([, , row]) => /^\s+(user_id|customer|target_user): /m.test(row))
    .map(([, name]) => name);
  assert.ok(owning.length > 30, `found ${owning.length}`);
  const exported = new Set(
    ACCOUNT_DATA_CLASSES.flatMap((entry) =>
      entry.tables.flatMap((table) => [table.table, ...(table.cascades ?? [])]),
    ),
  );
  const undecided = owning.filter((name) => !exported.has(name) && !(name in NOT_EXPORTED));
  assert.deepEqual(undecided, [], "decide: export it in a data class, or list why not");
  const stale = Object.keys(NOT_EXPORTED).filter(
    (name) => exported.has(name) || !owning.includes(name),
  );
  assert.deepEqual(stale, [], "an exclusion that no longer applies");
});
