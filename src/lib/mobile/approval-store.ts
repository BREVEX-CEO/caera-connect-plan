/**
 * Shared approval queue (Plan §27).
 *
 * The producer and the consumer live on different surfaces: the Desktop Copilot
 * raises an approval when an action needs a human decision, and the mobile
 * companion (or the mobile settings page) answers it. Without a shared store
 * between them the approvals panel had no producer at all — it was permanently
 * empty, and `expireIfDue` / `applyMobileApproval` had nothing to act on.
 *
 * Durable on purpose: an approval raised just before a reload or crash must
 * still be waiting afterwards, or the desktop blocks forever on a request the
 * user can no longer see.
 *
 * Storage holds only what is already redacted — a request summary never
 * contains protected input, because `createApprovalRequest` is given a summary
 * that has been through `redactForAudit`.
 */
import {
  createApprovalRequest,
  expireIfDue,
  type ApprovalRequest,
  type ApprovalStatus,
} from "./pairing";
import { notify, approvalNotification, expiredNotification } from "./notifications";

const KEY = "caera:approvals:v1";

/** Serialised form — Dates become ISO strings in storage. */
interface StoredApproval {
  id: string;
  summary: string;
  risk: ApprovalRequest["risk"];
  requestedAt: string;
  expiresAt: string;
  status: ApprovalStatus;
  decidedByDeviceId?: string;
  decidedAt?: string;
}

const RISKS: ApprovalRequest["risk"][] = ["read_only", "low", "confirm", "high", "prohibited"];
const STATUSES: ApprovalStatus[] = ["pending", "approved", "denied", "expired", "cancelled"];

function canonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isStoredApproval(value: unknown): value is StoredApproval {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<StoredApproval>;
  if (
    typeof row.id !== "string" ||
    !row.id.trim() ||
    row.id.length > 300 ||
    typeof row.summary !== "string" ||
    !row.summary.trim() ||
    row.summary.length > 4_000 ||
    !RISKS.includes(row.risk as ApprovalRequest["risk"]) ||
    !STATUSES.includes(row.status as ApprovalStatus) ||
    !canonicalDate(row.requestedAt) ||
    !canonicalDate(row.expiresAt) ||
    Date.parse(row.expiresAt) <= Date.parse(row.requestedAt)
  ) {
    return false;
  }
  return !(
    (row.decidedByDeviceId !== undefined &&
      (typeof row.decidedByDeviceId !== "string" || !row.decidedByDeviceId.trim())) ||
    (row.decidedAt !== undefined && !canonicalDate(row.decidedAt))
  );
}

function toStored(r: ApprovalRequest): StoredApproval {
  return {
    id: r.id,
    summary: r.summary,
    risk: r.risk,
    requestedAt: r.requestedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    status: r.status,
    decidedByDeviceId: r.decidedByDeviceId,
    decidedAt: r.decidedAt?.toISOString(),
  };
}

function fromStored(s: StoredApproval): ApprovalRequest {
  return {
    id: s.id,
    summary: s.summary,
    risk: s.risk,
    requestedAt: new Date(s.requestedAt),
    expiresAt: new Date(s.expiresAt),
    status: s.status,
    decidedByDeviceId: s.decidedByDeviceId,
    decidedAt: s.decidedAt ? new Date(s.decidedAt) : undefined,
  };
}

function readAll(): StoredApproval[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((value): value is StoredApproval => {
      if (!isStoredApproval(value) || seen.has(value.id)) return false;
      seen.add(value.id);
      return true;
    });
  } catch {
    return [];
  }
}

function writeAll(rows: StoredApproval[]): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

/**
 * List every approval, expiring any that timed out while nothing was watching.
 * Expiry is applied on READ so a request cannot appear "pending" forever just
 * because no tab was open when it lapsed.
 *
 * A request that expires HERE also notifies, because the user was waiting on a
 * decision that will now never happen — silently flipping it to "expired" would
 * leave them expecting an outcome that never arrives.
 */
export function listApprovals(now: Date = new Date()): ApprovalRequest[] {
  const before = readAll().map(fromStored);
  const rows = before.map((r) => expireIfDue(r, now));

  for (let i = 0; i < rows.length; i++) {
    if (before[i].status === "pending" && rows[i].status === "expired") {
      void notify(expiredNotification(rows[i]));
    }
  }

  // Persist the expiries so every surface agrees on the state.
  writeAll(rows.map(toStored));
  return rows;
}

/** Raise an approval. Returns the created request. */
export function requestApproval(
  input: { id?: string; summary: string; risk: ApprovalRequest["risk"] },
  now: Date = new Date(),
): ApprovalRequest {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("An approval requires a valid request time.");
  }
  const id =
    input.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : `a-${now.getTime()}`);
  if (readAll().some((row) => row.id === id)) {
    throw new Error("An approval with this id already exists; no duplicate was created.");
  }
  const request = createApprovalRequest({
    id,
    summary: input.summary,
    risk: input.risk,
    now,
  });
  if (!writeAll([...readAll(), toStored(request)])) {
    throw new Error(
      "This approval could not be saved. OCADE will not claim that a phone can decide it.",
    );
  }

  // Alert the paired phone. Fire-and-forget: the desktop must not block on a
  // notification, and with no transport connected this reports unavailable
  // rather than failing the approval.
  void notify(approvalNotification(request));

  return request;
}

/** Record a decision. Returns the updated request, or null if it is gone. */
export function saveApprovalStatus(
  id: string,
  status: ApprovalStatus,
  deviceId?: string,
  now: Date = new Date(),
): ApprovalRequest | null {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const current = fromStored(rows[idx]);
  const fresh = expireIfDue(current, now);
  if (fresh.status !== "pending") {
    if (fresh.status !== current.status) {
      rows[idx] = toStored(fresh);
      writeAll(rows);
    }
    return null;
  }
  if (!["approved", "denied", "cancelled"].includes(status)) return null;
  rows[idx] = {
    ...rows[idx],
    status,
    decidedByDeviceId: deviceId ?? rows[idx].decidedByDeviceId,
    decidedAt: now.toISOString(),
  };
  return writeAll(rows) ? fromStored(rows[idx]) : null;
}

/** Drop decided/expired rows so the list does not grow without bound. */
export function pruneApprovals(now: Date = new Date()): number {
  const rows = readAll()
    .map(fromStored)
    .map((r) => expireIfDue(r, now));
  const keep = rows.filter((r) => r.status === "pending");
  writeAll(keep.map(toStored));
  return rows.length - keep.length;
}

/** Remove everything — used when a device is revoked or the user clears state. */
export function clearApprovals(): void {
  writeAll([]);
}
