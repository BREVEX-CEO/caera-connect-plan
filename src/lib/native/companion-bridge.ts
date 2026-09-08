/**
 * OCADE Native Companion bridge contract (Plan §23–§25, §29).
 *
 * This is the TYPED CONTRACT ONLY. Nothing here executes OS actions: the web
 * app cannot control a computer. A signed Tauri + Rust companion implements
 * `NativeCompanionAdapter` over secure local IPC; until that binary is built,
 * signed and runtime-proven, `UnavailableCompanion` is the active adapter and
 * every action throws NativeCompanionRequiredError. No silent fallback, no
 * simulated success.
 *
 * Safety rules encoded here (decisions #7, #29, #32):
 *  - every action carries a risk tier;
 *  - protected input (passwords, OTPs, CAPTCHAs, payment/biometric/recovery
 *    data) is PROHIBITED — OCADE pauses and the user completes it personally;
 *  - high-risk actions require explicit confirmation;
 *  - cancellation and emergency stop are first-class.
 */
import { NativeCompanionRequiredError } from "@/lib/storage/types";
import { isProtectedText } from "@/lib/security/protected-text";

export type ActionRisk = "read_only" | "low" | "confirm" | "high" | "prohibited";

export type CompanionAction =
  | { kind: "screen.read" }
  | { kind: "window.list" }
  | { kind: "accessibility.read" }
  | { kind: "window.focus"; target: string }
  | { kind: "window.arrange"; layout: "left" | "right" | "maximize" | "restore"; target?: string }
  | { kind: "app.open"; appId: string }
  | { kind: "file.open"; path: string }
  | { kind: "text.type"; text: string }
  | { kind: "clipboard.read" }
  | { kind: "clipboard.write"; text: string }
  /** Read whatever the user currently has selected in the focused app. */
  | { kind: "selection.read" }
  /** Replace the current selection — e.g. "rewrite this paragraph". */
  | { kind: "selection.replace"; text: string };

/**
 * Risk tier for an action. `text.type` escalates to `prohibited` when the
 * content looks like a credential/OTP/payment value.
 */
export function riskOf(action: CompanionAction): ActionRisk {
  switch (action.kind) {
    case "screen.read":
    case "window.list":
    case "accessibility.read":
    case "clipboard.read":
    case "selection.read":
      return "read_only";
    case "window.focus":
    case "window.arrange":
      return "low";
    case "app.open":
    case "file.open":
    case "clipboard.write":
      return "confirm";
    // Overwriting a selection is a write path, gated exactly like typing.
    case "text.type":
    case "selection.replace":
      return isProtectedText(action.text) ? "prohibited" : "confirm";
    default:
      return "confirm";
  }
}

export interface CompanionStatus {
  available: boolean;
  version?: string;
  /** Honest reason shown to the user when unavailable. */
  reason?: string;
  permissions?: CompanionPermissionStatus[];
  installGuidance?: string[];
}

export interface CompanionPermissionStatus {
  id: string;
  label: string;
  state: "granted" | "denied" | "unknown" | "not_required";
  guidance: string;
}

export interface CompanionApplication {
  appId: string;
  label: string;
  processId: number;
  windowTitle: string;
}

export interface ExecuteOptions {
  /** Correlation id so a run can be cancelled and audited. */
  runId: string;
  /**
   * Stable idempotency key for one logical action. Retries MUST reuse it so
   * the native host can return the prior outcome instead of mutating twice.
   * Interactive callers may omit it; their run id becomes the operation id.
   */
  operationId?: string;
  /** Must be true for actions whose risk is `confirm` or `high`. */
  confirmed?: boolean;
  signal?: AbortSignal;
}

export interface ExecuteResult {
  ok: boolean;
  runId: string;
  /** Redacted, audit-safe summary. Never contains protected input. */
  detail: string;
  /** Bounded native result. Present only for actions that return user data. */
  output?:
    | { kind: "screen_capture"; path: string; mimeType: "image/png"; sha256: string }
    | { kind: "windows"; titles: string[] }
    | { kind: "accessibility"; nodes: Array<{ role: string; name: string; enabled: boolean }> }
    | { kind: "text"; value: string };
}

export type CompanionCompletion =
  | { status: "failed"; evidence: string }
  | { status: "completed_unverified"; evidence: string }
  | { status: "completed_verified"; evidence: string };

/**
 * Translate an executor acknowledgement into the canonical completion states.
 *
 * `ExecuteResult.ok` proves only that the executor accepted and returned from
 * the action. It cannot promote itself to verified completion. Callers must
 * supply evidence from a separate observer to reach `completed_verified`.
 */
export function classifyCompanionCompletion(
  execution: ExecuteResult,
  verification?: { verified: boolean; evidence: string },
): CompanionCompletion {
  if (!execution.ok) {
    return {
      status: "failed",
      evidence: execution.detail || "The companion reported that the action failed.",
    };
  }
  if (verification?.verified) {
    return {
      status: "completed_verified",
      evidence: verification.evidence,
    };
  }
  return {
    status: "completed_unverified",
    evidence:
      verification?.evidence ||
      "The companion acknowledged execution, but no independent observer verified the result.",
  };
}

export interface NativeCompanionAdapter {
  status(): Promise<CompanionStatus>;
  /** Authenticated, redacted application inventory when the host supports it. */
  applications?(): Promise<CompanionApplication[]>;
  execute(action: CompanionAction, opts: ExecuteOptions): Promise<ExecuteResult>;
  cancel(runId: string): Promise<void>;
  /** Immediately halt all in-flight actions. */
  emergencyStop(): Promise<void>;
  /** Real packaged MediaPipe process state; unavailable in an ordinary browser. */
  gestureStatus(): Promise<GestureControlStatus>;
  /** Start visible preview, optionally arming OS cursor control. */
  startGestureControl(options: GestureControlOptions): Promise<GestureControlStatus>;
  /** Stop gesture input and release any held mouse button. */
  stopGestureControl(): Promise<GestureControlStatus>;
}

export interface GestureControlOptions {
  cameraIndex: number;
  enableControl: boolean;
}

export interface GestureControlStatus {
  available: boolean;
  running: boolean;
  controlEnabled: boolean;
  cameraIndex: number | null;
  reason?: string;
}

export const COMPANION_UNAVAILABLE_REASON =
  "The OCADE Native Companion isn't connected. Computer control requires the signed companion app.";

/**
 * Active adapter until a signed companion exists. Every action fails loudly.
 */
export class UnavailableCompanion implements NativeCompanionAdapter {
  constructor(private readonly reason = COMPANION_UNAVAILABLE_REASON) {}

  async status(): Promise<CompanionStatus> {
    return { available: false, reason: this.reason };
  }
  async execute(): Promise<ExecuteResult> {
    throw new NativeCompanionRequiredError(this.reason);
  }
  async cancel(): Promise<void> {
    throw new NativeCompanionRequiredError(this.reason);
  }
  async emergencyStop(): Promise<void> {
    // A local no-op is safe, but reporting it as a delivered stop is not. The
    // caller must know that no host acknowledged the emergency request.
    throw new NativeCompanionRequiredError(this.reason);
  }
  async gestureStatus(): Promise<GestureControlStatus> {
    return {
      available: false,
      running: false,
      controlEnabled: false,
      cameraIndex: null,
      reason: this.reason,
    };
  }
  async startGestureControl(): Promise<GestureControlStatus> {
    throw new NativeCompanionRequiredError(this.reason);
  }
  async stopGestureControl(): Promise<GestureControlStatus> {
    throw new NativeCompanionRequiredError(this.reason);
  }
}

/**
 * Guard every action before it reaches an adapter. Returns the reason a request
 * must be refused or paused, or null when it may proceed.
 */
export function guardAction(action: CompanionAction, opts: { confirmed?: boolean }): string | null {
  const risk = riskOf(action);
  if (risk === "prohibited") {
    return "This step involves protected information. OCADE will pause — please enter it yourself.";
  }
  if ((risk === "confirm" || risk === "high") && !opts.confirmed) {
    return "This action needs your confirmation before OCADE can run it.";
  }
  return null;
}

let activeAdapter: NativeCompanionAdapter = new UnavailableCompanion();
const adapterListeners = new Set<(adapter: NativeCompanionAdapter) => void>();

export function getCompanion(): NativeCompanionAdapter {
  return activeAdapter;
}

/** Installed by the desktop build once a signed companion is verified. */
export function setCompanionAdapter(adapter: NativeCompanionAdapter): void {
  if (activeAdapter === adapter) return;
  activeAdapter = adapter;
  for (const listener of adapterListeners) {
    try {
      listener(adapter);
    } catch {
      // Adapter installation is the security boundary. A presentation
      // subscriber must not be able to roll it back by throwing.
    }
  }
}

/**
 * Observe validated in-memory adapter replacement. No session key or serialized
 * adapter state crosses this boundary; consumers receive only the live object.
 */
export function subscribeCompanionAdapter(
  listener: (adapter: NativeCompanionAdapter) => void,
): () => void {
  adapterListeners.add(listener);
  return () => adapterListeners.delete(listener);
}
