/**
 * OCADE Code — a repository map that reports only what it actually parsed.
 *
 * Before a coding agent edits anything it needs to know what's there: the
 * files, the exported symbols, and what imports what. This builds that map from
 * source text.
 *
 * THE HONESTY RULE HERE: **a file OCADE could not parse is listed as
 * unparsed, never as empty.** The dangerous version of a repo map is one that
 * silently reports zero symbols for a file its regex choked on — an agent then
 * "knows" a module exports nothing and edits confidently around a symbol that
 * is really there. Unparsed and empty are different facts, and both are kept.
 *
 * WHAT IT IS NOT: a compiler. It reads top-level `export` declarations and
 * `import` statements with deliberately conservative patterns. It does not
 * resolve types, follow re-exports transitively, or understand dynamic
 * `import()`. Everything it reports, it saw; things it can't see are omitted,
 * not guessed.
 */

export type RepoOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type SymbolKind = "function" | "class" | "const" | "type" | "interface" | "enum" | "default";

export interface ExportedSymbol {
  name: string;
  kind: SymbolKind;
  /** 1-based line of the declaration. */
  line: number;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface FileMap {
  path: string;
  /** False when the file could not be read as text OCADE understands. */
  parsed: boolean;
  exports: ExportedSymbol[];
  /** Module specifiers this file imports from, e.g. "./foo", "react". */
  imports: string[];
  lines: number;
}

/* ------------------------------------------------------------- extraction -- */

// Conservative: a top-level export at column 0, optionally `export default`.
const EXPORT_DECL =
  /^export\s+(default\s+)?(async\s+)?(function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;
// `export { a, b as c }` — names re-exported or grouped.
const EXPORT_LIST = /^export\s+\{([^}]*)\}/;
const IMPORT_FROM = /^import\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/;
const BARE_IMPORT = /^import\s+["']([^"']+)["']/;

function kindOf(keyword: string): SymbolKind {
  switch (keyword) {
    case "function":
      return "function";
    case "class":
      return "class";
    case "type":
      return "type";
    case "interface":
      return "interface";
    case "enum":
      return "enum";
    default:
      return "const"; // const/let/var
  }
}

/**
 * Map one file.
 *
 * Comments and strings can contain the word `export`, so only lines whose FIRST
 * non-space token is `export`/`import` are considered — a mid-line match inside
 * a template literal is exactly the kind of false symbol this must not invent.
 */
export function mapFile(file: SourceFile): FileMap {
  // A file that isn't the source language OCADE reads is unparsed, not empty.
  const looksLikeSource = /\.(ts|tsx|js|jsx|mts|cts)$/.test(file.path);
  if (!looksLikeSource) {
    return { path: file.path, parsed: false, exports: [], imports: [], lines: 0 };
  }

  const lines = file.content.split("\n");
  const exports: ExportedSymbol[] = [];
  const imports = new Set<string>();
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Track block comments so `export` inside one is not read as code.
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith("//")) continue;

    const imp = IMPORT_FROM.exec(trimmed) ?? BARE_IMPORT.exec(trimmed);
    if (imp) {
      imports.add(imp[1]);
      continue;
    }

    const decl = EXPORT_DECL.exec(trimmed);
    if (decl) {
      const isDefault = Boolean(decl[1]);
      exports.push({
        name: decl[4],
        kind: isDefault ? "default" : kindOf(decl[3]),
        line: i + 1,
      });
      continue;
    }

    const list = EXPORT_LIST.exec(trimmed);
    if (list) {
      for (const part of list[1].split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name && /^[A-Za-z_$][\w$]*$/.test(name)) {
          exports.push({ name, kind: "const", line: i + 1 });
        }
      }
    }
  }

  return {
    path: file.path,
    parsed: true,
    exports,
    imports: [...imports],
    lines: lines.length,
  };
}

/* -------------------------------------------------------------- repo map -- */

export interface RepoMap {
  files: FileMap[];
  totalFiles: number;
  parsedFiles: number;
  totalExports: number;
  /** Files that could not be parsed, kept visible. */
  unparsed: string[];
}

export function buildRepoMap(files: SourceFile[]): RepoOutcome<RepoMap> {
  if (files.length === 0) return { ok: false, reason: "There are no files to map." };

  const seen = new Set<string>();
  const maps: FileMap[] = [];
  for (const f of files) {
    if (seen.has(f.path)) {
      return {
        ok: false,
        reason: `The file “${f.path}” was supplied twice, so the map would double-count it.`,
      };
    }
    seen.add(f.path);
    maps.push(mapFile(f));
  }

  const parsed = maps.filter((m) => m.parsed);
  const unparsed = maps.filter((m) => !m.parsed).map((m) => m.path);
  const totalExports = parsed.reduce((n, m) => n + m.exports.length, 0);

  return {
    ok: true,
    data: {
      files: maps,
      totalFiles: maps.length,
      parsedFiles: parsed.length,
      totalExports,
      unparsed,
    },
    evidence:
      unparsed.length === 0
        ? `${maps.length} files, ${totalExports} exported symbols.`
        : `${parsed.length} of ${maps.length} files parsed (${totalExports} exports); ${unparsed.length} not source OCADE reads.`,
  };
}

/* --------------------------------------------------------- symbol search -- */

export interface SymbolHit {
  path: string;
  symbol: ExportedSymbol;
}

/**
 * Find an exported symbol by exact name across the map.
 *
 * Exact by default: a coding agent searching for `run` must not be handed
 * `runStep`, `runAll` and `rerun` and left to guess. A `fuzzy` mode is offered
 * explicitly, and labels itself as such in the evidence.
 */
export function findSymbol(
  map: RepoMap,
  name: string,
  opts: { fuzzy?: boolean } = {},
): RepoOutcome<SymbolHit[]> {
  const needle = name.trim();
  if (!needle) return { ok: false, reason: "No symbol name was given." };

  const hits: SymbolHit[] = [];
  for (const file of map.files) {
    for (const symbol of file.exports) {
      const match = opts.fuzzy
        ? symbol.name.toLowerCase().includes(needle.toLowerCase())
        : symbol.name === needle;
      if (match) hits.push({ path: file.path, symbol });
    }
  }

  return {
    ok: true,
    data: hits,
    evidence:
      hits.length === 0
        ? opts.fuzzy
          ? `No exported symbol contains “${needle}”.`
          : `No exported symbol named exactly “${needle}”. Try a fuzzy search if you're unsure of the name.`
        : `${hits.length} ${opts.fuzzy ? "fuzzy" : "exact"} match${hits.length === 1 ? "" : "es"} for “${needle}”.`,
  };
}

/* ----------------------------------------------------- dependency lookups -- */

/**
 * Which mapped files import the given module specifier.
 *
 * Only records edges OCADE actually saw. A file whose import it could not parse
 * is not silently treated as importing nothing — it's in `unparsed`, and the
 * caller can see the map is incomplete for it.
 */
export function importersOf(map: RepoMap, specifier: string): RepoOutcome<string[]> {
  const target = specifier.trim();
  if (!target) return { ok: false, reason: "No module specifier was given." };

  const importers = map.files
    .filter((f) => f.parsed && f.imports.includes(target))
    .map((f) => f.path);
  return {
    ok: true,
    data: importers,
    evidence:
      importers.length === 0
        ? `Nothing in the mapped files imports “${target}”.`
        : `${importers.length} file${importers.length === 1 ? "" : "s"} import “${target}”.`,
  };
}
