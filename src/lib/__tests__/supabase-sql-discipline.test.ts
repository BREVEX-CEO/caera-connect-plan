import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Supabase migration safety discipline — enforced across EVERY migration.
 *
 * The integration gate checks rollback/verification pairing only for the
 * migrations listed in `audit.unappliedMigrations` (currently 4 of 31). The
 * other 27 pairs are enforced by nothing: delete one, or add a new migration
 * without a pair, and no check notices. Since a migration without a rehearsed
 * rollback is a change you cannot safely undo on a production database, that
 * gap matters more than most.
 *
 * These tests hold ALL migrations to the discipline, and check the SQL is
 * actually usable rather than merely present.
 *
 * HONEST LIMIT: nothing here is executed against a database. This validates the
 * shape and safety of the SQL. Proving a rollback truly restores prior state
 * requires a live Supabase instance — an external prerequisite.
 */

const MIGRATIONS = "supabase/migrations";
const ROLLBACK = "supabase/rollback";
const VERIFICATION = "supabase/verification";

const sqlIn = (dir: string) => readdirSync(dir).filter((n) => n.endsWith(".sql"));
const read = (dir: string, name: string) => readFileSync(`${dir}/${name}`, "utf8");

const migrations = sqlIn(MIGRATIONS).map((n) => n.replace(/\.sql$/, ""));
const rollbacks = sqlIn(ROLLBACK);
const verifications = sqlIn(VERIFICATION);

/** Strip SQL comments so keyword checks do not match prose in a header. */
const code = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .toLowerCase();

describe("every migration is paired (all of them, not a subset)", () => {
  it("has migrations to check", () => {
    expect(migrations.length).toBeGreaterThan(25);
  });

  it("gives every migration a rollback", () => {
    const missing = migrations.filter((m) => !rollbacks.includes(`${m}_rollback.sql`));
    expect(missing).toEqual([]);
  });

  it("gives every migration a verification", () => {
    const missing = migrations.filter((m) => !verifications.includes(`${m}_verify.sql`));
    expect(missing).toEqual([]);
  });

  it("has no orphan rollback without a migration", () => {
    const orphans = rollbacks
      .map((n) => n.replace(/_rollback\.sql$/, ""))
      .filter((base) => !migrations.includes(base));
    expect(orphans).toEqual([]);
  });

  it("has no orphan verification without a migration", () => {
    const orphans = verifications
      .map((n) => n.replace(/_verify\.sql$/, ""))
      .filter((base) => !migrations.includes(base));
    expect(orphans).toEqual([]);
  });

  it("keeps the three directories the same size", () => {
    expect(rollbacks.length).toBe(migrations.length);
    expect(verifications.length).toBe(migrations.length);
  });
});

describe("rollbacks are safe to run", () => {
  it("is never an empty file", () => {
    const empty = rollbacks.filter((n) => read(ROLLBACK, n).trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("guards EVERY drop with IF EXISTS, so a partial rollback can be re-run", () => {
    // Re-running a rollback after a failure part-way through must not error on
    // an object that is already gone.
    const unguarded: string[] = [];
    for (const name of rollbacks) {
      const sql = code(read(ROLLBACK, name));
      for (const match of sql.matchAll(/\bdrop\s+(table|index|function|policy|trigger|type|view|sequence)\s+([\s\S]{0,20})/g)) {
        if (!match[2].includes("if exists")) unguarded.push(`${name}: drop ${match[1]}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("never drops a schema or database wholesale", () => {
    const catastrophic = rollbacks.filter((n) => {
      const sql = code(read(ROLLBACK, n));
      return /\bdrop\s+database\b/.test(sql) || /\bdrop\s+schema\s+(if\s+exists\s+)?public\b/.test(sql);
    });
    expect(catastrophic).toEqual([]);
  });

  it("wraps statement-bearing rollbacks in a transaction", () => {
    // A rollback that fails half-way must not leave the schema in between.
    const unwrapped: string[] = [];
    for (const name of rollbacks) {
      const sql = code(read(ROLLBACK, name));
      if (!/\bdrop\b|\balter\b|\brevoke\b|\bgrant\b/.test(sql)) continue; // documented no-op
      if (!/\bbegin\b/.test(sql) || !/\bcommit\b/.test(sql)) unwrapped.push(name);
    }
    expect(unwrapped).toEqual([]);
  });

  it("explains itself — every rollback carries a comment", () => {
    const undocumented = rollbacks.filter((n) => !read(ROLLBACK, n).includes("--"));
    expect(undocumented).toEqual([]);
  });
});

describe("verifications actually assert something", () => {
  it("is never an empty file", () => {
    const empty = verifications.filter((n) => read(VERIFICATION, n).trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("raises on a gap rather than printing and passing", () => {
    // A verification script that only SELECTs proves nothing: it exits 0 whether
    // the object is there or not.
    const silent = verifications.filter((n) => !/\braise\b/.test(code(read(VERIFICATION, n))));
    expect(silent).toEqual([]);
  });

  it("checks catalogue state rather than guessing", () => {
    const noCatalogue = verifications.filter((n) => {
      const sql = code(read(VERIFICATION, n));
      return !/pg_catalog|information_schema|pg_class|pg_policies|pg_proc|has_table_privilege|has_function_privilege/.test(
        sql,
      );
    });
    expect(noCatalogue).toEqual([]);
  });

  it("explains itself — every verification carries a comment", () => {
    const undocumented = verifications.filter((n) => !read(VERIFICATION, n).includes("--"));
    expect(undocumented).toEqual([]);
  });
});

describe("no SQL file leaks a credential", () => {
  const all: Array<[string, string]> = [
    ...sqlIn(MIGRATIONS).map((n) => [`${MIGRATIONS}/${n}`, read(MIGRATIONS, n)] as [string, string]),
    ...rollbacks.map((n) => [`${ROLLBACK}/${n}`, read(ROLLBACK, n)] as [string, string]),
    ...verifications.map((n) => [`${VERIFICATION}/${n}`, read(VERIFICATION, n)] as [string, string]),
  ];

  it("contains no credential-shaped literal", () => {
    const leaking = all
      .filter(([, sql]) => /sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{10,}\./.test(sql))
      .map(([path]) => path);
    expect(leaking).toEqual([]);
  });

  it("sets no literal password", () => {
    const leaking = all
      .filter(([, sql]) => /password\s*=\s*'[^']{4,}'/i.test(sql))
      .map(([path]) => path);
    expect(leaking).toEqual([]);
  });
});
