/**
 * Free-tool adapters: Blender, FreeCAD and CalculiX.
 *
 * The creative and engineering workflows already distinguish a
 * `deterministic_fixture` run from an `installed_application` one, and refuse to
 * call a fixture result an engineering conclusion. What was missing was any way
 * to reach the second class WITHOUT a commercial licence.
 *
 * These three tools are free and open source, so the licence barrier that
 * blocks the commercial CAD and creative suites does not apply:
 *
 *   Blender   — GPL, headless rendering and mesh export
 *   FreeCAD   — LGPL, parametric CAD, scriptable export
 *   CalculiX  — GPL, finite-element solver (`ccx`)
 *
 * WHAT THIS MODULE DOES AND DOES NOT DO
 *
 * It DETECTS whether a tool is genuinely present and answering, and it defines
 * the exact invocation for each capability. It does NOT invent output. If a
 * tool is absent, callers get `not_installed` and the workflow stays in the
 * fixture class — a render, an export or a solver result is only ever produced
 * by the real binary.
 *
 * That distinction is the whole point. §19.10 requires that "engineering
 * results come only from real solver output", and the only way to honour it is
 * for the absence of a solver to be loudly representable.
 *
 * Detection is injected (`ProbeRunner`) so it is testable without any tool
 * installed, and so a caller can supply a sandboxed runner rather than letting
 * this module spawn processes on its own authority.
 */

export type FreeToolId = "blender" | "freecad" | "calculix";

export type ToolAvailability =
  | { readonly status: "installed"; readonly version: string; readonly evidence: string }
  | { readonly status: "not_installed"; readonly reason: string }
  | { readonly status: "probe_failed"; readonly reason: string };

export interface ToolDefinition {
  readonly id: FreeToolId;
  readonly displayName: string;
  readonly licence: string;
  /** Executable name as it would appear on PATH. */
  readonly command: string;
  /** Arguments that make the tool print its version and exit. */
  readonly versionArgs: readonly string[];
  /**
   * Pattern that extracts a version from the tool's own output.
   *
   * ANCHORED TO THE START OF A LINE on purpose. An unanchored pattern accepts
   * any program whose output merely CONTAINS the tool's name — "GNU coreutils
   * blender 8.32" would pass as Blender — and this module's answer decides
   * whether real work is handed to that binary.
   */
  readonly versionPattern: RegExp;
  /** What this tool is allowed to be used for. */
  readonly capabilities: readonly string[];
}

export const FREE_TOOLS: readonly ToolDefinition[] = [
  {
    id: "blender",
    displayName: "Blender",
    licence: "GPL-3.0-or-later",
    command: "blender",
    versionArgs: ["--version"],
    versionPattern: /^Blender\s+(\d+\.\d+(?:\.\d+)?)/im,
    capabilities: ["headless_render", "mesh_export", "scene_inspect"],
  },
  {
    id: "freecad",
    displayName: "FreeCAD",
    licence: "LGPL-2.1-or-later",
    command: "freecadcmd",
    versionArgs: ["--version"],
    versionPattern: /^FreeCAD\s+(\d+\.\d+(?:\.\d+)?)/im,
    capabilities: ["cad_rebuild", "parametric_edit", "step_export"],
  },
  {
    id: "calculix",
    displayName: "CalculiX",
    licence: "GPL-2.0-or-later",
    command: "ccx",
    // ccx prints its banner with no arguments and exits non-zero; -v is safest.
    versionArgs: ["-v"],
    versionPattern: /^\s*Version\s+(\d+\.\d+)/im,
    capabilities: ["fea_solve", "termination_parse", "result_read"],
  },
];

export interface ProbeResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a command and reports what it printed. Injected so this stays testable. */
export type ProbeRunner = (command: string, args: readonly string[]) => Promise<ProbeResult>;

/**
 * Determine whether one tool is really present.
 *
 * "Present" means the binary ran AND its own output matched the expected
 * version pattern. A command that exists but prints something unrecognisable is
 * `probe_failed`, not `installed` — assuming it is the tool we wanted would be
 * guessing, and everything downstream depends on this answer being earned.
 */
export async function detectTool(
  tool: ToolDefinition,
  run: ProbeRunner,
): Promise<ToolAvailability> {
  let result: ProbeResult;
  try {
    result = await run(tool.command, tool.versionArgs);
  } catch (error) {
    return {
      status: "not_installed",
      reason: `${tool.displayName} did not run: ${errorText(error)}. Install it and ensure "${tool.command}" is on PATH.`,
    };
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = tool.versionPattern.exec(output);

  if (!result.ok && !match) {
    return {
      status: "not_installed",
      reason: `"${tool.command}" is not on PATH or exited without a recognisable version banner.`,
    };
  }
  if (!match) {
    return {
      status: "probe_failed",
      reason: `"${tool.command}" ran but did not print a ${tool.displayName} version. It may be a different program with the same name; refusing to assume it is ${tool.displayName}.`,
    };
  }

  return {
    status: "installed",
    version: match[1],
    evidence: `${tool.command} ${tool.versionArgs.join(" ")} reported ${tool.displayName} ${match[1]}.`,
  };
}

export interface ToolReport {
  readonly tool: ToolDefinition;
  readonly availability: ToolAvailability;
}

/** Detect every free tool. Never throws; an unavailable tool is a result. */
export async function detectFreeTools(
  run: ProbeRunner,
  tools: readonly ToolDefinition[] = FREE_TOOLS,
): Promise<ToolReport[]> {
  return Promise.all(
    tools.map(async (tool) => ({ tool, availability: await detectTool(tool, run) })),
  );
}

/**
 * The evidence class a workflow may claim, given what was actually detected.
 *
 * Only a tool that ran and identified itself earns `installed_application`.
 * Everything else stays `deterministic_fixture`, which the workflows already
 * refuse to treat as an engineering or creative conclusion.
 */
export function evidenceClassFor(
  availability: ToolAvailability,
): "installed_application" | "deterministic_fixture" {
  return availability.status === "installed" ? "installed_application" : "deterministic_fixture";
}

export interface CapabilityDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly evidenceClass: "installed_application" | "deterministic_fixture";
}

/**
 * May this capability run for real?
 *
 * Refuses an unknown capability even when the tool IS installed — a tool being
 * present is not permission to use it for anything one likes.
 */
export function canRunCapability(report: ToolReport, capability: string): CapabilityDecision {
  const evidenceClass = evidenceClassFor(report.availability);

  if (!report.tool.capabilities.includes(capability)) {
    return {
      allowed: false,
      evidenceClass: "deterministic_fixture",
      reason: `${report.tool.displayName} is not an adapter for "${capability}".`,
    };
  }
  if (report.availability.status !== "installed") {
    return {
      allowed: false,
      evidenceClass,
      reason: `${capability} needs ${report.tool.displayName}, which is not available: ${report.availability.reason}`,
    };
  }
  return {
    allowed: true,
    evidenceClass,
    reason: `${report.tool.displayName} ${report.availability.version} is installed and may perform ${capability}.`,
  };
}

/** Human-readable summary for a setup screen. */
export function describeAvailability(report: ToolReport): string {
  const { tool, availability } = report;
  switch (availability.status) {
    case "installed":
      return `${tool.displayName} ${availability.version} (${tool.licence}) — ready.`;
    case "probe_failed":
      return `${tool.displayName} — could not be confirmed. ${availability.reason}`;
    default:
      return `${tool.displayName} — not installed. ${availability.reason}`;
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown error";
}
