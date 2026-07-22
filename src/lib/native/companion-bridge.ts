/**
 * CAERA Native Companion bridge contract (Plan §23–§25, §29).
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

export type ActionRisk = "read_only" | "low" | "confirm" | "high" | "prohibited";

export type CompanionAction =
  | { kind: "screen.read" }
  | { kind: "window.list" }
  | { kind: "window.focus"; target: string }
  | { kind: "window.arrange"; layout: "left" | "right" | "maximize" | "restore"; target?: string }
  | { kind: "app.open"; appId: string }
  | { kind: "file.open"; path: string }
  | { kind: "text.type"; text: string }
  | { kind: "clipboard.read" }
  | { kind: "clipboard.write"; text: string };

/**
 * Patterns that indicate protected content OCADE must never type or read.
 * Deliberately broad — a false positive costs a pause, a false negative costs a
 * credential.
 */
const PROTECTED_HINTS =
  /(password|passcode|passphrase|\botp\b|one[- ]time code|verification code|2fa|mfa|captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|aadhaar|passport number|pin\b|recovery code|seed phrase|private key|biometric)/i;

/** Long digit runs (card/OTP-like) are treated as protected. */
const DIGIT_RUN = /\b\d{4,}\b/;

export function isProtectedText(text: string): boolean {
  return PROTECTED_HINTS.test(text) || DIGIT_RUN.test(text);
}

/**
 * Risk tier for an action. `text.type` escalates to `prohibited` when the
 * content looks like a credential/OTP/payment value.
 */
export function riskOf(action: CompanionAction): ActionRisk {
  switch (action.kind) {
    case "screen.read":
    case "window.list":
    case "clipboard.read":
      return "read_only";
    case "window.focus":
    case "window.arrange":
      return "low";
    case "app.open":
    case "file.open":
    case "clipboard.write":
      return "confirm";
    case "text.type":
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
}

export interface ExecuteOptions {
  /** Correlation id so a run can be cancelled and audited. */
  runId: string;
  /** Must be true for actions whose risk is `confirm` or `high`. */
  confirmed?: boolean;
  signal?: AbortSignal;
}

export interface ExecuteResult {
  ok: boolean;
  runId: string;
  /** Redacted, audit-safe summary. Never contains protected input. */
  detail: string;
}

export interface NativeCompanionAdapter {
  status(): Promise<CompanionStatus>;
  execute(action: CompanionAction, opts: ExecuteOptions): Promise<ExecuteResult>;
  cancel(runId: string): Promise<void>;
  /** Immediately halt all in-flight actions. */
  emergencyStop(): Promise<void>;
}

export const COMPANION_UNAVAILABLE_REASON =
  "The CAERA Native Companion isn't connected. Computer control requires the signed companion app.";

/**
 * Active adapter until a signed companion exists. Every action fails loudly.
 */
export class UnavailableCompanion implements NativeCompanionAdapter {
  async status(): Promise<CompanionStatus> {
    return { available: false, reason: COMPANION_UNAVAILABLE_REASON };
  }
  async execute(): Promise<ExecuteResult> {
    throw new NativeCompanionRequiredError(COMPANION_UNAVAILABLE_REASON);
  }
  async cancel(): Promise<void> {
    throw new NativeCompanionRequiredError(COMPANION_UNAVAILABLE_REASON);
  }
  async emergencyStop(): Promise<void> {
    // Safe to no-op: with no companion connected there is nothing to stop.
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

/** Redact protected content from any string before it reaches logs/audit/replay. */
export function redactForAudit(text: string): string {
  if (!text) return text;
  return text.replace(/\b\d{4,}\b/g, "[redacted]").replace(PROTECTED_HINTS, "[redacted]");
}

let activeAdapter: NativeCompanionAdapter = new UnavailableCompanion();

export function getCompanion(): NativeCompanionAdapter {
  return activeAdapter;
}

/** Installed by the desktop build once a signed companion is verified. */
export function setCompanionAdapter(adapter: NativeCompanionAdapter): void {
  activeAdapter = adapter;
}
