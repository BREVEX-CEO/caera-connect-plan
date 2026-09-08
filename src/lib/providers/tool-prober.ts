/**
 * Bridges the free-tool detector to the application-coverage registry (P21).
 *
 * `app-coverage-registry` was written to be honest: with no prober injected,
 * every application reports BLOCKED (unknown) rather than UNSUPPORTED
 * (absent). Correct — and permanently uninformative, because nothing in
 * production ever supplied a prober. `free-tool-adapters` is exactly a prober
 * and was imported only by tests. Two halves of one feature, never joined.
 *
 * This joins them, and keeps both halves' honesty rules intact:
 *
 *  - A probe that CANNOT LOOK throws, so the registry records BLOCKED. "I could
 *    not look" is not "it is not there", and conflating them is how a coverage
 *    registry starts lying.
 *  - A binary that runs but prints an unrecognised banner is `probe_failed`,
 *    never `installed`. Something else with the same name on PATH must not be
 *    mistaken for the tool.
 *  - Nothing here can run a process in a browser. Without an injected runner
 *    the prober throws, which is the honest answer for a web build.
 */
import {
  FREE_TOOLS,
  detectTool,
  type ProbeRunner,
  type ToolDefinition,
  type ToolAvailability,
} from "./free-tool-adapters";
import type { AppProber, AppProbeResult } from "./app-coverage-registry";

/**
 * Registry application id → the free tool that backs it.
 *
 * The registry namespaces ids as `app.blender`; the tool catalogue uses bare
 * `blender`. Normalising here rather than changing either side keeps both
 * naming schemes intact, and an id with no mapping falls through to a THROWN
 * probe (unknown) rather than a silent "not detected".
 */
const APP_TO_TOOL: Readonly<Record<string, string>> = {
  blender: "blender",
  freecad: "freecad",
  calculix: "calculix",
};

const toToolId = (appId: string): string | undefined =>
  APP_TO_TOOL[appId.replace(/^app\./, "").toLowerCase()];

export class ProbeUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProbeUnavailableError";
  }
}

/**
 * Build an `AppProber` from a command runner.
 *
 * The runner is injected because process execution is not available in every
 * environment this code loads in. Passing no runner is not an error at
 * construction time — it becomes a throwing probe, so the registry records
 * BLOCKED for every application instead of quietly reporting absence.
 */
export function createToolProber(run: ProbeRunner | null): AppProber {
  return async (id: string, name: string): Promise<AppProbeResult> => {
    if (!run) {
      throw new ProbeUnavailableError(
        `Cannot probe for ${name}: running a process is not possible here, so presence is unknown rather than absent.`,
      );
    }
    const toolId = toToolId(id);
    const tool: ToolDefinition | undefined = FREE_TOOLS.find((t) => t.id === toolId);
    if (!tool) {
      throw new ProbeUnavailableError(
        `No probe is defined for ${name}, so its presence is unknown rather than absent.`,
      );
    }

    const availability: ToolAvailability = await detectTool(tool, run);
    return toProbeResult(tool, availability);
  };
}

function toProbeResult(tool: ToolDefinition, a: ToolAvailability): AppProbeResult {
  switch (a.status) {
    case "installed":
      return {
        detected: true,
        version: a.version ?? null,
        supportedActions: [...(tool.capabilities ?? [])],
        evidence: [
          `"${tool.command} ${tool.versionArgs.join(" ")}" printed a recognised ${tool.displayName} version banner.`,
        ],
      };
    case "not_installed":
      return {
        detected: false,
        version: null,
        evidence: [a.reason],
      };
    case "probe_failed":
    default:
      /*
       * A probe that ran but could not identify the program is NOT evidence of
       * absence. Throwing routes it to BLOCKED, which is the honest class: we
       * looked, and we still do not know.
       */
      throw new ProbeUnavailableError(a.reason);
  }
}
