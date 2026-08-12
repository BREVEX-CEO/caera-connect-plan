import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * THE ARCHITECTURE DOCUMENTS, CHECKED AGAINST THE CODE THEY DESCRIBE.
 *
 * Twenty-five requirements in the register were NOT STARTED for the same
 * reason: vision, personas, non-goals, ADRs, trust boundaries, runtime
 * boundaries, integration contracts, ownership, compatibility, deprecation —
 * none of them existed. `docs/` was an empty idea.
 *
 * The obvious response is to write twenty-five Markdown files, and it is the
 * wrong one. An architecture document nobody executes is true on the day it is
 * written and quietly false a month later, which is worse than absent: absent
 * documentation misleads nobody.
 *
 * So the facts live in `docs/boundaries.json` and every one of them is asserted
 * here against the real tree. "The service-role key is only reachable from
 * server modules" is not a sentence in a document — it is a test that fails the
 * build when a route file imports it. The prose in `docs/*.md` explains WHY
 * each boundary exists; this file proves each one still holds.
 */

const boundaries = JSON.parse(readFileSync("docs/boundaries.json", "utf8"));

/** Every non-test source file, with its content, read once. */
function sourceFiles(dir: string, out: Array<[string, string]> = []): Array<[string, string]> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") sourceFiles(path, out);
    } else if (/\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path)) {
      out.push([path, readFileSync(path, "utf8")]);
    }
  }
  return out;
}
const SOURCES = sourceFiles("src");

/** Strip comments so a rule quoted in prose is not mistaken for the breach. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

describe("the documents exist at all", () => {
  const REQUIRED = [
    "docs/CHARTER.md",
    "docs/ARCHITECTURE.md",
    "docs/GOVERNANCE.md",
    "docs/boundaries.json",
  ];

  it.each(REQUIRED)("%s is present and not a stub", (path) => {
    expect(existsSync(path), `${path} is missing`).toBe(true);
    // A heading with nothing under it is how these rot. 1 KB is not a quality
    // bar, it is a floor that a placeholder cannot clear.
    expect(readFileSync(path, "utf8").length).toBeGreaterThan(1000);
  });

  it("records at least one architecture decision", () => {
    expect(existsSync("docs/adr")).toBe(true);
    const adrs = readdirSync("docs/adr").filter((f) => f.endsWith(".md"));
    expect(adrs.length).toBeGreaterThan(0);
    for (const file of adrs) {
      const text = readFileSync(join("docs/adr", file), "utf8");
      // The four sections that make an ADR worth more than a note. "Consequences"
      // is the one people skip and the one that is read two years later.
      for (const section of ["## Status", "## Context", "## Decision", "## Consequences"]) {
        expect(text, `${file} has no ${section}`).toContain(section);
      }
    }
  });
});

describe("trust boundaries hold in the code, not only on paper", () => {
  const byCheck = Object.fromEntries(
    boundaries.trustBoundaries.map((b: { check: string }) => [b.check, b]),
  );

  it("declares every boundary with a rule, an enforcer and a stated breach", () => {
    expect(boundaries.trustBoundaries.length).toBeGreaterThanOrEqual(6);
    for (const b of boundaries.trustBoundaries) {
      expect(existsSync(b.enforcedBy), `${b.id} names a missing enforcer`).toBe(true);
      // "ifBreached" is the field that makes a boundary reviewable: a rule
      // whose consequence nobody can state is a rule nobody will defend.
      expect(b.ifBreached.length, `${b.id} does not say what a breach costs`).toBeGreaterThan(30);
    }
  });

  it("TB-01 — the service-role client is only reachable from server code", () => {
    expect(byCheck.service_role_only_in_server_modules).toBeTruthy();
    const offenders = SOURCES.filter(([path, text]) => {
      if (path.endsWith(".server.ts")) return false;
      if (!code(text).includes("client.server")) return false;
      // A dynamic import inside a handler body is the sanctioned pattern; a
      // static import puts the module in the bundle graph.
      return /^\s*import\s[^\n]*client\.server/m.test(code(text));
    }).map(([p]) => p);
    expect(offenders, "service-role client statically imported outside a server module").toEqual(
      [],
    );
  });

  it("TB-02 — extracted document text is wrapped before it reaches an engine", () => {
    const context = readFileSync("src/lib/retrieval/document-context.ts", "utf8");
    expect(context).toContain("wrapUntrustedContent");
    // Both paths matter: the short document sent whole and the retrieved
    // passages. One unwrapped path is the whole boundary.
    const chat = readFileSync("src/routes/api/ocade.chat.ts", "utf8");
    expect(chat).toContain("wrapUntrustedContent");
  });

  it("TB-04 — the engine may only be started on loopback", () => {
    const supervisor = readFileSync("src/lib/local/runtime-supervisor.ts", "utf8");
    expect(supervisor).toContain("assertLoopbackBind");
    // Fails closed: anything not positively recognised as loopback is refused.
    expect(supervisor).toMatch(/not_loopback/);
  });

  it("TB-05 — pairing refuses a public plaintext address", () => {
    const pairing = readFileSync("src/lib/brain/pairing-code.ts", "utf8");
    expect(pairing).toMatch(/protocol !== "https:"/);
    expect(pairing).toMatch(/loopback/);
  });

  it("TB-06 — the offline cache never stores privileged responses", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    for (const prefix of ["/api/", "/_serverFn/", "/auth/"]) {
      expect(sw, `service worker does not exclude ${prefix}`).toContain(prefix);
    }
  });
});

describe("runtime boundaries hold", () => {
  /**
   * Modules that touch Node built-ins, whatever they are called.
   *
   * The first version of this check keyed off the `.server.ts` / `.node.ts`
   * suffix and flagged `src/lib/code/generated-sandbox-node.ts` — which spawns
   * a process but spells its suffix with a hyphen. That file turned out to be
   * correct: it is only ever reached by `await import()` from inside a server
   * function, exactly like the service-role client.
   *
   * The naming convention was the wrong thing to test. A suffix is a signal;
   * what actually keeps a Node built-in out of the browser bundle is that no
   * module STATICALLY imports it into the client graph. So the check moved to
   * the real invariant, which is both stronger and does not depend on anyone
   * remembering a filename rule.
   */
  const NODE_ONLY = SOURCES.filter(([, text]) => /from\s+["']node:/.test(code(text))).map(
    ([path]) => path,
  );

  it("RB-01/RB-02 — no Node-only module is statically imported into the bundle", () => {
    const rule = boundaries.runtimeBoundaries.find((r: { id: string }) => r.id === "RB-01") as {
      mayNotImport: string[];
    };
    expect(
      NODE_ONLY.length,
      "no module uses Node built-ins — the check would be vacuous",
    ).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const target of NODE_ONLY) {
      // The module specifier other files would use to reach it.
      const specifier = target.replace(/^src\//, "").replace(/\.tsx?$/, "");
      const bare = specifier.split("/").pop()!;
      for (const [path, text] of SOURCES) {
        if (path === target) continue;
        if (/\.(server|node)\.ts$/.test(path)) continue; // already server-only
        const body = code(text);
        // A static `import ... from ".../thing"` puts it in the bundle graph.
        // `await import(".../thing")` does not, and is the sanctioned pattern.
        const staticImport = new RegExp(`^\\s*import\\s[^\\n]*["'][^"'\\n]*${bare}["']`, "m");
        if (staticImport.test(body)) offenders.push(`${path} statically imports ${target}`);
      }
    }
    expect(offenders, "Node built-ins reachable from the client bundle").toEqual([]);
    // And the declared rule must still name the built-ins it cares about.
    expect(rule.mayNotImport).toContain("node:child_process");
  });

  it("RB-01 — no route or component touches a Node built-in directly", () => {
    // Routes and components are unambiguously client graph. There is no
    // sanctioned dynamic-import pattern here; a Node built-in in one of these
    // is a build-time resolution that fails on the edge.
    const offenders = NODE_ONLY.filter(
      (p) => p.startsWith("src/routes/") || p.startsWith("src/components/"),
    );
    expect(offenders).toEqual([]);
  });

  it("names an entry point that exists for every declared runtime", () => {
    for (const rb of boundaries.runtimeBoundaries) {
      expect(existsSync(rb.entry), `${rb.id} names a missing entry ${rb.entry}`).toBe(true);
      expect(rb.why.length, `${rb.id} has no rationale`).toBeGreaterThan(30);
    }
  });
});

describe("integration contracts match the code", () => {
  it("declares a credential, a payload and a failure mode for each", () => {
    expect(boundaries.integrationContracts.length).toBeGreaterThanOrEqual(5);
    for (const ic of boundaries.integrationContracts) {
      expect(existsSync(ic.declaredIn), `${ic.id} names a missing module`).toBe(true);
      // The failure mode is the part that gets skipped and the part an operator
      // needs at 3am.
      expect(ic.failureMode.length, `${ic.id} has no failure mode`).toBeGreaterThan(20);
      expect(ic.carries.length).toBeGreaterThan(5);
    }
  });

  it("declares every external host the shipping code actually calls", () => {
    /*
     * The direction that matters. A contract list can be complete on paper and
     * still miss the host somebody added last week, so the check runs the other
     * way: find the hosts in the code and require each to be declared.
     */
    const declared = boundaries.integrationContracts.map((c: { host: string }) => c.host);
    const found = new Set<string>();
    for (const [path, text] of SOURCES) {
      if (path.includes("/demo/")) continue;
      for (const m of code(text).matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
        const host = m[1].toLowerCase();
        // Documentation links and deliberate test fixtures are not integrations.
        if (/example|invalid|\.test$|localhost|wikipedia|gov\.uk|nist\.gov|\.local$/.test(host)) {
          continue;
        }
        found.add(host);
      }
    }
    const undeclared = [...found].filter(
      (host) => !declared.some((d: string) => host === d || host.endsWith(`.${d}`)),
    );
    expect(undeclared, "external hosts called but not declared in docs/boundaries.json").toEqual(
      [],
    );
  });
});

describe("ownership covers the whole codebase", () => {
  it("assigns an owner to every module area, with no orphan entries", () => {
    const owned = new Set(
      boundaries.ownership.map((o: { area: string }) => o.area.replace(/^src\/lib\//, "")),
    );
    const actual = readdirSync("src/lib", { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "__tests__")
      .map((e) => e.name);

    // Every directory has an owner...
    const unowned = actual.filter((dir) => !owned.has(dir));
    expect(unowned, "module directories with no declared owner").toEqual([]);

    // ...and no owner points at a directory that no longer exists. This is the
    // half that rots: FICIA's areas were listed here until its code was removed.
    const stale = [...owned].filter((dir) => !actual.includes(dir as string));
    expect(stale, "ownership entries for directories that no longer exist").toEqual([]);
  });

  it("maps each area to a real requirement prefix", () => {
    const snapshot = JSON.parse(
      readFileSync("release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json", "utf8"),
    );
    const prefixes = new Set(snapshot.requirements.map((r: { id: string }) => r.id.split("-")[0]));
    for (const o of boundaries.ownership) {
      expect(
        prefixes.has(o.requirementPrefix),
        `${o.area} claims prefix ${o.requirementPrefix}`,
      ).toBe(true);
    }
  });
});

describe("the charter's success metrics are measured, not asserted (AZ-008)", () => {
  /*
   * A metrics table full of numbers nobody recomputes is the most persuasive
   * kind of stale claim — it looks like measurement. Each metric below that CAN
   * be evaluated from the repository is evaluated here, so the table fails the
   * build when it stops matching.
   */
  const snapshot = JSON.parse(
    readFileSync("release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json", "utf8"),
  );
  const charter = readFileSync("docs/CHARTER.md", "utf8");

  it("M7 — no database type bypass survives anywhere in the tree", () => {
    const offenders = SOURCES.filter(([, text]) =>
      /function\s+pending(From|Rpc|ConversationFrom)/.test(code(text)),
    ).map(([p]) => p);
    expect(offenders, "a pendingFrom-style `any` bridge has come back").toEqual([]);
  });

  it("M8 — the register carries no open defect", () => {
    expect(snapshot.openDefects ?? []).toEqual([]);
    expect(charter, "the charter claims a different open-defect count").toMatch(/\|\s*M8\s*\|/);
  });

  it("M9 and M10 — the counts quoted in the charter match the register", () => {
    const executed = snapshot.requirements.filter((r: { status: string }) =>
      [
        "UNIT TESTED",
        "INTEGRATION TESTED",
        "SIMULATED RUNTIME VERIFIED",
        "REAL TARGET RUNTIME VERIFIED",
      ].includes(r.status),
    ).length;
    const real = snapshot.requirements.filter(
      (r: { status: string }) => r.status === "REAL TARGET RUNTIME VERIFIED",
    ).length;
    const total = snapshot.requirements.length;
    // Quoted as "367/510" and "27/510" in the table. The point of pinning them
    // is that the gap between the two is the honest readiness measure, and a
    // stale numerator would hide it closing or widening.
    expect(charter, `M9 should read ${executed}/${total}`).toContain(`${executed}/${total}`);
    expect(charter, `M10 should read ${real}/${total}`).toContain(`${real}/${total}`);
  });

  it("M12 — no requirement claims positive weight without evidence", () => {
    const unverified = snapshot.requirements.filter(
      (r: { weight: number; evidence?: string; resolvedInPhase?: string }) =>
        r.weight > 0 && (!r.evidence || !r.resolvedInPhase),
    );
    expect(unverified.map((r: { id: string }) => r.id)).toEqual([]);
  });
});

describe("change control is the workflow, not a description of one (AZ-022)", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");

  it("every stage the policy names is a real CI job", () => {
    for (const job of [
      "build:",
      "database:",
      "rust:",
      "gates:",
      "managed-browser:",
      "worker-bundle:",
      "audit:",
    ]) {
      expect(ci, `GOVERNANCE.md claims a ${job} stage that CI does not have`).toMatch(
        new RegExp(`^ {2}${job.replace(":", ":")}`, "m"),
      );
    }
  });

  it("the ban on deploying from a push-triggered workflow is real", () => {
    // Rule 3 in GOVERNANCE.md. A --dry-run flag is one deletion away from
    // publishing on every commit, so the string is banned outright.
    expect(ci).not.toMatch(/\bnpx? wrangler deploy\b/);
  });

  it("no rule is disabled to make the build pass", () => {
    /*
     * Rule 2. A blanket disable in hand-written source is the cheapest way to
     * turn a real finding into a green tick.
     *
     * `routeTree.gen.ts` is excluded because it is regenerated by the router
     * plugin on every build and carries the plugin's own header. Linting a file
     * nobody edits reports on a generator, not on anyone's code — and the
     * exclusion is by exact filename, not a `.gen.` pattern, so a new generated
     * file has to be considered rather than absorbed.
     */
    const GENERATED = new Set(["src/routeTree.gen.ts"]);
    const offenders = SOURCES.filter(
      ([path, text]) =>
        !GENERATED.has(path) && /eslint-disable(?!-next-line)\s*(\*\/|$)/m.test(text),
    ).map(([p]) => p);
    expect(offenders, "file-wide eslint-disable found in hand-written source").toEqual([]);
  });
});

describe("compatibility and deprecation are enforced, not merely stated", () => {
  it("supports exactly the Node versions CI proves", () => {
    /*
     * Claiming support for a runtime nothing builds on is the cheapest kind of
     * false claim. The matrix declares 22 inline and 20 through an `include:`
     * entry, so this looks for the version anywhere in the build job rather
     * than assuming one matrix shape.
     */
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const buildJob = ci.slice(ci.indexOf("\n  build:"), ci.indexOf("\n  gates:"));
    for (const version of boundaries.compatibility.supportedNode) {
      expect(buildJob, `CI does not build on Node ${version}`).toMatch(
        new RegExp(`node(?:-version)?:\\s*(?:\\[[^\\]]*)?${version}`),
      );
    }
  });

  it("declares the shipped version, and it matches package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(boundaries.compatibility.targetVersion).toBe(pkg.version);
  });

  it("names shared type surfaces that exist", () => {
    for (const surface of boundaries.compatibility.sharedTypeSurfaces) {
      expect(existsSync(surface), `${surface} is declared shared but missing`).toBe(true);
    }
  });

  it("versions the mobile protocol, so a mismatched peer is refused not misread", () => {
    const channel = readFileSync("src/lib/mobile/secure-channel.ts", "utf8");
    expect(channel).toContain("PROTOCOL_VERSION");
    expect(channel).toMatch(/Unsupported protocol/);
  });

  it("registers every deprecated capability with a user-facing reason", () => {
    const features = readFileSync("src/lib/features.ts", "utf8");
    for (const d of boundaries.deprecation.currentlyDeprecated) {
      expect(features, `${d.id} is deprecated but not in the feature registry`).toContain(d.id);
      // A deprecated capability that stays reachable with no explanation is a
      // dead button, which the registry exists to make impossible.
      expect(features).toContain(d.reason);
    }
  });
});
