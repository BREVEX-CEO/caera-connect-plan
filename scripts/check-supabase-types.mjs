#!/usr/bin/env node
/**
 * The checked-in Supabase types must describe the checked-in migrations.
 *
 * THE DEFECT THIS EXISTS TO PREVENT. `src/integrations/supabase/types.ts` is
 * generated from a live database. When a migration lands but nobody regenerates
 * it, the file silently describes a schema that no longer exists — and the only
 * way to keep the code compiling against the real schema is an escape hatch.
 * That is exactly what happened: four hand-written `pendingFrom(): any` helpers
 * appeared across the OCADE server functions and the chat endpoint, each with a
 * comment promising to remove itself "once the types include them". Between
 * them they turned off type checking for fifty-odd database calls, including
 * every query in the endpoint that decides whether a conversation may be read.
 *
 * So this gate compares the two directly: every table created by a migration
 * and not dropped by a later one must appear in the generated types. It cannot
 * check column-by-column — the generator resolves defaults, views and enums
 * that a text scan cannot — but a missing TABLE is the case that produced the
 * escape hatches, and it is unambiguous.
 *
 * Exit 1 on drift, with the table names. Run: `npm run supabase:types-check`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";
const TYPES = "src/integrations/supabase/types.ts";

/** Tables created across every migration, in application order. */
function tablesInMigrations() {
  const created = new Set();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi,
    )) {
      created.add(m[1]);
    }
    // A table dropped later is not expected in the types.
    for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi)) {
      created.delete(m[1]);
    }
    /*
     * A table RENAMED later is not expected under its old name either — and
     * this was a live false positive: `audit_log` became `compliance_audit_log`
     * in 20260721133830, the types correctly describe the new name, and this
     * gate reported the old one as missing on every run. Following the rename
     * keeps the set to names that actually exist in the applied schema.
     */
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)\s+RENAME\s+TO\s+([a-z0-9_]+)/gi,
    )) {
      if (created.delete(m[1])) created.add(m[2]);
    }
  }
  return created;
}

/** Tables declared in the generated types file. */
function tablesInTypes() {
  const source = readFileSync(TYPES, "utf8");
  const start = source.indexOf("    Tables: {");
  if (start === -1) {
    console.error(`${TYPES} has no Tables block — the file is not a generated schema.`);
    process.exit(1);
  }
  const end = source.indexOf("    Views: {", start);
  const block = source.slice(start, end === -1 ? undefined : end);
  return new Set([...block.matchAll(/^ {6}([a-z0-9_]+): \{$/gm)].map((m) => m[1]));
}

const expected = tablesInMigrations();
const actual = tablesInTypes();

if (expected.size === 0) {
  console.error("No CREATE TABLE found in the migrations — this gate would pass vacuously.");
  process.exit(1);
}

const missing = [...expected].filter((t) => !actual.has(t)).sort();

if (missing.length > 0) {
  console.error(
    `Supabase types are behind the migrations: ${missing.length} table(s) missing from ${TYPES}`,
  );
  for (const table of missing) console.error(`  - ${table}`);
  console.error("");
  console.error("Regenerate the types against a database with every migration applied:");
  console.error("  supabase gen types typescript --project-id <id> > " + TYPES);
  console.error("Do NOT reintroduce a `pendingFrom(): any` helper to work around this.");
  process.exit(1);
}

console.log(
  `Supabase types cover all ${expected.size} migrated tables (${actual.size} declared in types).`,
);
