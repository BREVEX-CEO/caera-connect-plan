/**
 * OCADE mobile companion link (Plan §27).
 *
 * The mobile app is a MONITOR AND APPROVER, never a remote control: it can see
 * what the desktop is doing, approve/deny/cancel it, hand a task over and
 * trigger emergency stop. It can never issue arbitrary desktop commands.
 *
 * This module is the transport-agnostic decision layer over the already-tested
 * pairing primitives in `./pairing`. Execution (push, sockets, Capacitor
 * plugins) plugs in behind `MobileTransport`; with none connected everything
 * reports honestly as unavailable.
 */
import { OfflineQueue } from "@/lib/offline-queue";
import { isProtectedText } from "@/lib/native/companion-bridge";
import {
  isTrusted,
  canEmergencyStop,
  decideApproval,
  expireIfDue,
  type ApprovalRequest,
  type ApprovalStatus,
  type PairedDevice,
} from "./pairing";

/** What a phone is allowed to ask the desktop to do. Deliberately closed. */
export type MobileIntentKind =
  | "monitor.status"
  | "approval.decide"
  | "run.cancel"
  | "emergency.stop"
  | "task.handoff"
  | "file.handoff"
  | "clipboard.handoff";

export type MobileIntent =
  | { kind: "monitor.status" }
  | { kind: "approval.decide"; requestId: string; decision: "approved" | "denied" }
  | { kind: "run.cancel"; runId: string }
  | { kind: "emergency.stop" }
  | { kind: "task.handoff"; conversationId: string; text: string }
  | { kind: "file.handoff"; name: string; sizeBytes: number }
  | { kind: "clipboard.handoff"; text: string };

export type MobileDecision =
  { allow: true; requiresBiometric: boolean } | { allow: false; reason: string };

/** Intents that move data or stop work need a fresh biometric confirmation. */
const BIOMETRIC_REQUIRED: MobileIntentKind[] = [
  "approval.decide",
  "emergency.stop",
  "file.handoff",
  "clipboard.handoff",
];

export const MAX_HANDOFF_BYTES = 25 * 1024 * 1024;

/**
 * Decide whether an intent from a phone may proceed. Pure and total.
 * A revoked, stale or unknown device is refused before anything else.
 */
export function decideMobileIntent(
  intent: MobileIntent,
  device: PairedDevice | null,
  now: Date = new Date(),
): MobileDecision {
  if (!device) {
    return { allow: false, reason: "This device is not paired with your account." };
  }
  if (device.kind !== "mobile") {
    return { allow: false, reason: "Only a paired mobile device can send this." };
  }

  // Emergency stop is checked FIRST and deliberately does not require a
  // recently-seen device: halting work is never the dangerous direction, so a
  // stale-but-unrevoked phone must still be able to stop the desktop.
  if (intent.kind === "emergency.stop") {
    const check = canEmergencyStop(device);
    return check.allowed
      ? { allow: true, requiresBiometric: true }
      : { allow: false, reason: check.reason ?? "Emergency stop is not available." };
  }

  if (device.revoked) {
    return { allow: false, reason: "This device was revoked. Pair it again to continue." };
  }
  if (!isTrusted(device, now)) {
    return {
      allow: false,
      reason: "This device hasn't been verified recently. Unlock it and pair again.",
    };
  }

  if (intent.kind === "file.handoff" && intent.sizeBytes > MAX_HANDOFF_BYTES) {
    return { allow: false, reason: "That file is too large to hand off from mobile." };
  }

  /*
   * Protected content must never cross the handoff boundary.
   *
   * A clipboard hand-off is the easiest accidental credential leak in the
   * product: the user copies a password, then sends "whatever is on my
   * clipboard" to the desktop, where it lands in a queue and an audit trail.
   * Refusing here means it is never queued, never stored and never replayed.
   */
  if (
    (intent.kind === "clipboard.handoff" || intent.kind === "task.handoff") &&
    isProtectedText(intent.text)
  ) {
    return {
      allow: false,
      reason:
        "That looks like a password, one-time code or payment detail. OCADE won't send it — please enter it directly where it's needed.",
    };
  }

  return { allow: true, requiresBiometric: BIOMETRIC_REQUIRED.includes(intent.kind) };
}

/**
 * Apply a mobile approval decision to a pending request, honouring expiry.
 * Returns the resulting status plus a human reason for the audit trail.
 */
export function applyMobileApproval(
  request: ApprovalRequest,
  decision: "approved" | "denied",
  device: PairedDevice,
  now: Date = new Date(),
): { status: ApprovalStatus; reason: string } {
  const current = expireIfDue(request, now);
  if (current.status === "expired") {
    return { status: "expired", reason: "This request expired before it was answered." };
  }
  const result = decideApproval(current, decision, device, now);
  return result.ok
    ? { status: result.request.status, reason: `Decided on your phone: ${decision}.` }
    : { status: current.status, reason: result.reason };
}

/* ------------------------------------------------------------ transport -- */

export interface MobileTransportStatus {
  connected: boolean;
  reason?: string;
}

export interface MobileTransport {
  status(): Promise<MobileTransportStatus>;
  send(
    intent: MobileIntent,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }>;
  subscribe?(onMessage: (payload: any) => void): () => void;
}

export interface MobileBiometricGate {
  confirm(intent: MobileIntent, device: PairedDevice): Promise<{ ok: boolean; detail: string }>;
}

export const MOBILE_TRANSPORT_UNAVAILABLE =
  "The OCADE mobile companion isn't connected. Pair your phone to monitor and approve tasks.";
export const MOBILE_BIOMETRIC_UNAVAILABLE =
  "Biometric confirmation is not connected in this build. Open the native mobile companion to continue.";

export class UnavailableMobileTransport implements MobileTransport {
  async status(): Promise<MobileTransportStatus> {
    return { connected: false, reason: MOBILE_TRANSPORT_UNAVAILABLE };
  }
  async send(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: MOBILE_TRANSPORT_UNAVAILABLE };
  }
}

export class UnavailableMobileBiometricGate implements MobileBiometricGate {
  async confirm(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: MOBILE_BIOMETRIC_UNAVAILABLE };
  }
}

let transport: MobileTransport = new UnavailableMobileTransport();
let biometricGate: MobileBiometricGate = new UnavailableMobileBiometricGate();

export function getMobileTransport(): MobileTransport {
  return transport;
}

export function setMobileTransport(next: MobileTransport): void {
  transport = next;
}

export function setMobileBiometricGate(next: MobileBiometricGate): void {
  biometricGate = next;
}

/**
 * Ask the native gate for a fresh biometric acknowledgement.
 *
 * The page cannot pass `true` to bypass this. With no native implementation the
 * result is explicitly unavailable, and no approval, stop, or protected
 * hand-off is applied locally.
 */
export async function confirmMobileBiometric(
  intent: MobileIntent,
  device: PairedDevice,
): Promise<{ ok: boolean; detail: string }> {
  return biometricGate.confirm(intent, device);
}

/**
 * Offline queue: intents raised with no connectivity are held and replayed.
 * Only intents that are SAFE to retry are queued — a stop or approval must be
 * decided live, never replayed later against a different task.
 */
const REPLAYABLE: MobileIntentKind[] = ["task.handoff", "file.handoff", "clipboard.handoff"];

export function isReplayable(intent: MobileIntent): boolean {
  return REPLAYABLE.includes(intent.kind);
}

export interface QueuedIntent {
  intent: MobileIntent;
  queuedAt: string;
}

export function enqueueIfSafe(queue: QueuedIntent[], intent: MobileIntent, now: Date = new Date()) {
  if (!isReplayable(intent)) {
    return {
      queued: false as const,
      reason: "This needs a live connection — it can't be queued and replayed later.",
      queue,
    };
  }
  return {
    queued: true as const,
    reason: "Saved. It will be sent when your phone reconnects.",
    queue: [...queue, { intent, queuedAt: now.toISOString() }],
  };
}

/**
 * Durable backing store for the offline queue.
 *
 * The in-memory `QueuedIntent[]` above is pure and easy to test, but it dies
 * with the tab — so a handoff raised on a train would silently vanish. This
 * survives reload and crash. `isReplayable` is passed as the gate, so a stop or
 * an approval is refused at enqueue time here too.
 */
export function createMobileIntentQueue(): OfflineQueue<MobileIntent> {
  return new OfflineQueue<MobileIntent>("caera:mobile:queue:v1", isReplayable, {
    maxItems: 50,
    maxAttempts: 3,
  });
}

/** Full guarded dispatch: trust → policy → biometric → transport. */
export async function dispatchMobileIntent(
  intent: MobileIntent,
  device: PairedDevice | null,
  opts: {
    online?: boolean;
    queue?: QueuedIntent[];
    /** When offline, also persist here so the intent survives a reload. */
    durable?: OfflineQueue<MobileIntent>;
  } = {},
): Promise<{ ok: boolean; detail: string; queue?: QueuedIntent[] }> {
  const decision = decideMobileIntent(intent, device);
  if (!decision.allow) return { ok: false, detail: decision.reason };
  if (!device) {
    return { ok: false, detail: "This device is not paired with your account." };
  }
  if (decision.requiresBiometric) {
    const confirmation = await confirmMobileBiometric(intent, device);
    if (!confirmation.ok) return confirmation;
  }
  if (opts.online === false) {
    const q = enqueueIfSafe(opts.queue ?? [], intent);
    // Persist only what the pure gate already accepted, so the two layers can
    // never disagree about what is safe to replay.
    if (q.queued) opts.durable?.enqueue(intent);
    return { ok: q.queued, detail: q.reason, queue: q.queue };
  }
  const result = await getMobileTransport().send(intent);
  return { ok: result.ok, detail: result.detail };
}

/**
 * Replay everything held while offline. Each item is re-checked against the
 * CURRENT device state — a phone revoked while offline must not have its queued
 * work sent afterwards.
 */
export async function flushMobileQueue(
  queue: OfflineQueue<MobileIntent>,
  device: PairedDevice | null,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number; dropped: number }> {
  return queue.flush(async (intent, context) => {
    const decision = decideMobileIntent(intent, device, now);
    if (!decision.allow) {
      // Not retryable: refusing forever would pin it until maxAttempts, but the
      // attempt counter is exactly the bounded give-up we want here.
      return false;
    }
    const result = await getMobileTransport().send(intent, {
      idempotencyKey: context.idempotencyKey,
    });
    return result.ok;
  });
}
