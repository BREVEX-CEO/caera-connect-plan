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
  const customer = [...source.matchAll(/customerChange\("([^"]+)"/g)].map((match) => match[1]!);
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
    // The four operator changes are counted below, by their kind (SEC-08-01).
    expect(named.length + customer.length).toBeGreaterThanOrEqual(12);
  });

  it.each(named)("%s is an action the database gate is called with", (name) => {
    expect(sql).toContain(`'${name.replace(/'/g, "''")}'`);
  });

  it("finds every customer change that needs an exact-account confirmation", () => {
    expect(customer).toEqual([
      "end a customer's sessions",
      "turn off a customer's two-step verification",
      "change a customer's usage",
      "suspend an account",
      "restore an account",
      "delete an account",
    ]);
  });

  it.each(customer)("%s names the same account in the server and database", (name) => {
    const repair = readFileSync(
      "supabase/migrations/20261018163814_customer_proofs_bind_the_account.sql",
      "utf8",
    );
    expect(repair).toContain(
      name === "suspend an account" || name === "restore an account"
        ? "(CASE WHEN p_suspend THEN 'suspend an account' ELSE 'restore an account' END) || ': ' || p_user"
        : `'${name.replace(/'/g, "''")}: ' || p_user`,
    );
  });

  // An operator change names whom it is for after its kind (SEC-08-01): the same prefix on both.
  const operator = [...source.matchAll(/operatorChange\("([^"]+)"/g)].map((match) => match[1]!);

  it("finds the operator changes", () => {
    expect(operator).toEqual(["add", "permissions of", "remove", "withdraw invite"]);
  });

  it.each(operator)(
    "change who operates OCADE: %s is what the database gate is called with",
    (what) => {
      expect(sql).toContain(`'change who operates OCADE: ${what} ' ||`);
    },
  );
});
