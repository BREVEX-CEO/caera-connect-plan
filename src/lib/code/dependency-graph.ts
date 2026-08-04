/**
 * OCADE Code — dependency graph and diagnostics (master plan §7.1).
 *
 * Built on the repo-map: turn the per-file import lists into a graph, then
 * answer the questions a coding agent needs before it edits — what depends on
 * what, what imports something that isn't there, and what's tangled in a cycle.
 *
 * THE HONESTY RULES THAT SHAPE IT:
 *
 *  - **Only resolvable edges are edges.** A bare specifier like `react` is
 *    external; this graph does not pretend to resolve it, and does not report
 *    it as broken. Only RELATIVE imports (`./`, `../`) are expected to land on
 *    a file in the map, so only those can be "broken".
 *  - **"Unused" is "unreferenced within this map", not "dead".** An entry
 *    point, a route, or a public API is exported precisely to be used from
 *    outside the mapped set. Calling it dead would send an agent deleting a
 *    load-bearing export. So unreferenced exports are reported with that exact
 *    caveat, never as "safe to remove".
 *  - **A cycle is reported with the path**, because "there is a cycle" is
 *    useless — the agent needs to see A→B→C→A to break it at the right edge.
 *
 * Pure. It analyses the map the repo-map produced; it reads no files itself.
 */
import type { RepoMap, FileMap } from "./repo-map";

export type GraphOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface DependencyGraph {
  /** path → the mapped files it imports (resolved relative edges only). */
  edges: Map<string, string[]>;
  /** Relative imports that don't resolve to any mapped file. */
  brokenImports: { from: string; specifier: string }[];
  /** Bare (external) specifiers seen, for reference — not treated as edges. */
  externals: string[];
}

/* --------------------------------------------------------- path resolution -- */

/**
 * Resolve a relative import against the importing file's directory, trying the
 * extensions and index conventions a bundler would.
 *
 * Returns the matched mapped path, or null when nothing in the map matches —
 * which is exactly what makes an import "broken" rather than external.
 */
function resolveRelative(fromPath: string, specifier: string, known: Set<string>): string | null {
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const segments = `${dir}/${specifier}`.split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  const base = stack.join("/");

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
  ];
  return candidates.find((c) => known.has(c)) ?? null;
}

const isRelative = (spec: string) => spec.startsWith("./") || spec.startsWith("../");

/** Build the dependency graph from a repo map. */
export function buildDependencyGraph(map: RepoMap): GraphOutcome<DependencyGraph> {
  const known = new Set(map.files.map((f) => f.path));
  const edges = new Map<string, string[]>();
  const brokenImports: { from: string; specifier: string }[] = [];
  const externals = new Set<string>();

  for (const file of map.files) {
    if (!file.parsed) continue; // an unparsed file's imports are unknown, not empty
    const resolved: string[] = [];
    for (const spec of file.imports) {
      if (!isRelative(spec)) {
        externals.add(spec);
        continue;
      }
      const target = resolveRelative(file.path, spec, known);
      if (target) resolved.push(target);
      else brokenImports.push({ from: file.path, specifier: spec });
    }
    edges.set(file.path, resolved);
  }

  return {
    ok: true,
    data: { edges, brokenImports, externals: [...externals].sort() },
    evidence:
      brokenImports.length === 0
        ? `Graph built: ${edges.size} files, ${externals.size} external packages, no broken relative imports.`
        : `Graph built with ${brokenImports.length} broken relative import${brokenImports.length === 1 ? "" : "s"} — first: ${brokenImports[0].specifier} in ${brokenImports[0].from}.`,
  };
}

/* ------------------------------------------------------------------ cycles -- */

/**
 * Find circular dependencies, each reported as the path that closes the loop.
 *
 * Uses a depth-first walk with a recursion stack; when it reaches a node
 * already on the stack, the slice from that node to the current one IS the
 * cycle, and it's returned rather than just a boolean.
 */
export function findCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  // Canonical signatures so the same cycle found from two entry points isn't
  // reported twice.
  const reported = new Set<string>();

  const visit = (node: string) => {
    seen.add(node);
    onStack.add(node);
    stack.push(node);

    for (const next of graph.edges.get(node) ?? []) {
      if (onStack.has(next)) {
        const cycle = stack.slice(stack.indexOf(next));
        const sig = [...cycle].sort().join("|");
        if (!reported.has(sig)) {
          reported.add(sig);
          cycles.push([...cycle, next]); // close the loop for readability
        }
      } else if (!seen.has(next)) {
        visit(next);
      }
    }

    onStack.delete(node);
    stack.pop();
  };

  for (const node of graph.edges.keys()) {
    if (!seen.has(node)) visit(node);
  }
  return cycles;
}

/* --------------------------------------------------- unreferenced exports -- */

export interface UnreferencedExport {
  path: string;
  symbol: string;
  /** The honest caveat, carried on every finding. */
  note: string;
}

/**
 * Find exported symbols not imported by any mapped file.
 *
 * These are reported as "unreferenced within the mapped files", NOT as dead
 * code — an entry point or public API is exported to be used from outside the
 * set, and deleting it would break the thing it exists for. The distinction is
 * the whole point.
 *
 * Note: import specifiers name modules, not symbols, so this reports an export
 * as unreferenced only when NOTHING in the map imports its file at all. A file
 * that is imported somewhere is assumed to have its exports used — a
 * conservative call that avoids the far worse error of calling a used symbol
 * dead.
 */
export function findUnreferencedExports(
  map: RepoMap,
  graph: DependencyGraph,
): UnreferencedExport[] {
  const importedFiles = new Set<string>();
  for (const targets of graph.edges.values()) {
    for (const t of targets) importedFiles.add(t);
  }

  const out: UnreferencedExport[] = [];
  for (const file of map.files) {
    if (!file.parsed) continue;
    if (importedFiles.has(file.path)) continue; // its file is imported → assume used
    for (const symbol of file.exports) {
      out.push({
        path: file.path,
        symbol: symbol.name,
        note: "Unreferenced within the mapped files. This may be an entry point, route, or public API — confirm before removing; it is NOT proven dead.",
      });
    }
  }
  return out;
}

/* --------------------------------------------------------------- reporting -- */

export interface Diagnostics {
  files: number;
  edges: number;
  externals: number;
  brokenImports: number;
  cycles: number;
  unreferencedFiles: number;
}

export function diagnose(map: RepoMap): GraphOutcome<Diagnostics> {
  const graph = buildDependencyGraph(map);
  if (!graph.ok) return graph;

  const cycles = findCycles(graph.data);
  const unreferenced = findUnreferencedExports(map, graph.data);
  const unreferencedFiles = new Set(unreferenced.map((u) => u.path)).size;
  const edgeCount = [...graph.data.edges.values()].reduce((n, t) => n + t.length, 0);

  return {
    ok: true,
    data: {
      files: map.files.length,
      edges: edgeCount,
      externals: graph.data.externals.length,
      brokenImports: graph.data.brokenImports.length,
      cycles: cycles.length,
      unreferencedFiles,
    },
    evidence: `${map.files.length} files, ${edgeCount} internal edges, ${cycles.length} cycle(s), ${graph.data.brokenImports.length} broken import(s), ${unreferencedFiles} file(s) unreferenced within the map.`,
  };
}
