/**
 * Emit generated-shape Supabase type blocks for tables the checked-in
 * `types.ts` is missing, derived from the SCHEMA THE MIGRATIONS ACTUALLY
 * PRODUCE rather than from reading the DDL by eye.
 *
 * `supabase gen types` needs a live project. When one is not reachable the
 * alternative has been to hand-write the block, or — worse, and what actually
 * happened here before — to reach for a `pendingFrom(): any` helper and turn
 * off type checking for the calls that use the table.
 *
 * The migration twin already applies every migration to real PostgreSQL, so the
 * catalogue it ends up with IS the schema. This introspects that and prints the
 * block, which is then pasted into `types.ts`. Column names, nullability and
 * defaults come from `information_schema`, so they cannot drift from the SQL.
 *
 * Usage: vite-node scripts/generate-missing-supabase-types.mts -- <table> [...]
 */
import { DatabaseTwin } from "./db-twin.mts";

/** PostgreSQL type -> the TypeScript the Supabase generator emits. */
function tsType(dataType: string, udt: string): string {
  if (udt === "jsonb" || udt === "json") return "Json";
  switch (dataType) {
    case "uuid":
    case "text":
    case "character varying":
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
      return "string";
    case "integer":
    case "bigint":
    case "smallint":
    case "numeric":
    case "double precision":
    case "real":
      return "number";
    case "boolean":
      return "boolean";
    case "ARRAY":
      return "string[]";
    default:
      return "string";
  }
}

interface Column {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

const tables = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (tables.length === 0) {
  console.error("Usage: vite-node scripts/generate-missing-supabase-types.mts -- <table> [...]");
  process.exit(1);
}

const twin = await DatabaseTwin.create();
const applied = await twin.applyMigrations();
const failed = applied.filter((a) => !a.ok);
if (failed.length > 0) {
  console.error("Migrations failed, so the schema cannot be trusted:");
  for (const f of failed) console.error(`  ${f.file}: ${f.error}`);
  process.exit(1);
}

for (const table of tables) {
  const cols = await twin.asSuperuser<Column>(
    `select column_name, data_type, udt_name, is_nullable, column_default
       from information_schema.columns
      where table_schema = 'public' and table_name = '${table}'
      order by column_name`,
  );
  if (cols.length === 0) {
    console.error(`No such table in the applied schema: ${table}`);
    process.exit(1);
  }

  const row = cols.map((c) => {
    const t = tsType(c.data_type, c.udt_name);
    return `          ${c.column_name}: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
  });
  // Insert: optional when nullable or defaulted, as the generator emits it.
  const ins = cols.map((c) => {
    const t = tsType(c.data_type, c.udt_name);
    const optional = c.is_nullable === "YES" || c.column_default !== null;
    return `          ${c.column_name}${optional ? "?" : ""}: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
  });
  // Update: every column optional.
  const upd = cols.map((c) => {
    const t = tsType(c.data_type, c.udt_name);
    return `          ${c.column_name}?: ${t}${c.is_nullable === "YES" ? " | null" : ""}`;
  });

  console.log(`      ${table}: {`);
  console.log("        Row: {");
  console.log(row.join("\n"));
  console.log("        }");
  console.log("        Insert: {");
  console.log(ins.join("\n"));
  console.log("        }");
  console.log("        Update: {");
  console.log(upd.join("\n"));
  console.log("        }");
  console.log("        Relationships: []");
  console.log("      }");
}

await twin.close();
