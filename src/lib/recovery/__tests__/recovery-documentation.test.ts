import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/*
 * THE RUNBOOK HAS TO STAY TRUE, AND NOTHING WAS CHECKING.
 *
 * `docs/deployment/BACKUP_AND_RESTORE.md` told an operator the schema was 58
 * migrations when it was 95, and sent them to check a `vault_config` table and
 * a browser vault that `PLAN.md` Phase 2 removed. Nobody noticed, because a
 * document is only read during an incident -- which is the worst moment to
 * discover it describes a product that no longer exists.
 *
 * These are cheap assertions against the same drift.
 */

const DOC = "docs/deployment/BACKUP_AND_RESTORE.md";

describe("the backup and restore runbook", () => {
  const runbook = readFileSync(DOC, "utf8");

  it("states the migration count the repository actually has", () => {
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).length;
    expect(runbook).toContain(`${migrations} files`);
    expect(runbook).toContain(`all ${migrations} migrations`);
  });

  it("promises nothing about storage modes that were removed", () => {
    expect(runbook).not.toMatch(/Browser Only|PC Vault|Private Sync|vault_config/);
  });

  it("names the commands that prove recovery, so the claim is checkable", () => {
    for (const command of [
      "npm run recovery:prove",
      "npm run edge:rollback-prove",
      "npm run deploy:rollback",
    ]) {
      expect(runbook).toContain(command);
    }
  });

  it("names every command it cites in package.json", () => {
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<
      string,
      string
    >;
    for (const match of runbook.matchAll(/`npm run ([a-z0-9:-]+)`/g)) {
      expect(Object.keys(scripts)).toContain(match[1]);
    }
  });

  it("still covers the two halves of Storage, which a database restore splits", () => {
    expect(runbook).toMatch(/storage\.objects/);
    expect(runbook).toMatch(/auth\.users/);
  });
});
