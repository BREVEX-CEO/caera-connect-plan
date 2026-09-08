/**
 * OCADE mobile notifications (Plan §27).
 *
 * A notification is rendered on the LOCK SCREEN, where anyone holding the phone
 * can read it without unlocking. That makes it the least private surface in the
 * product, so this module is deliberately strict about what may appear:
 *
 *  - protected content (passwords, OTPs, card/recovery data) never appears,
 *    even redacted-in-place — the whole body is replaced;
 *  - page/file contents are never echoed, only their names and sizes;
 *  - a notification never carries an action token; tapping it opens the app,
 *    which then re-checks device trust before anything can be approved.
 *
 * Delivery itself is transport-agnostic (`NotificationTransport`), and with none
 * connected everything reports honestly as undelivered rather than pretending.
 */
import { isProtectedText } from "@/lib/security/protected-text";
import type { ApprovalRequest } from "./pairing";

export type NotificationKind =
  | "approval.requested"
  | "approval.expired"
  | "run.finished"
  | "run.failed"
  | "emergency.stopped"
  | "device.revoked";

export interface OcadeNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Correlates the tap with a request; never an authorisation token. */
  referenceId?: string;
  /** High-priority alerts bypass a quiet-hours filter. */
  urgent: boolean;
}

/** Replaces a body that would otherwise expose protected content. */
export const SAFE_BODY = "Open OCADE to see the details.";

/**
 * Build a lock-screen-safe body.
 *
 * If ANY part looks protected the whole string is dropped rather than masked in
 * place: partial masking still leaks length, position and surrounding context.
 */
export function safeBody(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return SAFE_BODY;
  if (isProtectedText(trimmed)) return SAFE_BODY;
  // Keep it short — long bodies are truncated by the OS anyway, mid-word.
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

/** An approval waiting on the phone. */
export function approvalNotification(request: ApprovalRequest): OcadeNotification {
  return {
    kind: "approval.requested",
    title: "OCADE needs your approval",
    body: safeBody(request.summary),
    referenceId: request.id,
    // A blocked task is waiting on the user, so this must break through.
    urgent: request.risk === "high" || request.risk === "confirm",
  };
}

export function expiredNotification(request: ApprovalRequest): OcadeNotification {
  return {
    kind: "approval.expired",
    title: "Approval expired",
    body: "OCADE stopped waiting and did not run it.",
    referenceId: request.id,
    urgent: false,
  };
}

export function stoppedNotification(deviceLabel: string): OcadeNotification {
  return {
    kind: "emergency.stopped",
    title: "Everything stopped",
    body: `Emergency stop from ${safeBody(deviceLabel)}. Nothing is running.`,
    urgent: true,
  };
}

export function revokedNotification(deviceLabel: string): OcadeNotification {
  return {
    kind: "device.revoked",
    title: "Device removed",
    body: `${safeBody(deviceLabel)} can no longer act on your account.`,
    urgent: true,
  };
}

/* ----------------------------------------------------------- permission -- */

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface NotificationTransport {
  /** Current OS permission, without prompting. */
  permission(): Promise<PermissionState>;
  /** Ask the OS. Only ever called from a user gesture. */
  request(): Promise<PermissionState>;
  deliver(notification: OcadeNotification): Promise<boolean>;
}

export const NOTIFICATIONS_UNAVAILABLE =
  "Notifications need the OCADE mobile app. Pair your phone to get approval alerts.";

/** Honest default: reports unsupported and delivers nothing. */
export class UnavailableNotifications implements NotificationTransport {
  async permission(): Promise<PermissionState> {
    return "unsupported";
  }
  async request(): Promise<PermissionState> {
    return "unsupported";
  }
  async deliver(): Promise<boolean> {
    return false;
  }
}

let transport: NotificationTransport = new UnavailableNotifications();

export function getNotificationTransport(): NotificationTransport {
  return transport;
}

export function setNotificationTransport(next: NotificationTransport): void {
  transport = next;
}

export interface QuietHours {
  /** 0–23. Inclusive start, exclusive end; wraps past midnight. */
  fromHour: number;
  toHour: number;
}

/** True while the clock is inside the quiet window. */
export function inQuietHours(quiet: QuietHours | null, now: Date = new Date()): boolean {
  if (!quiet) return false;
  const h = now.getHours();
  const { fromHour: from, toHour: to } = quiet;
  if (from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

/**
 * Send a notification, honouring permission and quiet hours.
 *
 * Emergency stop and other urgent alerts are NEVER suppressed by quiet hours —
 * silencing "everything stopped" would hide exactly the event the user most
 * needs to know about.
 */
export async function notify(
  notification: OcadeNotification,
  opts: { quietHours?: QuietHours | null; now?: Date } = {},
): Promise<{ delivered: boolean; reason?: string }> {
  const t = getNotificationTransport();
  const permission = await t.permission();
  if (permission !== "granted") {
    return {
      delivered: false,
      reason:
        permission === "unsupported"
          ? NOTIFICATIONS_UNAVAILABLE
          : "Notifications are turned off for OCADE on this device.",
    };
  }
  if (!notification.urgent && inQuietHours(opts.quietHours ?? null, opts.now)) {
    return { delivered: false, reason: "Held until quiet hours end." };
  }
  const ok = await t.deliver(notification);
  return ok
    ? { delivered: true }
    : { delivered: false, reason: "The notification could not be sent." };
}
