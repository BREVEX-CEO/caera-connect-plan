/**
 * HWE-38 — opt-in, privacy-safe failure telemetry (P18.S01).
 *
 * There was no telemetry of any kind. That is a defensible starting position —
 * shipping none is safer than shipping careless telemetry — but it also means
 * nobody can tell which applications OCADE fails on, which is exactly the
 * information the compatibility work needs.
 *
 * So the bar here is high, and the design is shaped by one assumption: A CRASH
 * REPORT IS THE MOST DANGEROUS THING A PRODUCT SENDS. It is generated at the
 * moment things went wrong, from state nobody curated, and it routinely carries
 * file paths, window titles, clipboard fragments and whatever the user was
 * typing. Redaction has to be the default and the failure mode, not a filter
 * applied on the way out.
 *
 * Four rules:
 *
 *   1. OFF UNTIL ASKED. No implicit consent, no "improve the product" default,
 *      no pre-ticked box. `consent` starts `none` and nothing queues without it.
 *   2. ALLOW-LIST, NOT DENY-LIST. Only fields named here are ever transmitted.
 *      A deny-list fails open — the field someone adds next week is sent by
 *      default, and that is how leaks happen.
 *   3. REDACT BEFORE STORING, not before sending. A report that sits in a queue
 *      with a password in it has already been written to disk.
 *   4. THE USER CAN READ WHAT WOULD BE SENT. Anything else is asking for trust
 *      that cannot be checked.
 */

export type TelemetryConsent = "none" | "failures_only" | "failures_and_performance";

/**
 * The ONLY fields that may leave the device.
 *
 * Deliberately boring and low-cardinality. Anything identifying a person, a
 * document or a machine is absent by construction rather than removed later.
 */
export const ALLOWED_FIELDS = [
  "schemaVersion",
  "occurredAt",
  "kind",
  "route",
  "appId",
  "appVersion",
  "osFamily",
  "osVersion",
  "ocadeVersion",
  "failureCode",
  "durationMs",
  "retryCount",
  "installId",
] as const;
export type AllowedField = (typeof ALLOWED_FIELDS)[number];

export type FailureKind =
  | "control_route_failed"
  | "local_model_failed"
  | "webhook_rejected"
  | "sandbox_refused"
  | "pairing_failed"
  | "unknown";

export interface RawFailure {
  kind: FailureKind;
  failureCode: string;
  route?: string;
  appId?: string;
  appVersion?: string;
  durationMs?: number;
  retryCount?: number;
  /** Anything else the caller had. NONE of this is transmitted. */
  [extra: string]: unknown;
}

export interface TelemetryEnvironment {
  osFamily: string;
  osVersion: string;
  ocadeVersion: string;
  /** Random per install. NOT a user id — see `newInstallId`. */
  installId: string;
}

export type TelemetryReport = Partial<Record<AllowedField, string | number>> & {
  schemaVersion: 1;
  occurredAt: string;
  kind: FailureKind;
  failureCode: string;
};

/**
 * Patterns that must never appear in a transmitted value.
 *
 * This is a SECOND line of defence, not the first. The allow-list already
 * excludes free text; this catches an allowed field that unexpectedly contains
 * something sensitive — a failure code built from a file path, say.
 */
const SENSITIVE = [
  { name: "absolute path", re: /(?:[A-Za-z]:\\|\/(?:home|Users|var|etc)\/)[^\s"']*/g },
  { name: "email", re: /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g },
  { name: "bearer token", re: /\b(?:sk-|ghp_|xox[baprs]-)[A-Za-z0-9_-]{10,}/g },
  /*
   * The `eyJ` prefix (base64 for `{"`) plus two dots is the strong signal, so
   * the per-segment minimum is deliberately low. Requiring long segments meant
   * a short or truncated token passed through unredacted — and a truncated
   * credential in a crash report is still a credential.
   */
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]+/g },
  { name: "ip address", re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g },
  { name: "long digit run", re: /\b\d{7,}\b/g },
];

export interface RedactionResult {
  value: string;
  redactions: string[];
}

/** Replace anything sensitive with a label naming what was removed. */
export function redact(input: string): RedactionResult {
  let value = input;
  const redactions: string[] = [];
  for (const { name, re } of SENSITIVE) {
    value = value.replace(new RegExp(re.source, re.flags), () => {
      redactions.push(name);
      return `[redacted ${name}]`;
    });
  }
  return { value, redactions };
}

/** Install id: random, never derived from anything about the user or machine. */
export function newInstallId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type QueueRefusal = "no_consent" | "performance_not_consented" | "queue_full";

export type QueueOutcome =
  | { queued: true; report: TelemetryReport; redactions: string[] }
  | { queued: false; refusal: QueueRefusal; reason: string };

/**
 * Build a transmittable report from a raw failure.
 *
 * Everything not in `ALLOWED_FIELDS` is dropped, including fields the caller
 * added that this module has never heard of. That is the point of an
 * allow-list: unknown data is discarded rather than forwarded.
 */
export function buildReport(
  raw: RawFailure,
  env: TelemetryEnvironment,
  occurredAt: Date,
): { report: TelemetryReport; redactions: string[] } {
  const candidate: Record<string, unknown> = {
    schemaVersion: 1,
    occurredAt: occurredAt.toISOString(),
    kind: raw.kind,
    route: raw.route,
    appId: raw.appId,
    appVersion: raw.appVersion,
    failureCode: raw.failureCode,
    durationMs: raw.durationMs,
    retryCount: raw.retryCount,
    osFamily: env.osFamily,
    osVersion: env.osVersion,
    ocadeVersion: env.ocadeVersion,
    installId: env.installId,
  };

  const report: Record<string, string | number> = {};
  const redactions: string[] = [];
  for (const field of ALLOWED_FIELDS) {
    const v = candidate[field];
    if (v === undefined || v === null) continue;
    if (typeof v === "number") {
      report[field] = v;
      continue;
    }
    const r = redact(String(v));
    report[field] = r.value;
    redactions.push(...r.redactions);
  }
  return { report: report as unknown as TelemetryReport, redactions };
}

export const MAX_QUEUE = 50;

/**
 * The queue. Redaction happens on the way IN.
 *
 * A report sitting here with a password in it has already been written to disk
 * if this queue is ever persisted, so redacting on the way out would be too
 * late.
 */
export class TelemetryQueue {
  private consent: TelemetryConsent = "none";
  private readonly items: TelemetryReport[] = [];

  constructor(
    private readonly env: TelemetryEnvironment,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Consent is explicit and revocable. Revoking DISCARDS what was queued. */
  setConsent(next: TelemetryConsent): void {
    this.consent = next;
    if (next === "none") this.items.length = 0;
  }

  get currentConsent(): TelemetryConsent {
    return this.consent;
  }

  record(raw: RawFailure): QueueOutcome {
    if (this.consent === "none") {
      return {
        queued: false,
        refusal: "no_consent",
        reason: "Failure reporting is off, so nothing was collected.",
      };
    }
    if (raw.kind === "unknown" && this.consent !== "failures_and_performance") {
      return {
        queued: false,
        refusal: "performance_not_consented",
        reason: "Only failures are shared, and this is not a failure.",
      };
    }
    if (this.items.length >= MAX_QUEUE) {
      // Drop NEW reports rather than evicting old ones: the first failure in a
      // cascade is the one worth keeping, and an unbounded queue is a disk-fill
      // an attacker can drive.
      return {
        queued: false,
        refusal: "queue_full",
        reason: "The report queue is full; the earliest failures are kept.",
      };
    }
    const { report, redactions } = buildReport(raw, this.env, this.now());
    this.items.push(report);
    return { queued: true, report, redactions };
  }

  /** Exactly what would be transmitted, for the user to read. */
  pending(): TelemetryReport[] {
    return this.items.map((r) => ({ ...r }));
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Prove a report carries no field outside the allow-list.
 *
 * Used by tests and by the panel, so "only allowed fields are sent" is a
 * checkable property rather than a claim in a comment.
 */
export function containsOnlyAllowedFields(report: object): { ok: boolean; extra: string[] } {
  const extra = Object.keys(report).filter(
    (k) => !(ALLOWED_FIELDS as readonly string[]).includes(k),
  );
  return { ok: extra.length === 0, extra };
}
