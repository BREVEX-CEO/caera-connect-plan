/**
 * Independent OS-state observation for automation verification.
 *
 * The executor result is deliberately absent from this transport. The native
 * host must query post-action OS state through a separate command and return
 * only privacy-safe hashes or bounded enums.
 */
import { AutomationVerifierRegistry } from "../automation-supervisor";
import { redactForAudit, type CompanionAction } from "./companion-bridge";

export const NATIVE_OBSERVATION_SOURCE = "native-os-observer-v1";

export type ObservableActionKind =
  "window.focus" | "window.arrange" | "app.open" | "file.open" | "clipboard.write";

export interface NativeObservationRequest {
  kind: ObservableActionKind;
  runId: string;
  operationId: string;
}

interface ObservationBase {
  source: typeof NATIVE_OBSERVATION_SOURCE;
  kind: ObservableActionKind;
  runId: string;
  operationId: string;
  observedAt: string;
}

export type NativeAutomationObservation =
  | (ObservationBase & { kind: "window.focus"; activeTargetDigest: string })
  | (ObservationBase & {
      kind: "window.arrange";
      layout: "left" | "right" | "maximize" | "restore";
      targetDigest?: string;
    })
  | (ObservationBase & { kind: "app.open"; runningAppDigest: string })
  | (ObservationBase & { kind: "file.open"; activeFileDigest: string })
  | (ObservationBase & { kind: "clipboard.write"; clipboardDigest: string });

export interface NativeObservationAdapter {
  /**
   * Returns unknown because IPC data is untrusted until the verifier validates
   * every field. It must not contain plaintext screen, file, or clipboard data.
   */
  observe(request: NativeObservationRequest): Promise<unknown>;
}

export interface ObservationVerifierOptions {
  now?: () => Date;
  maxAgeMs?: number;
  futureToleranceMs?: number;
}

const DIGEST = /^[a-f0-9]{64}$/;

function safeError(error: unknown): string {
  const message = redactForAudit(
    error instanceof Error ? error.message : "The native observation channel failed.",
  );
  return message.replace(
    /\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function baseFailure(
  value: unknown,
  request: NativeObservationRequest,
  now: Date,
  maxAgeMs: number,
  futureToleranceMs: number,
): string | null {
  if (!isRecord(value)) return "The native observer returned a malformed response.";
  if (value.source !== NATIVE_OBSERVATION_SOURCE) {
    return "The response did not come from the trusted native observation channel.";
  }
  if (
    value.kind !== request.kind ||
    value.runId !== request.runId ||
    value.operationId !== request.operationId
  ) {
    return "The native observation did not match this run and operation.";
  }
  if (!canonicalTimestamp(value.observedAt)) {
    return "The native observation timestamp is invalid.";
  }
  const age = now.getTime() - Date.parse(value.observedAt);
  if (age > maxAgeMs) return "The native observation is stale.";
  if (age < -futureToleranceMs) return "The native observation is from the future.";
  return null;
}

export async function digestObservationValue(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure hashing is unavailable for native observation verification.");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim();
}

export function isNativeObservationAdapter(value: unknown): value is NativeObservationAdapter {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { observe?: unknown }).observe === "function"
  );
}

export function createNativeObservationVerifierRegistry(
  observer: NativeObservationAdapter,
  options: ObservationVerifierOptions = {},
): AutomationVerifierRegistry {
  const registry = new AutomationVerifierRegistry();
  const now = options.now ?? (() => new Date());
  const maxAgeMs = Math.max(100, Math.min(options.maxAgeMs ?? 10_000, 60_000));
  const futureToleranceMs = Math.max(0, Math.min(options.futureToleranceMs ?? 2_000, 10_000));

  async function observe(
    action: CompanionAction,
    runId: string,
    operationId: string,
  ): Promise<{ value: Record<string, unknown> | null; failure: string | null }> {
    const request: NativeObservationRequest = {
      kind: action.kind as ObservableActionKind,
      runId,
      operationId,
    };
    let value: unknown;
    try {
      value = await observer.observe(request);
    } catch (error) {
      return { value: null, failure: `Native observation failed: ${safeError(error)}` };
    }
    const failure = baseFailure(value, request, now(), maxAgeMs, futureToleranceMs);
    return { value: isRecord(value) ? value : null, failure };
  }

  registry.registerObservationBacked(
    "window.focus",
    async ({ action, runId, operationId }) => {
      if (action.kind !== "window.focus") {
        return { verified: false, evidence: "Verifier/action kind mismatch." };
      }
      const result = await observe(action, runId, operationId);
      if (result.failure || !result.value) {
        return { verified: false, evidence: result.failure ?? "Native observation failed." };
      }
      const expected = await digestObservationValue(normalized(action.target));
      return result.value.activeTargetDigest === expected &&
        validDigest(result.value.activeTargetDigest)
        ? {
            verified: true,
            evidence: "Window focus verified through a fresh native OS observation.",
          }
        : { verified: false, evidence: "The independently observed active window did not match." };
    },
    "Fresh active-window identity hash from the native OS observer.",
  );

  registry.registerObservationBacked(
    "window.arrange",
    async ({ action, runId, operationId }) => {
      if (action.kind !== "window.arrange") {
        return { verified: false, evidence: "Verifier/action kind mismatch." };
      }
      const result = await observe(action, runId, operationId);
      if (result.failure || !result.value) {
        return { verified: false, evidence: result.failure ?? "Native observation failed." };
      }
      if (result.value.layout !== action.layout) {
        return {
          verified: false,
          evidence: "The independently observed window layout did not match.",
        };
      }
      if (action.target) {
        const expected = await digestObservationValue(normalized(action.target));
        if (result.value.targetDigest !== expected || !validDigest(result.value.targetDigest)) {
          return {
            verified: false,
            evidence: "The independently observed arranged window did not match.",
          };
        }
      }
      return {
        verified: true,
        evidence: "Window arrangement verified through a fresh native OS observation.",
      };
    },
    "Fresh window-bounds classification and target hash from the native OS observer.",
  );

  registry.registerObservationBacked(
    "app.open",
    async ({ action, runId, operationId }) => {
      if (action.kind !== "app.open") {
        return { verified: false, evidence: "Verifier/action kind mismatch." };
      }
      const result = await observe(action, runId, operationId);
      if (result.failure || !result.value) {
        return { verified: false, evidence: result.failure ?? "Native observation failed." };
      }
      const expected = await digestObservationValue(normalized(action.appId));
      return result.value.runningAppDigest === expected &&
        validDigest(result.value.runningAppDigest)
        ? {
            verified: true,
            evidence: "Running application verified through a fresh native OS observation.",
          }
        : {
            verified: false,
            evidence: "The independently observed running application did not match.",
          };
    },
    "Fresh running-process/application identity hash from the native OS observer.",
  );

  registry.registerObservationBacked(
    "file.open",
    async ({ action, runId, operationId }) => {
      if (action.kind !== "file.open") {
        return { verified: false, evidence: "Verifier/action kind mismatch." };
      }
      const result = await observe(action, runId, operationId);
      if (result.failure || !result.value) {
        return { verified: false, evidence: result.failure ?? "Native observation failed." };
      }
      const expected = await digestObservationValue(normalized(action.path));
      return result.value.activeFileDigest === expected &&
        validDigest(result.value.activeFileDigest)
        ? {
            verified: true,
            evidence: "Active file verified through a fresh native OS observation.",
          }
        : { verified: false, evidence: "The independently observed active file did not match." };
    },
    "Fresh active-document canonical-path hash from the native OS observer.",
  );

  registry.registerObservationBacked(
    "clipboard.write",
    async ({ action, runId, operationId }) => {
      if (action.kind !== "clipboard.write") {
        return { verified: false, evidence: "Verifier/action kind mismatch." };
      }
      const result = await observe(action, runId, operationId);
      if (result.failure || !result.value) {
        return { verified: false, evidence: result.failure ?? "Native observation failed." };
      }
      const expected = await digestObservationValue(action.text);
      return result.value.clipboardDigest === expected && validDigest(result.value.clipboardDigest)
        ? {
            verified: true,
            evidence: "Clipboard write verified through a fresh native OS observation.",
          }
        : { verified: false, evidence: "The independently observed clipboard hash did not match." };
    },
    "Fresh clipboard-content hash from the native OS observer; plaintext is never returned.",
  );

  return registry;
}
