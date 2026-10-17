import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PLAN Phase 08 V12: a staff change's proof is adopted by the database only under the
 * database's own name for that change. A server function naming it differently would have
 * every confirmed change refused; this keeps the two sides spelling it the same.
 */
describe("staff proofs name the change the database checks", () => {
  const sql = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join("supabase/migrations", name), "utf8"))
    .join("\n");
  const source = readFileSync("src/lib/admin/staff.functions.ts", "utf8");
  const named = [
    ...source.matchAll(
      /"((?:change|close|delete|sign|end|give|open|turn|hand|suspend|restore)[^"]*)"/g,
    ),
  ]
    .map((match) => match[1]!)
    .filter(
      (name) =>
        source.includes(`proves: "${name}"`) ||
        source.includes(`? "${name}"`) ||
        source.includes(`: "${name}"`),
    );

  it("finds the names it checks", () => {
    expect(named.length).toBeGreaterThanOrEqual(13);
  });

  it.each(named)("%s is an action the database gate is called with", (name) => {
    expect(sql).toContain(`'${name.replace(/'/g, "''")}'`);
  });
});
