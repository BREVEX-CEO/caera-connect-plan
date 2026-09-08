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

/**
 * Columns each migration declares for each table.
 *
 * WHY THIS EXISTS. The first version of this gate compared TABLE NAMES only,
 * and said so: "it cannot check column-by-column — the generator resolves
 * defaults, views and enums that a text scan cannot". That is true of TYPES and
 * not of NAMES, and the difference cost a real defect: `ocade_notifications`
 * declares `title text NOT NULL`, the checked-in types had no `title` at all,
 * and the gate passed because the table existed. The first query that selected
 * it failed to compile with an error about a column that does very much exist.
 *
 * So this checks names only, which is exactly the part a text scan CAN do
 * honestly. A column whose declaration this parser cannot read is skipped
 * rather than guessed — the parser reports what it found, and the assertion
 * below refuses to run against a suspiciously empty reading.
 */
function columnsInMigrations() {
  const columns = new Map();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  /*
   * STATEMENTS IN THE ORDER THEY APPEAR, not grouped by kind.
   *
   * The first version ran every CREATE, then every ADD, then every DROP, then
   * every RENAME — and got `ocade_commercial_usage` wrong on its first run,
   * because one migration renames `ocade_cloud_usage` and THEN drops a column
   * from the new name. Replaying by category applied the drop to a table that
   * did not exist yet under that name, and the column survived in the model.
   * A migration file is a sequence; anything that replays it out of order is
   * modelling a database nobody has.
   */
  const STATEMENT =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(([\s\S]*?)\n\);|ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)\s+(ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)|DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z0-9_]+)|RENAME\s+COLUMN\s+([a-z0-9_]+)\s+TO\s+([a-z0-9_]+)|RENAME\s+TO\s+([a-z0-9_]+))|DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    for (const m of sql.matchAll(STATEMENT)) {
      const [
        ,
        created,
        body,
        altered,
        ,
        added,
        dropped,
        renamedFrom,
        renamedTo,
        tableRenamedTo,
        droppedTable,
      ] = m;

      if (created) {
        const found = columns.get(created) ?? new Set();
        for (const line of body.split("\n")) {
          /*
           * EXACTLY TWO SPACES. A column is declared at the top level of the
           * parenthesis; the continuation lines of a multi-line CHECK are
           * indented further, and reading them produced a column called `or`
           * from `    OR deep_link ~ '...'`.
           */
          const declaration = /^ {2}([a-z0-9_]+)\s+[a-z]/i.exec(line);
          if (!declaration) continue;
          const name = declaration[1].toLowerCase();
          if (
            ["constraint", "primary", "unique", "foreign", "check", "exclude", "like"].includes(
              name,
            )
          ) {
            continue;
          }
          found.add(name);
        }
        columns.set(created, found);
        continue;
      }

      if (altered) {
        const found = columns.get(altered);
        if (added) columns.set(altered, (found ?? new Set()).add(added.toLowerCase()));
        else if (dropped) found?.delete(dropped.toLowerCase());
        else if (renamedFrom && renamedTo) {
          if (found?.delete(renamedFrom.toLowerCase())) found.add(renamedTo.toLowerCase());
        } else if (tableRenamedTo && found) {
          columns.delete(altered);
          columns.set(tableRenamedTo, found);
        }
        continue;
      }

      if (droppedTable) columns.delete(droppedTable);
    }
  }
  return columns;
}

/** Column names the generated types declare for one table's Row. */
function columnsInTypes(table) {
  const source = readFileSync(TYPES, "utf8");
  const start = source.indexOf(`      ${table}: {`);
  if (start === -1) return null;
  const rowStart = source.indexOf("Row: {", start);
  if (rowStart === -1) return null;
  const rowEnd = source.indexOf("\n        }", rowStart);
  const block = source.slice(rowStart, rowEnd);
  return new Set([...block.matchAll(/^ {10}([a-z0-9_]+)\??:/gm)].map((m) => m[1]));
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

/*
 * COLUMNS, TABLE BY TABLE.
 *
 * Only names, and only for tables the types declare. A column the parser could
 * not read is absent from `declared` and therefore never reported — the gate
 * finds what it can prove and says how much that was.
 */
const declaredColumns = columnsInMigrations();
let checkedColumns = 0;
const columnDrift = [];
for (const [table, wanted] of declaredColumns) {
  if (!actual.has(table)) continue;
  const present = columnsInTypes(table);
  if (!present || present.size === 0) continue;
  for (const column of wanted) {
    checkedColumns += 1;
    if (!present.has(column)) columnDrift.push(`${table}.${column}`);
  }
}

if (checkedColumns < 100) {
  console.error(
    `Only ${checkedColumns} column(s) could be read from the migrations — the parser is broken, ` +
      "and this gate would pass without checking anything.",
  );
  process.exit(1);
}

if (columnDrift.length > 0) {
  console.error(
    `Supabase types are missing ${columnDrift.length} column(s) that a migration declares:`,
  );
  for (const column of columnDrift.sort()) console.error(`  - ${column}`);
  console.error("");
  console.error("Regenerate the types against a database with every migration applied.");
  process.exit(1);
}

console.log(
  `Supabase types cover all ${expected.size} migrated tables (${actual.size} declared in types) ` +
    `and all ${checkedColumns} columns this gate can read.`,
);
