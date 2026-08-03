/**
 * Desktop automation worker supervisor.
 *
 * The supervisor is the preflight boundary above `runAutomationWorker`: it
 * checks that a real companion is available and that every queued action has an
 * independent verifier before it claims anything. An unavailable machine stays
 * queued and visible instead of consuming attempts or becoming false failure.
 */
import {
  runAutomationWorker,
  type AutomationActionExecutor,
  type AutomationActionVerifier,
  type AutomationWorkerOutcome,
  type AutomationWorkerStore,
} from "./automation-worker";
import type { RunStep } from "./ocade-automations";
import {
  COMPANION_UNAVAILABLE_REASON,
  type CompanionAction,
  type NativeCompanionAdapter,
} from "./native/companion-bridge";

export interface InspectableAutomationRun {
  id: string;
  steps: RunStep[];
}

export interface AutomationSupervisorPersistence {
  inspectEligibleRun(runId: string): Promise<InspectableAutomationRun | null>;
  recoverStale(staleBefore: string): Promise<{
    paused: number;
    expired: number;
    cancelled: number;
    failed: number;
    requeued: number;
  }>;
}

type Verifier = AutomationActionVerifier["verify"];

export class AutomationVerifierRegistry {
  private readonly verifiers = new Map<CompanionAction["kind"], Verifier>();
  private readonly observationEvidence = new Map<CompanionAction["kind"], string>();

  register(kind: CompanionAction["kind"], verifier: Verifier): void {
    this.verifiers.set(kind, verifier);
  }

  /**
   * Register a verifier backed by a separate observation path. The desktop
   * host accepts only this provenance; a unit-test or executor-trusting
   * verifier may still exercise the supervisor but cannot start the live host.
   */
  registerObservationBacked(
    kind: CompanionAction["kind"],
    verifier: Verifier,
    observationEvidence: string,
  ): void {
    const evidence = observationEvidence.trim();
    if (!evidence) {
      throw new Error("An observation-backed verifier requires provenance evidence.");
    }
    this.verifiers.set(kind, verifier);
    this.observationEvidence.set(kind, evidence);
  }

  get(kind: CompanionAction["kind"]): Verifier | null {
    return this.verifiers.get(kind) ?? null;
  }

  observationBackedKinds(): CompanionAction["kind"][] {
    return [...this.observationEvidence.keys()].sort();
  }

  missing(steps: RunStep[]): CompanionAction["kind"][] {
    return [...new Set(steps.map((step) => step.action.kind))]
      .filter((kind) => !this.verifiers.has(kind))
      .sort();
  }
}

export type AutomationSupervisorOutcome =
  | { status: "idle"; reason: string }
  | { status: "not_eligible"; reason: string }
  | { status: "blocked"; reason: string; missingVerifiers: CompanionAction["kind"][] }
  | AutomationWorkerOutcome;

export interface AutomationSupervisorInput {
  store: AutomationWorkerStore;
  persistence: AutomationSupervisorPersistence;
  companion: NativeCompanionAdapter;
  verifiers: AutomationVerifierRegistry;
  workerId: string;
  now?: () => Date;
}

function executorFor(companion: NativeCompanionAdapter): AutomationActionExecutor {
  return {
    async execute(action, opts) {
      const result = await companion.execute(action, opts);
      return { ok: result.ok, detail: result.detail };
    },
    cancel: (runId) => companion.cancel(runId),
  };
}

function verifierFor(registry: AutomationVerifierRegistry): AutomationActionVerifier {
  return {
    async verify(input) {
      const verifier = registry.get(input.action.kind);
      if (!verifier) {
        return {
          verified: false,
          evidence: `No independent verifier is registered for ${input.action.kind}.`,
        };
      }
      return verifier(input);
    },
  };
}

export class AutomationWorkerSupervisor {
  private readonly now: () => Date;

  constructor(private readonly input: AutomationSupervisorInput) {
    this.now = input.now ?? (() => new Date());
  }

  async run(runId: string): Promise<AutomationSupervisorOutcome> {
    let status;
    try {
      status = await this.input.companion.status();
    } catch (error) {
      return {
        status: "idle",
        reason:
          error instanceof Error
            ? `The companion status check failed: ${error.message}`
            : COMPANION_UNAVAILABLE_REASON,
      };
    }
    if (!status.available) {
      return {
        status: "idle",
        reason: status.reason ?? COMPANION_UNAVAILABLE_REASON,
      };
    }

    const candidate = await this.input.persistence.inspectEligibleRun(runId);
    if (!candidate) {
      return {
        status: "not_eligible",
        reason: "The run is not pending, is still in backoff, was cancelled, or no longer exists.",
      };
    }
    if (candidate.steps.length === 0) {
      return {
        status: "not_eligible",
        reason: "The run has no executable steps, so the supervisor will not claim it.",
      };
    }

    const missingVerifiers = this.input.verifiers.missing(candidate.steps);
    if (missingVerifiers.length > 0) {
      return {
        status: "blocked",
        reason: `No independent verifier is registered for: ${missingVerifiers.join(", ")}. The run remains queued.`,
        missingVerifiers,
      };
    }

    return runAutomationWorker({
      runId,
      workerId: this.input.workerId,
      store: this.input.store,
      executor: executorFor(this.input.companion),
      verifier: verifierFor(this.input.verifiers),
      now: this.now,
    });
  }

  /** Recover claims whose heartbeat is older than the configured threshold. */
  recoverStale(staleAfterMs: number): Promise<{
    paused: number;
    expired: number;
    cancelled: number;
    failed: number;
    requeued: number;
  }> {
    const staleBefore = new Date(this.now().getTime() - staleAfterMs).toISOString();
    return this.input.persistence.recoverStale(staleBefore);
  }
}

export function describeAutomationSupervisor(status: {
  available: boolean;
  reason?: string;
}): string {
  return status.available
    ? "Automation worker ready. A run is still successful only after every action is independently verified."
    : `Automation worker idle: ${status.reason ?? COMPANION_UNAVAILABLE_REASON}`;
}
