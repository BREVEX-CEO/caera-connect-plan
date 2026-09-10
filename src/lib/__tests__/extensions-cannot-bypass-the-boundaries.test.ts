import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE PHASE 12 GATE, AS A PROPERTY OF THE WHOLE TREE.
 *
 * "Extensions cannot bypass identity, usage, permission or tenant boundaries."
 * Every one of those four is enforced somewhere today, and every one of them is
 * enforced by an ARRANGEMENT rather than by a lock: permission is decided
 * upstream of the executor, identity is read from the request rather than the
 * body, the organization ceiling is read from the database as the caller, and
 * the usage permit is held by the surface that originated the request.
 *
 * An arrangement is exactly what a later edit breaks without noticing.
 * `src/lib/runtime/execute.ts` says so about itself in its own header — "an
 * executor that also gated itself would let a caller skip the gate by calling
 * the executor directly" — and then nothing checked that its callers keep their
 * side of the bargain. This is that check.
 */

function shippedFiles(root = "src"): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === "__tests__" || entry === "node_modules") continue;
        walk(path);
        continue;
      }
      if ([".ts", ".tsx"].includes(extname(path))) out.push(path);
    }
  };
  walk(root);
  return out;
}

const FILES = shippedFiles();
const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------- permission -- */

/** The calls that make something happen on a computer or in a browser. */
const RUNS_A_TOOL = [
  "executeToolCall(",
  "runBrowserToolViaExtension(",
  "runControlActionFn(",
] as const;

/**
 * Files that reach one of those and hold no permission context, each with the
 * reason it cannot — a reason, never a waiver.
 */
const NOT_A_GATE: Record<string, string> = {
  "src/lib/runtime/execute.ts":
    "the executor itself; gating here would let a caller skip the gate by calling it directly",
  "src/lib/native/extension-adapter.ts": "the browser transport beneath the executor",
  "src/lib/control-work.functions.ts":
    "the server transport; it re-authorises independently of the browser",
};

describe("nothing runs a tool without the permission layer deciding first", () => {
  it("keeps every caller of the executor on the gated path", () => {
    const ungated: string[] = [];
    for (const file of FILES) {
      const source = read(file);
      if (!RUNS_A_TOOL.some((call) => source.includes(call))) continue;
      if (file in NOT_A_GATE) continue;
      const gated =
        source.includes("@/lib/runtime/permissions") || source.includes('from "./permissions"');
      if (!gated) ungated.push(file);
    }
    expect(ungated, "these run tools without reaching the permission layer").toEqual([]);
  });

  it("still has every named exemption, so the list cannot rot into a waiver", () => {
    for (const [file, reason] of Object.entries(NOT_A_GATE)) {
      expect(FILES, `${file} no longer exists`).toContain(file);
      expect(reason.length, file).toBeGreaterThan(20);
      // Each exemption claims the file does not decide permission. If one starts
      // deciding, the claim is stale and the entry should go.
      expect(read(file).includes("createPermissionContext("), file).toBe(false);
    }
  });
});

/* ---------------------------------------------------------- identity -- */

describe("who the caller is comes from the request, never from the request body", () => {
  const serverFunctionFiles = FILES.filter(
    (file) => file.endsWith(".functions.ts") && read(file).includes("createServerFn"),
  );

  it("has server functions to check", () => {
    expect(serverFunctionFiles.length).toBeGreaterThan(5);
  });

  it("never validates a user or organization id sent by the client", () => {
    /*
     * A validator that ACCEPTS an id is a validator that will one day be used
     * with it. Authorization is derived from the session on the server —
     * `context.userId` — so a body field of the same name is either dead or a
     * hole, and both are worth failing over.
     */
    const offenders: string[] = [];
    for (const file of serverFunctionFiles) {
      const source = read(file);
      for (const shape of [
        /\buserId:\s*z\./,
        /\buser_id:\s*z\./,
        /\borganizationId:\s*z\./,
        /\borganization_id:\s*z\./,
      ]) {
        if (shape.test(source)) offenders.push(`${file} (${shape})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------ tenant -- */

describe("what an organization withholds is read from the database, not from the caller", () => {
  const agentFunctions = read("src/lib/agent.functions.ts");

  it("asks the database as the caller for every run", () => {
    const asks = agentFunctions.match(/policyCeilingFor\(context\.supabase\)/g) ?? [];
    expect(asks.length).toBeGreaterThanOrEqual(2);
  });

  it("never accepts a ceiling from the request body", () => {
    // A ceiling the client computed and posted would be advice a modified
    // client could decline.
    expect(agentFunctions).not.toMatch(/withheldToolDomains:\s*z\./);
    expect(agentFunctions).not.toMatch(/withheldToolDomains:\s*data\./);
  });
});

/* ------------------------------------------------------------- usage -- */

describe("the usage gate covers the extension and skill paths too", () => {
  const gate = read("src/lib/commercial/__tests__/every-ai-surface-is-gated.test.ts");

  it("exempts no browser, extension, skill or plugin module from it", () => {
    /*
     * The usage gate carries a list of files that hold no permit, each with a
     * reason. None of them may be an extension or skill path: those are exactly
     * the places a third party's code could start a model run on somebody
     * else's allowance.
     */
    const exemptions = gate.slice(
      gate.indexOf("const NOT_A_SURFACE"),
      gate.indexOf("function shippedFiles"),
    );
    for (const forbidden of ["extension", "skills/", "plugin", "marketplace"]) {
      expect(exemptions.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });
});
