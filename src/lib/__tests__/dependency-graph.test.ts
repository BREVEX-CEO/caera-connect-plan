import { describe, it, expect } from "vitest";
import { buildRepoMap, type SourceFile } from "../code/repo-map";
import {
  buildDependencyGraph,
  findCycles,
  findUnreferencedExports,
  diagnose,
} from "../code/dependency-graph";

function graphOf(files: SourceFile[]) {
  const map = buildRepoMap(files);
  if (!map.ok) throw new Error(`fixture failed: ${map.reason}`);
  const g = buildDependencyGraph(map.data);
  if (!g.ok) throw new Error(`graph failed: ${g.reason}`);
  return { map: map.data, graph: g.data };
}

const file = (path: string, imports: string[], exportName = "thing"): SourceFile => ({
  path,
  content: [
    ...imports.map((i) => `import { x } from "${i}";`),
    `export const ${exportName} = 1;`,
  ].join("\n"),
});

describe("only resolvable relative imports become edges", () => {
  it("resolves a relative import to a mapped file", () => {
    const { graph } = graphOf([file("src/a.ts", ["./b"]), file("src/b.ts", [])]);
    expect(graph.edges.get("src/a.ts")).toEqual(["src/b.ts"]);
  });

  it("resolves index and extension conventions", () => {
    const { graph } = graphOf([file("src/a.ts", ["./feature"]), file("src/feature/index.ts", [])]);
    expect(graph.edges.get("src/a.ts")).toEqual(["src/feature/index.ts"]);
  });

  /** A bare specifier is external — not an edge, and NOT reported as broken. */
  it("treats bare specifiers as external, not broken", () => {
    const { graph } = graphOf([file("src/a.ts", ["react", "@scope/pkg"])]);
    expect(graph.edges.get("src/a.ts")).toEqual([]);
    expect(graph.brokenImports).toEqual([]);
    expect(graph.externals).toEqual(["@scope/pkg", "react"]);
  });

  /** A relative import that lands nowhere in the map IS broken. */
  it("reports a relative import that resolves to nothing", () => {
    const { graph } = graphOf([file("src/a.ts", ["./missing"])]);
    expect(graph.brokenImports).toEqual([{ from: "src/a.ts", specifier: "./missing" }]);
  });

  it("does not treat an unparsed file's imports as absent", () => {
    // A .md file is unparsed; its import lines must not create edges or broken
    // reports (we don't know what it really imports).
    const { graph } = graphOf([
      file("src/a.ts", ["./b"]),
      file("src/b.ts", []),
      { path: "notes.md", content: 'import "./a"' },
    ]);
    expect(graph.edges.has("notes.md")).toBe(false);
    expect(graph.brokenImports).toEqual([]);
  });
});

describe("cycle detection reports the path, not just a flag", () => {
  it("finds a two-file cycle", () => {
    const { graph } = graphOf([file("src/a.ts", ["./b"]), file("src/b.ts", ["./a"])]);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    // The reported path closes the loop.
    expect(cycles[0][0]).toBe(cycles[0][cycles[0].length - 1]);
    expect(new Set(cycles[0])).toEqual(new Set(["src/a.ts", "src/b.ts"]));
  });

  it("finds a three-file cycle", () => {
    const { graph } = graphOf([
      file("src/a.ts", ["./b"]),
      file("src/b.ts", ["./c"]),
      file("src/c.ts", ["./a"]),
    ]);
    expect(findCycles(graph)).toHaveLength(1);
  });

  it("reports no cycle for an acyclic graph", () => {
    const { graph } = graphOf([
      file("src/a.ts", ["./b", "./c"]),
      file("src/b.ts", ["./c"]),
      file("src/c.ts", []),
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("does not double-report the same cycle from different entry points", () => {
    const { graph } = graphOf([
      file("src/a.ts", ["./b"]),
      file("src/b.ts", ["./a"]),
      file("src/root.ts", ["./a", "./b"]), // reaches the cycle two ways
    ]);
    expect(findCycles(graph)).toHaveLength(1);
  });
});

/**
 * "Unused" must never read as "dead". An entry point is exported to be used
 * from outside the mapped set.
 */
describe("unreferenced exports are flagged, never declared dead", () => {
  it("flags a file nothing imports, with the not-dead caveat", () => {
    const { map, graph } = graphOf([file("src/a.ts", ["./b"]), file("src/b.ts", [])]);
    const unref = findUnreferencedExports(map, graph);
    // a.ts is imported by nothing → its export is unreferenced within the map.
    expect(unref.map((u) => u.path)).toContain("src/a.ts");
    expect(unref.find((u) => u.path === "src/a.ts")!.note).toMatch(/NOT proven dead/i);
  });

  it("does not flag a file that is imported somewhere", () => {
    const { map, graph } = graphOf([file("src/a.ts", ["./b"]), file("src/b.ts", [])]);
    const unref = findUnreferencedExports(map, graph);
    expect(unref.map((u) => u.path)).not.toContain("src/b.ts");
  });
});

describe("diagnostics roll up honestly", () => {
  it("counts files, edges, externals, cycles and broken imports", () => {
    const map = buildRepoMap([
      file("src/a.ts", ["./b", "react"]),
      file("src/b.ts", ["./a", "./missing"]),
    ]);
    if (!map.ok) throw new Error("unreachable");
    const d = diagnose(map.data);
    if (!d.ok) throw new Error("unreachable");
    expect(d.data.files).toBe(2);
    expect(d.data.edges).toBe(2); // a→b, b→a
    expect(d.data.externals).toBe(1); // react
    expect(d.data.brokenImports).toBe(1); // ./missing
    expect(d.data.cycles).toBe(1); // a↔b
    expect(d.evidence).toMatch(/1 cycle\(s\)/);
  });
});
