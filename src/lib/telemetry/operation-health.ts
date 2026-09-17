/**
 * WHAT THE PRODUCT IS DOING, IN A SHAPE THAT CANNOT CARRY ANYBODY'S WORK.
 *
 * `PLAN.md` Phase 16 asks for "privacy-safe structured diagnostics for
 * release/operation/error class/latency/provider slot/task/Edge Function/
 * webhook health without secrets or unnecessary content".
 *
 * `failure-telemetry.ts` already owns the consent, the allow-list, the
 * redaction and the queue, and it stays the authority for all four -- this is
 * not a second telemetry stack. What it did not have was a vocabulary: it
 * could say a control route failed on a route, and nothing at all about
 * whether the Edge Function answered, which provider slot served, how long an
 * operation took, or whether a webhook was accepted. So this module supplies
 * the vocabulary and the coercion, and hands the result to that queue.
 *
 * ENUMERATED, NOT FREE TEXT, AND THAT IS THE PRIVACY PROPERTY. Every field
 * here is one of a fixed set of values known at build time. A caller cannot
 * put a prompt, a file name, an email address or an API key into an
 * `ErrorClass`, because an unrecognised value does not pass through at all: it
 * is replaced by the fallback for that field. Redaction is a second line; this
 * is the first, and it is the stronger one, because it cannot be defeated by a
 * pattern nobody thought to write.
 *
 * LATENCY IS A BUCKET. A millisecond count is a fingerprint: a handful of
 * exact durations identify a session across reports. Buckets answer the
 * question diagnostics actually asks -- "is this path slow" -- and identify
 * nobody.
 *
 * THE PROVIDER SLOT IS AN ORDINAL. `primary`, `secondary`, `tertiary`: which
 * of the three server-side secret slots served, never which key, never a
 * fragment of one. The browser has never held these keys and this record does
 * not change that.
 */

// Relative and extensioned: this module is bundled into the Supabase Edge
// Function, where the "@/" alias does not exist.
import { OCADE_RELEASE_VERSION } from "../release.ts";

/** The part of the product a record is about. */
export const HEALTH_COMPONENTS = [
  "web",
  "edge_function",
  "webhook",
  "task",
  "provider",
  "model",
  "database",
] as const;
export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];

/**
 * The operations worth watching, named once.
 *
 * Deliberately coarse. "Which operation" is a question with a small answer;
 * anything finer becomes a per-user trace, which is the thing this refuses to
 * be.
 */
export const HEALTH_OPERATIONS = [
  "page_load",
  "sign_in",
  "conversation_send",
  "conversation_load",
  "generation",
  "file_upload",
  "file_download",
  "task_run",
  "automation_run",
  "webhook_receipt",
  "model_prepare",
  "backup_restore",
] as const;
export type HealthOperation = (typeof HEALTH_OPERATIONS)[number];

/**
 * WHY something failed, at the resolution an operator can act on.
 *
 * Not the message. A message is prose somebody wrote, it changes between
 * releases, and it is where user content leaks into a log. A class is a
 * decision: `quota` means wait, `auth` means credentials, `upstream` means it
 * was not us.
 */
export const ERROR_CLASSES = [
  "none",
  "auth",
  "permission",
  "validation",
  "conflict",
  "quota",
  "timeout",
  "transport",
  "upstream",
  "internal",
  "cancelled",
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** Which of the three server-side secret slots served. Never which key. */
export const PROVIDER_SLOTS = ["primary", "secondary", "tertiary", "local", "none"] as const;
export type ProviderSlot = (typeof PROVIDER_SLOTS)[number];

/** Latency, at a resolution that describes a path and identifies no session. */
export const LATENCY_BUCKETS = [
  "under_100ms",
  "under_500ms",
  "under_1s",
  "under_3s",
  "under_10s",
  "under_30s",
  "over_30s",
] as const;
export type LatencyBucket = (typeof LATENCY_BUCKETS)[number];

export type HealthOutcome = "succeeded" | "failed" | "refused";

function latencyBucketFor(durationMs: number): LatencyBucket {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "under_100ms";
  if (durationMs < 100) return "under_100ms";
  if (durationMs < 500) return "under_500ms";
  if (durationMs < 1_000) return "under_1s";
  if (durationMs < 3_000) return "under_3s";
  if (durationMs < 10_000) return "under_10s";
  if (durationMs < 30_000) return "under_30s";
  return "over_30s";
}

/**
 * A finished health record. Every field is an enumerated value or a count.
 *
 * There is no `message`, no `detail`, no `context` and no index signature,
 * and each absence is deliberate: a free-text field is how a diagnostic record
 * becomes a copy of what somebody typed.
 */
export interface HealthRecord {
  schemaVersion: 1;
  /** Which release produced it, so a regression can be dated. */
  release: string;
  component: HealthComponent;
  operation: HealthOperation;
  outcome: HealthOutcome;
  errorClass: ErrorClass;
  latencyBucket: LatencyBucket;
  providerSlot: ProviderSlot;
  /** How many attempts this operation took, capped so it stays a count. */
  attempts: number;
}

export interface HealthObservation {
  component: HealthComponent;
  operation: HealthOperation;
  outcome: HealthOutcome;
  errorClass?: ErrorClass;
  durationMs?: number;
  providerSlot?: ProviderSlot;
  attempts?: number;
}

const MAX_ATTEMPTS = 99;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Build a record, coercing anything unrecognised rather than passing it on.
 *
 * The coercion is the whole design. A caller that hands in
 * `errorClass: "user said: my password is hunter2"` does not get that string
 * stored, truncated or hashed: it gets `internal`, a value meaning "something
 * broke and this record cannot say what". That is the honest answer, and it
 * carries nothing.
 */
export function buildHealthRecord(observation: HealthObservation): HealthRecord {
  const outcome = oneOf<HealthOutcome>(
    ["succeeded", "failed", "refused"],
    observation.outcome,
    "failed",
  );
  const declared = oneOf<ErrorClass>(ERROR_CLASSES, observation.errorClass, "internal");
  return {
    schemaVersion: 1,
    release: OCADE_RELEASE_VERSION,
    component: oneOf(HEALTH_COMPONENTS, observation.component, "web"),
    operation: oneOf(HEALTH_OPERATIONS, observation.operation, "page_load"),
    outcome,
    // A success has no error class, whatever the caller passed.
    errorClass: outcome === "succeeded" ? "none" : declared === "none" ? "internal" : declared,
    latencyBucket: latencyBucketFor(observation.durationMs ?? 0),
    providerSlot: oneOf(PROVIDER_SLOTS, observation.providerSlot, "none"),
    attempts: Math.min(
      MAX_ATTEMPTS,
      Math.max(1, Math.trunc(Number(observation.attempts ?? 1)) || 1),
    ),
  };
}

/**
 * Roll records up into what an operator actually reads.
 *
 * Counts per component, operation and error class. This is what a status
 * screen or an alert threshold consumes; individual records are not
 * interesting and keeping them around is how a diagnostic store turns into a
 * history of one person's day.
 */
export interface HealthRollup {
  key: string;
  component: HealthComponent;
  operation: HealthOperation;
  total: number;
  failed: number;
  refused: number;
  slowest: LatencyBucket;
  errorClasses: Partial<Record<ErrorClass, number>>;
}
