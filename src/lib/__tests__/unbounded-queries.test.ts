import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * POSTGREST TRUNCATES, AND IT DOES NOT SAY SO.
 *
 * A `select()` with no `limit`, `range` or `single` reads "every row" the way
 * the author meant it and "the first `db-max-rows`" the way the server does —
 * 1,000 by default on Supabase. There is no error and no marker: the response
 * is a well-formed array that is simply short. So the bug looks like a
 * transcript missing its beginning, an export that ends early, or records that
 * were never written.
 *
 * Every query below either bounds itself, pages until a short page proves the
 * end, or is on a table listed here with the reason it cannot grow. Adding an
 * unbounded read of a growing table fails this test, which is the point: the
 * mistake is invisible at the size everything is tested at.
 */

/** Tables whose row count is fixed by something other than user behaviour. */
const NATURALLY_BOUNDED: Record<string, string> = {
  data_class_privacy: "one row per data class — six, by definition",
  feature_flags: "deployment configuration, not user data",
  launch_gate_items: "the launch checklist, a fixed list",
  launch_gate_history: "admin-only audit of that fixed list",
  user_roles: "roles held, which is a handful even for an administrator",
  devices: "devices a person has paired",
  browser_grants: "one per paired browser",
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

interface Finding {
  file: string;
  line: number;
  table: string;
}

function unboundedReads(): Finding[] {
  const found: Finding[] = [];
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8");
    const from = /\.from\("(\w+)"\)/g;
    let match: RegExpExecArray | null;
    while ((match = from.exec(text))) {
      /*
       * A query is built over one or more statements, so read forward to the
       * next `.from(` or the next top-level export — whichever ends this one —
       * rather than to the next semicolon, which splits chains that were
       * assigned to a variable first.
       */
      let end = text.length;
      const nextFrom = text.indexOf('.from("', match.index + 6);
      if (nextFrom !== -1) end = Math.min(end, nextFrom);
      const nextExport = text.indexOf("\nexport ", match.index);
      if (nextExport !== -1) end = Math.min(end, nextExport);
      const tail = text.slice(match.index, Math.min(end, match.index + 1400));

      if (!/\.select\(/.test(tail)) continue; // a write
      if (/\.delete\(\)/.test(tail)) continue; // `.select()` is RETURNING here
      if (/\.maybeSingle\(|\.single\(/.test(tail)) continue; // one row
      if (/\.limit\(|\.range\(/.test(tail)) continue; // bounded
      if (/count:\s*"exact",\s*head:\s*true/.test(tail)) continue; // count only

      found.push({
        file,
        line: text.slice(0, match.index).split("\n").length,
        table: match[1],
      });
    }
  }
  return found;
}

describe("no query reads a growing table without a bound", () => {
  const findings = unboundedReads();

  it("finds queries at all, so a broken scanner cannot pass silently", () => {
    // If the regex stopped matching, everything below would trivially pass.
    const anyFrom = sourceFiles("src").some((f) => readFileSync(f, "utf8").includes('.from("'));
    expect(anyFrom).toBe(true);
  });

  it("leaves no unbounded read of a table that grows with use", () => {
    const growing = findings.filter((f) => !(f.table in NATURALLY_BOUNDED));
    const described = growing.map((f) => `${f.file}:${f.line} reads ${f.table}`);
    expect(described).toEqual([]);
  });

  it.each(Object.entries(NATURALLY_BOUNDED))(
    "%s is exempt for a stated reason: %s",
    (table, reason) => {
      expect(reason.length).toBeGreaterThan(10);
      // An exemption for a table nothing reads is an exemption nobody checked.
      expect(findings.some((f) => f.table === table)).toBe(true);
    },
  );
});
