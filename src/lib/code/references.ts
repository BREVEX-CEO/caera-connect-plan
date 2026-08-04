/**
 * OCADE Code — find references to a symbol (master plan §7.1 code search).
 *
 * "Where is this used?" is the question a coding agent asks before it renames
 * or removes anything. This answers it across the mapped files.
 *
 * THE HONEST FRAMING, stated in the results themselves: this is a TEXTUAL
 * search. Without full type resolution it cannot tell a use of the symbol
 * `run` from an unrelated local variable, a property, or a same-named import
 * from a different module. So results are labelled `textual` and the caller is
 * told plainly that a match may be an unrelated identifier of the same name —
 * never presented as a definitive, safe-to-rename reference list. The line
 * between "candidates to review" and "proven references" is exactly the line a
 * careless rename crosses to corrupt a codebase.
 *
 * What it DOES do reliably: it excludes matches inside line comments, block
 * comments, and string/template literals, so it doesn't report the word `run`
 * appearing in a doc comment or a log message as a code reference. It matches
 * whole identifiers only, so `run` never matches `rerun` or `runner`.
 */
import type { SourceFile } from "./repo-map";

export type RefOutcome<T> = { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Reference {
  path: string;
  line: number;
  /** True when this line also declares the symbol (a definition, not a use). */
  isDeclaration: boolean;
  /** The line's text, trimmed, for the caller to eyeball. */
  text: string;
}

export interface ReferenceReport {
  symbol: string;
  references: Reference[];
  definitions: Reference[];
  /** Files that couldn't be scanned as source, kept visible. */
  skipped: string[];
}

const DECL_KEYWORDS = /\b(function|class|const|let|var|type|interface|enum)\b/;

/**
 * Remove line comments, block comments, and string/template literals from a
 * line so a name inside them isn't counted as a code reference.
 *
 * Block-comment state is threaded across lines by the caller. This is
 * deliberately conservative: when in doubt it blanks MORE (e.g. an unterminated
 * string to end of line), because a false negative (missing a real reference)
 * is caught by the caller's review, while a false positive inside a string is
 * silent and misleading.
 */
function stripNonCode(line: string, state: { inBlock: boolean }): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (state.inBlock) {
      const end = line.indexOf("*/", i);
      if (end === -1) return out + " ".repeat(line.length - i);
      state.inBlock = false;
      out += " ".repeat(end + 2 - i);
      i = end + 2;
      continue;
    }
    const two = line.slice(i, i + 2);
    if (two === "//") return out + " ".repeat(line.length - i);
    if (two === "/*") {
      state.inBlock = true;
      out += "  ";
      i += 2;
      continue;
    }
    const c = line[i];
    if (c === '"' || c === "'" || c === "`") {
      // Blank to the matching quote (or end of line if unterminated).
      let j = i + 1;
      while (j < line.length && line[j] !== c) {
        if (line[j] === "\\") j++; // skip escaped char
        j++;
      }
      out += " ".repeat(Math.min(j, line.length) - i + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Find textual references to `symbol` across the given files.
 *
 * Returns definitions and uses separately. Unparsed (non-source) files are
 * listed in `skipped`, never silently treated as containing no references.
 */
export function findReferences(files: SourceFile[], symbol: string): RefOutcome<ReferenceReport> {
  const name = symbol.trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
    return { ok: false, reason: `“${symbol}” isn't a valid identifier to search for.` };
  }

  // Whole-identifier match: not preceded/followed by an identifier char, and
  // not a property access (`.name`) which is a different symbol.
  const wordRe = new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`);

  const references: Reference[] = [];
  const definitions: Reference[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mts|cts)$/.test(file.path)) {
      skipped.push(file.path);
      continue;
    }
    const state = { inBlock: false };
    const lines = file.content.split("\n");
    lines.forEach((raw, idx) => {
      const code = stripNonCode(raw, state);
      if (!wordRe.test(code)) return;

      const isDeclaration =
        DECL_KEYWORDS.test(code) &&
        new RegExp(
          `\\b(function|class|const|let|var|type|interface|enum)\\s+${escapeRegExp(name)}\\b`,
        ).test(code);
      const ref: Reference = { path: file.path, line: idx + 1, isDeclaration, text: raw.trim() };
      if (isDeclaration) definitions.push(ref);
      else references.push(ref);
    });
  }

  return {
    ok: true,
    data: { symbol: name, references, definitions, skipped },
    evidence:
      references.length === 0 && definitions.length === 0
        ? `No textual reference to “${name}” found${skipped.length ? ` (${skipped.length} non-source file(s) skipped)` : ""}.`
        : `${references.length} textual use(s) and ${definitions.length} definition(s) of “${name}”. These are text matches — a match may be an unrelated identifier of the same name; review before renaming.`,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
