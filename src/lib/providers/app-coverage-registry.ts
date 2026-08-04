/**
 * Universal application coverage registry (Phase 37).
 *
 * Publishes which applications OCADE can actually drive, and on what evidence.
 *
 * THIS MODULE PREVIOUSLY FABRICATED ITS RESULTS. `runCoverageScan` hardcoded
 * Blender as detected at version 4.0.2 with coverage FULL and the evidence
 * "Found executable", and Chrome at 123.0 — without probing anything at all.
 * On a machine with no Blender installed it reported full Blender support, and
 * every gate passed because the gates only checked that the file existed.
 *
 * A coverage registry is precisely the thing that must never guess: it is what
 * the rest of the system consults before claiming it can drive an application.
 * So the rule here is absolute — THE REGISTRY NEVER DECIDES THAT AN APPLICATION
 * IS PRESENT. It only records what a probe reported, and every field it
 * publishes is traceable to that probe.
 *
 * Detection needs process execution, which is unavailable in a browser. Rather
 * than pretend either way, the prober is INJECTED: with no prober, coverage is
 * BLOCKED (unknown), never UNSUPPORTED (absent). Unknown and absent are
 * different answers and are kept different.
 */

export type AppCoverageLevel = "FULL" | "PARTIAL" | "UNSUPPORTED" | "BLOCKED";

export interface AppCoverageInfo {
  id: string;
  name: string;
  version: string | null;
  detected: boolean;
  supportedActions: string[];
  coverageLevel: AppCoverageLevel;
  evidence: string[];
}

/** What a probe is allowed to report. The registry adds nothing to this. */
export interface AppProbeResult {
  detected: boolean;
  /** Only meaningful when detected; a version without detection is refused. */
  version?: string | null;
  supportedActions?: string[];
  /** Why the probe believes what it believes. Required to claim detection. */
  evidence: string[];
  /** Present and non-empty means detected-but-limited, i.e. PARTIAL. */
  limitations?: string[];
}

/**
 * Probes a single application. Implementations do real work — running an
 * executable with `--version`, reading a registry key. A probe that cannot
 * determine an answer must THROW rather than return `detected: false`, because
 * "I could not look" is not "it is not there".
 */
export type AppProber = (id: string, name: string) => Promise<AppProbeResult>;

export interface CoverageRegistryState {
  lastScanned: Date | null;
  applications: Map<string, AppCoverageInfo>;
}

const NO_PROBER =
  "No probe host is available in this environment, so presence could not be determined.";

/** Unknown, never absent. Used whenever the registry has not been told anything. */
function blocked(id: string, name: string, reason: string): AppCoverageInfo {
  return {
    id,
    name,
    version: null,
    detected: false,
    supportedActions: [],
    coverageLevel: "BLOCKED",
    evidence: [reason],
  };
}

export class AppCoverageRegistry {
  private state: CoverageRegistryState = {
    lastScanned: null,
    applications: new Map(),
  };

  registerAppProfile(id: string, name: string): void {
    if (!id.trim() || !name.trim()) {
      throw new Error("An application profile needs a non-empty id and name.");
    }
    // A newly registered app is UNKNOWN, not unsupported: nothing has looked yet.
    this.state.applications.set(
      id,
      blocked(id, name, "Registered but not yet scanned; no probe has run."),
    );
  }

  /**
   * Runs the real detection pass.
   *
   * With no prober, every application becomes BLOCKED. That is the honest
   * answer in a browser: OCADE cannot see the filesystem from there, and
   * reporting "not installed" would be a fabrication in the other direction.
   */
  async runCoverageScan(prober?: AppProber): Promise<AppCoverageInfo[]> {
    this.state.lastScanned = new Date();

    for (const [id, app] of this.state.applications.entries()) {
      if (!prober) {
        this.state.applications.set(id, blocked(id, app.name, NO_PROBER));
        continue;
      }

      let probe: AppProbeResult;
      try {
        probe = await prober(id, app.name);
      } catch (error) {
        // The probe failed. That is unknown, not absent.
        this.state.applications.set(
          id,
          blocked(
            id,
            app.name,
            `The probe could not complete: ${
              error instanceof Error ? error.message : "the probe host refused"
            }`,
          ),
        );
        continue;
      }

      this.state.applications.set(id, this.classify(id, app.name, probe));
    }

    return Array.from(this.state.applications.values());
  }

  /**
   * Turns a probe result into a coverage record.
   *
   * Every rule here exists to stop a claim outrunning its evidence.
   */
  private classify(id: string, name: string, probe: AppProbeResult): AppCoverageInfo {
    const evidence = (probe.evidence ?? []).filter((line) => line.trim().length > 0);

    if (!probe.detected) {
      return {
        id,
        name,
        version: null,
        detected: false,
        supportedActions: [],
        coverageLevel: "UNSUPPORTED",
        evidence: evidence.length ? evidence : ["The probe reported the application as absent."],
      };
    }

    // Detection with no evidence is an assertion, not a finding. Refuse it.
    if (evidence.length === 0) {
      return blocked(id, name, "The probe claimed detection but supplied no evidence for it.");
    }

    const actions = (probe.supportedActions ?? []).filter((a) => a.trim().length > 0);
    const limited = (probe.limitations ?? []).filter((l) => l.trim().length > 0);

    // Detected but able to do nothing is not FULL coverage.
    if (actions.length === 0) {
      return {
        id,
        name,
        version: probe.version ?? null,
        detected: true,
        supportedActions: [],
        coverageLevel: "PARTIAL",
        evidence: [...evidence, "Detected, but the probe reported no supported action."],
      };
    }

    return {
      id,
      name,
      version: probe.version ?? null,
      detected: true,
      supportedActions: actions,
      coverageLevel: limited.length > 0 ? "PARTIAL" : "FULL",
      evidence: limited.length > 0 ? [...evidence, ...limited] : evidence,
    };
  }

  getCoverageReport(): AppCoverageInfo[] {
    return Array.from(this.state.applications.values());
  }

  getAppCoverage(id: string): AppCoverageInfo | undefined {
    return this.state.applications.get(id);
  }

  get lastScanned(): Date | null {
    return this.state.lastScanned;
  }
}

export const globalCoverageRegistry = new AppCoverageRegistry();
