import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  FREE_TOOLS,
  detectTool,
  detectFreeTools,
  evidenceClassFor,
  canRunCapability,
  describeAvailability,
  type ProbeRunner,
  type ToolAvailability,
} from "../providers/free-tool-adapters";

const run = promisify(execFile);

/**
 * Free-tool adapters (§7.7, §19.10).
 *
 * Blender, FreeCAD and CalculiX are free and open source, so the licence
 * barrier that blocks commercial CAD and creative suites does not apply. What
 * still applies — and is the point of these tests — is that a render, an export
 * or a solver result may only ever come from the REAL binary.
 *
 * The single property that matters: a tool which is absent, or present but
 * unrecognisable, must never earn `installed_application`. If that leaked, the
 * workflows would be free to call a fixture an engineering conclusion, which
 * §19.10 forbids outright.
 */

const blender = FREE_TOOLS.find((t) => t.id === "blender")!;
const calculix = FREE_TOOLS.find((t) => t.id === "calculix")!;

const runner =
  (result: Partial<{ ok: boolean; stdout: string; stderr: string }> | Error): ProbeRunner =>
  async () => {
    if (result instanceof Error) throw result;
    return { ok: result.ok ?? true, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };

describe("a tool only counts as installed when it identifies itself", () => {
  it("accepts a genuine version banner", async () => {
    const availability = await detectTool(
      blender,
      runner({ stdout: "Blender 4.2.1\n\tbuild date: 2026-01-01" }),
    );
    expect(availability.status).toBe("installed");
    if (availability.status !== "installed") throw new Error("unreachable");
    expect(availability.version).toBe("4.2.1");
    expect(availability.evidence).toMatch(/reported Blender 4\.2\.1/);
  });

  it("reads a banner printed on stderr, as CalculiX does", async () => {
    const availability = await detectTool(calculix, runner({ ok: false, stderr: "Version 2.21" }));
    expect(availability.status).toBe("installed");
  });

  it("reports NOT INSTALLED when the binary cannot run", async () => {
    const availability = await detectTool(blender, runner(new Error("spawn ENOENT")));
    expect(availability.status).toBe("not_installed");
    if (availability.status !== "not_installed") throw new Error("unreachable");
    expect(availability.reason).toMatch(/ENOENT/);
    expect(availability.reason).toMatch(/on PATH/);
  });

  it("reports NOT INSTALLED when nothing on PATH answers", async () => {
    const availability = await detectTool(blender, runner({ ok: false, stdout: "" }));
    expect(availability.status).toBe("not_installed");
  });

  it("REFUSES to assume a same-named program is the tool", async () => {
    // Something called `blender` that is not Blender must not be driven as if
    // it were. Guessing here would hand real work to an unknown binary.
    const availability = await detectTool(
      blender,
      runner({ ok: true, stdout: "GNU coreutils blender 8.32" }),
    );
    expect(availability.status).toBe("probe_failed");
    if (availability.status !== "probe_failed") throw new Error("unreachable");
    expect(availability.reason).toMatch(/different program|refusing to assume/i);
  });
});

describe("evidence class is earned, never assumed", () => {
  const cases: Array<[string, ToolAvailability]> = [
    ["installed", { status: "installed", version: "4.2", evidence: "ok" }],
    ["not_installed", { status: "not_installed", reason: "absent" }],
    ["probe_failed", { status: "probe_failed", reason: "unrecognised" }],
  ];

  for (const [label, availability] of cases) {
    it(`maps ${label} correctly`, () => {
      const expected = label === "installed" ? "installed_application" : "deterministic_fixture";
      expect(evidenceClassFor(availability)).toBe(expected);
    });
  }

  it("never lets an unavailable tool reach installed_application", () => {
    // The rule §19.10 depends on: no real binary, no real conclusion.
    for (const [, availability] of cases.filter(([l]) => l !== "installed")) {
      expect(evidenceClassFor(availability)).toBe("deterministic_fixture");
    }
  });
});

describe("capability gating", () => {
  const installed = {
    tool: blender,
    availability: { status: "installed", version: "4.2", evidence: "ok" } as ToolAvailability,
  };
  const absent = {
    tool: blender,
    availability: { status: "not_installed", reason: "not on PATH" } as ToolAvailability,
  };

  it("allows a declared capability on an installed tool", () => {
    const decision = canRunCapability(installed, "headless_render");
    expect(decision.allowed).toBe(true);
    expect(decision.evidenceClass).toBe("installed_application");
  });

  it("refuses a capability the tool does not claim, even when installed", () => {
    // Presence is not permission to use a tool for anything at all.
    const decision = canRunCapability(installed, "fea_solve");
    expect(decision.allowed).toBe(false);
    expect(decision.evidenceClass).toBe("deterministic_fixture");
    expect(decision.reason).toMatch(/not an adapter for/);
  });

  it("refuses every capability when the tool is absent, and says why", () => {
    const decision = canRunCapability(absent, "headless_render");
    expect(decision.allowed).toBe(false);
    expect(decision.evidenceClass).toBe("deterministic_fixture");
    expect(decision.reason).toMatch(/not on PATH/);
  });
});

describe("the tool table is honest about what it is", () => {
  it("names a licence for every tool, and they are all free", () => {
    for (const tool of FREE_TOOLS) {
      expect(tool.licence).toMatch(/GPL|LGPL/);
      expect(tool.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("covers rendering, CAD and solving", () => {
    const all = FREE_TOOLS.flatMap((t) => t.capabilities);
    expect(all).toContain("headless_render");
    expect(all).toContain("cad_rebuild");
    expect(all).toContain("fea_solve");
  });

  it("declares no duplicate tool id or command", () => {
    expect(new Set(FREE_TOOLS.map((t) => t.id)).size).toBe(FREE_TOOLS.length);
    expect(new Set(FREE_TOOLS.map((t) => t.command)).size).toBe(FREE_TOOLS.length);
  });
});

describe("detection against THIS machine (runtime)", () => {
  /** Real probe: whatever is genuinely on PATH here. */
  const realRunner: ProbeRunner = async (command, args) => {
    try {
      const { stdout, stderr } = await run(command, [...args], { timeout: 20_000 });
      return { ok: true, stdout, stderr };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
  };

  it("reports a definite, explained status for every tool", async () => {
    const reports = await detectFreeTools(realRunner);
    expect(reports).toHaveLength(FREE_TOOLS.length);

    for (const report of reports) {
      expect(["installed", "not_installed", "probe_failed"]).toContain(report.availability.status);
      // Whatever the answer, it must be explained rather than merely asserted.
      expect(describeAvailability(report).length).toBeGreaterThan(20);

      // And the class must match the finding — this is the honesty invariant,
      // checked against real machine state rather than a fixture.
      if (report.availability.status !== "installed") {
        expect(evidenceClassFor(report.availability)).toBe("deterministic_fixture");
        expect(canRunCapability(report, report.tool.capabilities[0]).allowed).toBe(false);
      }
    }
  }, 90_000);
});
