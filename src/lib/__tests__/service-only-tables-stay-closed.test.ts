import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE TABLES A CUSTOMER MUST NEVER REACH, KEPT UNREACHABLE.
 *
 * Seven tables hold the things a person would rewrite if they could: the
 * generation permits that are the charge, the signed device leases that are
 * offline capacity, the keys those leases are verified with, the offline usage
 * ledger, and the recovery-code family.
 *
 * The live project closes them twice over, and the second one is the stronger:
 * row-level security is enabled with no policy, AND `authenticated` has no
 * table grant at all. Verified against the live database — a customer role
 * asking for `ocade_generation_permits` is refused with `42501` before RLS is
 * ever consulted, which is why Supabase's advisor reporting
 * `rls_enabled_no_policy` on all seven is the design working rather than a gap.
 *
 * THE FAILURE THIS PREVENTS is somebody "fixing" the advisor warning by adding
 * a policy or a grant, which would open exactly what the absence protects. A
 * future migration that grants one of these to `authenticated` or `anon` fails
 * here, with the reason attached.
 */
const SERVICE_ONLY = [
  "ocade_generation_permits",
  "ocade_device_usage_leases",
  "ocade_device_usage_keys",
  "ocade_offline_usage_allocations",
  "ocade_offline_usage_events",
  "ocade_mfa_recovery_codes",
  "ocade_mfa_recovery_attempts",
];

const MIGRATIONS = path.join("supabase", "migrations");

function everyMigration(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .map((file) => ({ file, sql: readFileSync(path.join(MIGRATIONS, file), "utf8") }));
}

describe("the tables only the server may touch", () => {
  it.each(SERVICE_ONLY)("never grant %s to a customer role", (table) => {
    const offenders = everyMigration()
      .filter(({ sql }) => {
        // `GRANT … ON <table> TO … authenticated|anon`, across line breaks.
        const grants = sql.matchAll(
          /grant\s+[\s\S]{0,200}?\bon\s+(?:table\s+)?([\w."]+)([\s\S]{0,200}?);/gi,
        );
        for (const [, target, tail] of grants) {
          if (!target.includes(table)) continue;
          if (/\b(authenticated|anon)\b/i.test(tail)) return true;
        }
        return false;
      })
      .map(({ file }) => file);

    expect(offenders, `${table} is granted to a customer role in: ${offenders.join(", ")}`).toEqual(
      [],
    );
  });

  it("covers every table the live advisor reports as policy-free", () => {
    // If a new service-only table appears, it belongs in the list above rather
    // than being quietly exempt from the rule.
    expect(SERVICE_ONLY).toHaveLength(7);
  });
});
