/**
 * ADMIN-04 / ADMIN-05: two people, a time limit, a record.
 *
 * An operator export or a break-glass change needs an approval from a SECOND
 * staff member. The approval is a signed, expiring token bound to the kind of
 * action, its scope and the requester, so it cannot be reused for another
 * export, another service switch or another person. Pure functions: the caller
 * supplies the secret and the clock.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type DualControlKind = "audit_export" | "break_glass";

/** Break-glass lasts at most one hour; an export approval at most one day. */
export const MAX_TTL_MS: Record<DualControlKind, number> = {
  audit_export: 24 * 60 * 60 * 1000,
  break_glass: 60 * 60 * 1000,
};

/** An exported file is kept at most this long. */
export const EXPORT_RETENTION_DAYS = 7;

export interface Grant {
  kind: DualControlKind;
  scope: string;
  requester: string;
  approver: string;
  expiresAt: number;
}

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function issueGrant(
  input: Omit<Grant, "expiresAt"> & { ttlMs: number; now: number },
  secret: string,
): string {
  if (secret.length < 32) throw new Error("The approval secret is not configured.");
  if (input.approver === input.requester) throw new Error("A second person must approve this.");
  if (input.ttlMs <= 0 || input.ttlMs > MAX_TTL_MS[input.kind])
    throw new Error("That approval lasts too long.");
  const grant: Grant = {
    kind: input.kind,
    scope: input.scope,
    requester: input.requester,
    approver: input.approver,
    expiresAt: input.now + input.ttlMs,
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the grant when the token is genuine, unexpired and matches; otherwise throws one sentence. */
export function verifyGrant(
  token: string,
  expected: { kind: DualControlKind; scope: string; requester: string; now: number },
  secret: string,
): Grant {
  const refuse = () => new Error("That approval is not valid.");
  if (secret.length < 32) throw new Error("The approval secret is not configured.");
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) throw refuse();
  const want = Buffer.from(sign(payload, secret));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw refuse();
  let grant: Grant;
  try {
    grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Grant;
  } catch {
    throw refuse();
  }
  if (
    grant.kind !== expected.kind ||
    grant.scope !== expected.scope ||
    grant.requester !== expected.requester ||
    grant.approver === grant.requester
  )
    throw refuse();
  if (!(grant.expiresAt > expected.now)) throw new Error("That approval has expired.");
  return grant;
}

export const retentionDeadline = (now: number, days = EXPORT_RETENTION_DAYS) =>
  new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

const SECRET_KEY =
  /(secret|token|password|passwd|authorization|cookie|api[_-]?key|private[_-]?key|credential)/i;
const SECRET_VALUE =
  /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|sk_(live|test)_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const LONG_DIGITS = /\b\d(?:[ -]?\d){10,18}\b/g;

/** Field-level redaction for any operator export: secret-named fields, secret-shaped values, emails, long digit runs. */
export function redactForExport<T>(value: T): T {
  const walk = (node: unknown, key = ""): unknown => {
    if (node === null || node === undefined) return node;
    if (SECRET_KEY.test(key) && typeof node !== "boolean") return "[redacted]";
    if (typeof node === "string")
      return node
        .replace(SECRET_VALUE, "[redacted]")
        .replace(EMAIL, (_m, domain: string) => `***@${domain}`)
        .replace(LONG_DIGITS, "[redacted]");
    if (Array.isArray(node)) return node.map((item) => walk(item, key));
    if (typeof node === "object")
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, k)]));
    return node;
  };
  return walk(value) as T;
}
