/**
 * Authenticated desktop host for the automation queue.
 *
 * This is the only composition root that may start the queue controller. It
 * refuses web runtimes, signed-out sessions, unavailable companions, and
 * verifier registries without independent-observation provenance.
 */
import { AutomationVerifierRegistry, AutomationWorkerSupervisor } from "./automation-supervisor";
import {
  AutomationWorkerController,
  describeAutomationControllerState,
  type AutomationControllerState,
  type AutomationWorkerControllerInput,
} from "./automation-worker-controller";
import {
  createSupabaseAutomationQueueSource,
  createSupabaseAutomationSupervisorPersistence,
  createSupabaseAutomationWorkerClient,
  SupabaseAutomationWorkerStore,
} from "./automation-worker.supabase";
import {
  COMPANION_UNAVAILABLE_REASON,
  type NativeCompanionAdapter,
} from "./native/companion-bridge";
import { redactForAudit } from "@/lib/security/protected-text";

interface AuthUser {
  id: string;
}

interface AuthSubscription {
  unsubscribe(): void;
}

export interface AutomationWorkerHostSupabase {
  auth: {
    getUser(): Promise<{
      data: { user: AuthUser | null };
      error: { message: string } | null;
    }>;
    onAuthStateChange(callback: (event: string, session: unknown) => void): {
      data: { subscription: AuthSubscription };
    };
  };
}

export type AutomationWorkerHostState =
  | { status: "stopped"; reason: string }
  | { status: "starting"; reason: string }
  | { status: "running"; reason: string; controller: AutomationControllerState }
  | { status: "error"; reason: string };

interface ControllerHandle {
  start(): void;
  stop(): Promise<void>;
  getState(): AutomationControllerState;
}

export interface AutomationWorkerHostInput {
  supabase: AutomationWorkerHostSupabase & unknown;
  companion: NativeCompanionAdapter;
  verifiers: AutomationVerifierRegistry;
  isDesktopRuntime?: () => boolean;
  workerIdFactory?: () => string;
  onStateChange?: (state: AutomationWorkerHostState) => void;
  controllerOptions?: Pick<
    AutomationWorkerControllerInput,
    "isOnline" | "maxBatch" | "concurrency" | "pollIntervalMs" | "staleAfterMs"
  >;
  /** Test seam; production always uses the real adapters below. */
  createController?: (workerId: string) => ControllerHandle;
}

const WEB_RUNTIME_REASON =
  "Automation worker host stopped: queue execution runs only inside the signed desktop app.";
const SIGNED_OUT_REASON =
  "Automation worker host stopped: sign in before this device can poll or claim your queue.";
const VERIFIER_REASON =
  "Automation worker host stopped: no observation-backed action verifier is installed.";

function desktopRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

function secureWorkerId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Secure ephemeral worker identity is unavailable.");
  }
  return `desktop-${globalThis.crypto.randomUUID()}`;
}

function safeHostError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return redactForAudit(message).replace(
    /\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  );
}

export class DesktopAutomationWorkerHost {
  private readonly isDesktopRuntime: () => boolean;
  private readonly workerIdFactory: () => string;
  private controller: ControllerHandle | null = null;
  private subscription: AuthSubscription | null = null;
  private startPromise: Promise<AutomationWorkerHostState> | null = null;
  private generation = 0;
  private state: AutomationWorkerHostState = {
    status: "stopped",
    reason: WEB_RUNTIME_REASON,
  };

  constructor(private readonly input: AutomationWorkerHostInput) {
    this.isDesktopRuntime = input.isDesktopRuntime ?? desktopRuntime;
    this.workerIdFactory = input.workerIdFactory ?? secureWorkerId;
  }

  getState(): AutomationWorkerHostState {
    return this.state.status === "running"
      ? { ...this.state, controller: { ...this.state.controller } }
      : { ...this.state };
  }

  start(): Promise<AutomationWorkerHostState> {
    if (this.state.status === "running") return Promise.resolve(this.getState());
    if (this.startPromise) return this.startPromise;
    const generation = ++this.generation;
    this.startPromise = this.startOnce(generation).finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async stop(
    reason = "Automation worker host stopped. No queue rows will be polled or claimed.",
  ): Promise<void> {
    ++this.generation;
    this.subscription?.unsubscribe();
    this.subscription = null;
    const controller = this.controller;
    this.controller = null;
    if (controller) await controller.stop();
    this.setState({ status: "stopped", reason });
  }

  private async startOnce(generation: number): Promise<AutomationWorkerHostState> {
    if (!this.isDesktopRuntime()) {
      return this.setState({ status: "stopped", reason: WEB_RUNTIME_REASON });
    }
    this.setState({
      status: "starting",
      reason: "Checking desktop runtime, authentication, companion, and verifier readiness.",
    });

    try {
      const auth = await this.input.supabase.auth.getUser();
      if (generation !== this.generation) return this.getState();
      if (auth.error) {
        return this.setState({
          status: "error",
          reason: `Automation worker authentication failed: ${safeHostError(auth.error.message, "unknown failure")}`,
        });
      }
      if (!auth.data.user?.id) {
        return this.setState({ status: "stopped", reason: SIGNED_OUT_REASON });
      }

      const companionStatus = await this.input.companion.status();
      if (generation !== this.generation) return this.getState();
      if (!companionStatus.available) {
        return this.setState({
          status: "stopped",
          reason: `Automation worker host stopped: ${companionStatus.reason ?? COMPANION_UNAVAILABLE_REASON}`,
        });
      }

      if (this.input.verifiers.observationBackedKinds().length === 0) {
        return this.setState({ status: "stopped", reason: VERIFIER_REASON });
      }

      const workerId = this.workerIdFactory();
      if (!workerId.trim()) throw new Error("Secure ephemeral worker identity is empty.");
      const controller = this.input.createController
        ? this.input.createController(workerId)
        : this.composeController(workerId);
      const authListener = this.input.supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          void this.stop(
            "Automation worker host stopped after sign-out. Queued rows remain pending.",
          );
        }
      });
      if (generation !== this.generation) {
        authListener.data.subscription.unsubscribe();
        await controller.stop();
        return this.getState();
      }

      this.controller = controller;
      this.subscription = authListener.data.subscription;
      controller.start();
      return this.setState({
        status: "running",
        reason:
          "Automation worker host is polling. A run is successful only after atomic claim, execution, persistence, and independent observation.",
        controller: controller.getState(),
      });
    } catch (error) {
      this.subscription?.unsubscribe();
      this.subscription = null;
      const controller = this.controller;
      this.controller = null;
      if (controller) await controller.stop();
      return this.setState({
        status: "error",
        reason: `Automation worker host could not start: ${safeHostError(error, "unknown failure")}`,
      });
    }
  }

  private composeController(workerId: string): ControllerHandle {
    const workerClient = createSupabaseAutomationWorkerClient(this.input.supabase);
    const store = new SupabaseAutomationWorkerStore(workerClient);
    const persistence = createSupabaseAutomationSupervisorPersistence(this.input.supabase);
    const supervisor = new AutomationWorkerSupervisor({
      store,
      persistence,
      companion: this.input.companion,
      verifiers: this.input.verifiers,
      workerId,
    });
    return new AutomationWorkerController({
      source: createSupabaseAutomationQueueSource(this.input.supabase),
      supervisor,
      ...this.input.controllerOptions,
    });
  }

  private setState(state: AutomationWorkerHostState): AutomationWorkerHostState {
    this.state = state;
    try {
      this.input.onStateChange?.(this.getState());
    } catch {
      // State observers are presentation-only and cannot be allowed to change
      // worker ownership or lifecycle.
    }
    return this.getState();
  }
}

export function describeAutomationWorkerHost(state: AutomationWorkerHostState): string {
  return state.status === "running"
    ? `${state.reason} ${describeAutomationControllerState(state.controller)}`
    : state.reason;
}
