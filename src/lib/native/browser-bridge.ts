/**
 * OCADE browser control bridge (Plan §26).
 *
 * Contract + policy engine for driving a browser through the signed companion
 * by the companion-supervised Playwright/CDP host. This module is the DECISION layer: it decides what is
 * permitted, what needs confirmation and what is refused. Execution lives in the
 * companion; with none connected every action reports honestly as unavailable.
 *
 * Security posture:
 *  - page content is UNTRUSTED — never treated as instructions (Plan §31);
 *  - per-site permissions, with an explicit allowlist and denylist;
 *  - private/incognito windows are off-limits;
 *  - protected fields (passwords, OTPs, payment, CAPTCHA) can never be filled
 *    or read — OCADE pauses and the user completes them personally;
 *  - any submit that could be consequential requires explicit confirmation.
 */
import { type ActionRisk } from "./companion-bridge";
import { isProtectedText } from "@/lib/security/protected-text";
import {
  hasProtectedFields,
  screenshotRedaction,
  type PageSummary,
  type ScreenshotRedaction,
} from "./browser-dom";

export type BrowserActionKind =
  | "tabs.list"
  | "tab.activate"
  | "tab.create"
  | "navigate"
  | "dom.read"
  | "a11y.read"
  | "screenshot"
  | "page.wait"
  | "form.fill"
  | "form.submit"
  | "download"
  | "upload"
  | "drop";

export interface BrowserTarget {
  /** Last known CSS selector. It is tried first but never trusted alone. */
  selector?: string;
  /** Stable semantic fallbacks used when the DOM changed. */
  role?: string;
  name?: string;
  text?: string;
}

export type BrowserAction =
  | { kind: "tabs.list" }
  | { kind: "tab.activate"; tabId: string }
  | { kind: "tab.create"; url: string }
  | { kind: "navigate"; url: string }
  | { kind: "dom.read"; url: string }
  | { kind: "a11y.read"; url: string }
  | { kind: "screenshot"; url: string }
  | {
      kind: "page.wait";
      url: string;
      expectation: { text?: string; target?: BrowserTarget };
      timeoutMs: number;
    }
  | {
      kind: "form.fill";
      url: string;
      fields: { name: string; value: string; target?: BrowserTarget }[];
    }
  | { kind: "form.submit"; url: string; consequential: boolean; target?: BrowserTarget }
  | { kind: "download"; url: string; filename: string; target?: BrowserTarget }
  | { kind: "upload"; url: string; path: string; target?: BrowserTarget }
  | { kind: "drop"; url: string; path: string; target: BrowserTarget };

export interface SitePolicy {
  /** Origins OCADE may act on at all. Empty = nothing is allowed. */
  allowOrigins: string[];
  /** Explicit blocks; always win over the allowlist. */
  denyOrigins: string[];
  /** Origins where reading page content is additionally permitted. */
  readOrigins: string[];
  /** Origins where form filling is permitted (never protected fields). */
  fillOrigins: string[];
  /** Allow acting inside a private/incognito context. Always false. */
  allowPrivate: false;
}

export const DEFAULT_SITE_POLICY: SitePolicy = {
  allowOrigins: [],
  denyOrigins: [],
  readOrigins: [],
  fillOrigins: [],
  allowPrivate: false,
};

/**
 * WHERE THE SITE POLICY LIVES, AND WHY IT MOVED.
 *
 * It was `localStorage`, per browser. That made a REVOCATION local to whichever
 * browser performed it: somebody who removes a bank from the allow list on a
 * laptop leaves it allowed on every other browser they have signed in on. A
 * permission is exactly the thing that has to be account-wide, so the authority
 * is `ocade_browser_site_policy` — one row per account.
 *
 * IT IS STILL READ SYNCHRONOUSLY, from a cache this module holds in memory,
 * because it is consulted at DISPATCH TIME — before every browser action. A
 * round trip there would put the network in the path of every click, and a
 * failed round trip would have to either block the action or wave it through.
 *
 * THE CACHE FAILS CLOSED. Until `loadBrowserSitePolicy` has succeeded in this
 * tab, the answer is the default: nothing allowed. An empty policy refuses
 * actions that should have been permitted, which is a visible inconvenience; a
 * remembered policy would permit actions that were revoked, which is not
 * visible at all.
 */
let cachedPolicy: SitePolicy = { ...DEFAULT_SITE_POLICY };

function normalisePolicy(row: Partial<Record<string, unknown>> | null): SitePolicy {
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  return {
    allowOrigins: list(row?.allow_origins),
    denyOrigins: list(row?.deny_origins),
    readOrigins: list(row?.read_origins),
    fillOrigins: list(row?.fill_origins),
    // Never stored, never configurable. See the migration.
    allowPrivate: false,
  };
}

/**
 * Read the policy in force, without waiting.
 *
 * Returns the account's policy once it has been loaded in this tab, and the
 * refuse-everything default before that.
 */
export function readBrowserSitePolicy(): SitePolicy {
  return { ...cachedPolicy };
}

/** Fetch the account's policy and make it the one dispatch will read. */
export async function loadBrowserSitePolicy(): Promise<SitePolicy> {
  const { loadSupabaseClient } = await import("@/integrations/supabase/on-demand");
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_browser_site_policy")
    .select("allow_origins, deny_origins, read_origins, fill_origins")
    .maybeSingle();
  if (error) throw new Error(error.message);
  /*
   * No row is not a failure: it is somebody who has never granted a site. The
   * default is refusal, so an account with no row and an account that allows
   * nothing are the same thing, and both are correct.
   */
  cachedPolicy = normalisePolicy(data as Record<string, unknown> | null);
  return { ...cachedPolicy };
}

/**
 * Change the policy.
 *
 * The cache is updated ONLY after the account has agreed. Updating it first
 * would let a failed save leave this tab acting on a permission that was never
 * recorded — and on a permissions screen that is the worst possible lie.
 */
export async function saveBrowserSitePolicy(next: SitePolicy): Promise<SitePolicy> {
  const { loadSupabaseClient } = await import("@/integrations/supabase/on-demand");
  const supabase = await loadSupabaseClient();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Sign in before changing site permissions.");

  const { error } = await supabase.from("ocade_browser_site_policy").upsert(
    {
      user_id: userId,
      allow_origins: next.allowOrigins,
      deny_origins: next.denyOrigins,
      read_origins: next.readOrigins,
      fill_origins: next.fillOrigins,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  cachedPolicy = { ...next, allowPrivate: false };
  return { ...cachedPolicy };
}

/** Forget the loaded policy. Called on sign-out: the next account is not this one. */
export function forgetBrowserSitePolicy(): void {
  cachedPolicy = { ...DEFAULT_SITE_POLICY };
}

/** Field names that must never be auto-filled or read. */
const PROTECTED_FIELD =
  /(pass|pwd|otp|code|cvv|cvc|card|iban|ssn|secret|token|pin|captcha|security[-_ ]?answer|recovery)/i;

export function isProtectedField(name: string): boolean {
  return PROTECTED_FIELD.test(name);
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export type BrowserDecision =
  | { allow: true; risk: ActionRisk; requiresConfirmation: boolean }
  | { allow: false; reason: string };

/**
 * Decide whether a browser action may proceed. Pure and total — an unknown or
 * malformed action is refused rather than assumed safe.
 */
export function decideBrowserAction(
  action: BrowserAction,
  policy: SitePolicy,
  ctx: {
    isPrivateWindow?: boolean;
    /**
     * What was actually observed on the page. When supplied, it can only ever
     * RAISE the risk tier — never lower it.
     */
    pageSummary?: PageSummary;
  } = {},
): BrowserDecision {
  // Private/incognito is never in scope.
  if (ctx.isPrivateWindow) {
    return { allow: false, reason: "OCADE does not act inside private windows." };
  }

  // Listing tabs is metadata only and needs no origin.
  if (action.kind === "tabs.list") {
    return { allow: true, risk: "read_only", requiresConfirmation: false };
  }
  if (action.kind === "tab.activate") {
    return { allow: true, risk: "low", requiresConfirmation: false };
  }

  const url = action.url;
  const origin = originOf(url);
  if (!origin) {
    return { allow: false, reason: "That address is not a valid website." };
  }
  if (policy.denyOrigins.includes(origin)) {
    return { allow: false, reason: `${origin} is on your blocked list.` };
  }
  if (!policy.allowOrigins.includes(origin)) {
    return {
      allow: false,
      reason: `OCADE has no permission for ${origin}. Add it to the allowed sites first.`,
    };
  }

  switch (action.kind) {
    case "tab.create":
    case "navigate":
      return { allow: true, risk: "low", requiresConfirmation: false };

    case "dom.read":
    case "a11y.read":
    case "screenshot":
    case "page.wait": {
      if (!policy.readOrigins.includes(origin)) {
        return { allow: false, reason: `Reading page content on ${origin} is not permitted.` };
      }
      return { allow: true, risk: "read_only", requiresConfirmation: false };
    }

    case "form.fill": {
      if (!policy.fillOrigins.includes(origin)) {
        return { allow: false, reason: `Filling forms on ${origin} is not permitted.` };
      }
      const blocked = action.fields.find(
        (f) => isProtectedField(f.name) || isProtectedText(f.value),
      );
      if (blocked) {
        return {
          allow: false,
          reason:
            "That form includes protected information. OCADE will pause — please enter it yourself.",
        };
      }
      return { allow: true, risk: "confirm", requiresConfirmation: true };
    }

    case "form.submit": {
      if (!policy.fillOrigins.includes(origin)) {
        return { allow: false, reason: `Submitting forms on ${origin} is not permitted.` };
      }
      // `consequential` is DECLARED by the caller, which may simply not know.
      // If the page itself shows a password, payment or one-time-code field,
      // treat the submit as high risk regardless of what was declared — a
      // self-reported flag must never be the only thing standing between the
      // user and a checkout or an account creation.
      const observedSensitive = ctx.pageSummary ? hasProtectedFields(ctx.pageSummary) : false;
      return action.consequential || observedSensitive
        ? { allow: true, risk: "high", requiresConfirmation: true }
        : { allow: true, risk: "confirm", requiresConfirmation: true };
    }

    case "download":
      return { allow: true, risk: "confirm", requiresConfirmation: true };

    case "upload":
    case "drop":
      if (!policy.fillOrigins.includes(origin)) {
        return { allow: false, reason: `Uploading files on ${origin} is not permitted.` };
      }
      return { allow: true, risk: "high", requiresConfirmation: true };

    default:
      return { allow: false, reason: "OCADE does not support that browser action." };
  }
}

/* ------------------------------------------------------------- executor -- */

export interface BrowserBridgeStatus {
  available: boolean;
  reason?: string;
  identity?: {
    host: "ocade-managed-browser";
    protocolVersion: number;
    browser?: "chrome" | "edge";
    sessionId?: string;
  };
}

export interface BrowserActionResult {
  ok: boolean;
  detail: string;
  /**
   * Page content, already wrapped as UNTRUSTED data by the injection guard.
   * Only ever set for read actions. Callers must pass this to the model as-is —
   * unwrapping it would defeat the guard.
   */
  content?: string;
  /** Injection risk detected while reading. `high` means warn the user. */
  injectionRisk?: "none" | "low" | "high";
  /** Audit-safe structured evidence returned by the host. */
  observation?: unknown;
}

export interface BrowserFileHandoff {
  name: string;
  mimeType: string;
  /** Approved file bytes. Paths alone are never exposed to a web page. */
  dataBase64: string;
  sha256?: string;
}

export interface BrowserVerificationExpectation {
  url?: string;
  text?: string;
  fields?: { name: string; value: string }[];
}

export interface PerformOptions {
  confirmed: boolean;
  runId?: string;
  operationId?: string;
  signal?: AbortSignal;
  fileHandoff?: BrowserFileHandoff;
  verification?: BrowserVerificationExpectation;
  /**
   * Masking in the managed host MUST apply before a screenshot is captured. Always
   * present for `screenshot` actions — a bridge that ignores it is a bug, and a
   * capture must never be taken without it.
   */
  redaction?: ScreenshotRedaction;
}

export interface BrowserBridge {
  status(): Promise<BrowserBridgeStatus>;
  perform(action: BrowserAction, opts: PerformOptions): Promise<BrowserActionResult>;
  verify?(
    action: BrowserAction,
    expectation: BrowserVerificationExpectation,
    opts: Pick<PerformOptions, "runId" | "operationId" | "signal">,
  ): Promise<{ verified: boolean; evidence: string }>;
  cancel?(runId: string): Promise<{ acknowledged: boolean; detail: string }>;
  progress?(runId: string): Promise<BrowserRunProgress>;
  emergencyStop?(): Promise<{ acknowledged: boolean; detail: string }>;
}

export interface BrowserRunProgress {
  status: "unknown" | "running" | "completed" | "failed" | "cancelled" | "stopped";
  kind: string | null;
  operationId: string | null;
  detail?: string;
  updatedAt: string | null;
}

export const BROWSER_BRIDGE_UNAVAILABLE =
  "Browser control needs the OCADE Native Companion and a managed Chrome or Edge session, which isn't connected.";

/**
 * Active bridge until the managed companion host is connected. Refuses everything
 * loudly — it never reports a fabricated success.
 */
export class UnavailableBrowserBridge implements BrowserBridge {
  constructor(private readonly reason = BROWSER_BRIDGE_UNAVAILABLE) {}

  async status(): Promise<BrowserBridgeStatus> {
    return { available: false, reason: this.reason };
  }
  async perform(_action: BrowserAction, _opts: PerformOptions): Promise<BrowserActionResult> {
    return { ok: false, detail: this.reason };
  }
}

let bridge: BrowserBridge = new UnavailableBrowserBridge();

export function getBrowserBridge(): BrowserBridge {
  return bridge;
}

/** Installed by the desktop build once the signed companion browser host verifies. */
export function setBrowserBridge(next: BrowserBridge): void {
  bridge = next;
}

/**
 * End-to-end guarded dispatch: policy decision first, confirmation second,
 * execution last. Returns an honest refusal instead of throwing.
 */
export async function dispatchBrowserAction(
  action: BrowserAction,
  policy: SitePolicy,
  opts: {
    confirmed?: boolean;
    isPrivateWindow?: boolean;
    /** Latest summary of the target page, when one has already been read. */
    pageSummary?: PageSummary;
    runId?: string;
    operationId?: string;
    signal?: AbortSignal;
    fileHandoff?: BrowserFileHandoff;
    verification?: BrowserVerificationExpectation;
  } = {},
): Promise<BrowserActionResult> {
  if (opts.signal?.aborted) {
    return { ok: false, detail: "This browser action was cancelled before it started." };
  }
  const decision = decideBrowserAction(action, policy, {
    isPrivateWindow: opts.isPrivateWindow,
    pageSummary: opts.pageSummary,
  });
  if (!decision.allow) return { ok: false, detail: decision.reason };
  if (decision.requiresConfirmation && !opts.confirmed) {
    return { ok: false, detail: "This action needs your confirmation first." };
  }

  // A screenshot may never leave here without masking instructions. When no page
  // summary is available we still send the baseline credential masks rather than
  // capturing an unmasked frame.
  const redaction =
    action.kind === "screenshot"
      ? screenshotRedaction(
          opts.pageSummary ?? {
            url: action.url,
            title: "",
            headings: [],
            text: "",
            fields: [],
            links: [],
          },
        )
      : undefined;

  return getBrowserBridge().perform(action, {
    confirmed: Boolean(opts.confirmed),
    runId: opts.runId,
    operationId: opts.operationId,
    signal: opts.signal,
    fileHandoff: opts.fileHandoff,
    verification: opts.verification,
    ...(redaction ? { redaction } : {}),
  });
}

export type BrowserReceiptStatus = "failed" | "completed_unverified" | "completed_verified";

export interface BrowserActionReceipt {
  runId: string;
  operationId: string;
  action: BrowserActionKind;
  origin: string | null;
  status: BrowserReceiptStatus;
  executionEvidence: string;
  verificationEvidence: string | null;
  recordedAt: string;
}

export interface BrowserRunResult {
  ok: boolean;
  result: BrowserActionResult;
  receipt: BrowserActionReceipt;
}

const READ_ACTIONS = new Set<BrowserActionKind>([
  "tabs.list",
  "dom.read",
  "a11y.read",
  "screenshot",
  "page.wait",
]);

/**
 * Execute one browser action and mint a receipt only from observed evidence.
 * Mutations require a separate post-action observation to become verified.
 */
export async function runBrowserAction(
  action: BrowserAction,
  policy: SitePolicy,
  opts: {
    runId: string;
    operationId: string;
    confirmed?: boolean;
    isPrivateWindow?: boolean;
    pageSummary?: PageSummary;
    signal?: AbortSignal;
    fileHandoff?: BrowserFileHandoff;
    verification?: BrowserVerificationExpectation;
    now?: Date;
  },
): Promise<BrowserRunResult> {
  const result = await dispatchBrowserAction(action, policy, opts);
  const base = {
    runId: opts.runId,
    operationId: opts.operationId,
    action: action.kind,
    origin: "url" in action ? originOf(action.url) : null,
    recordedAt: (opts.now ?? new Date()).toISOString(),
  };
  if (!result.ok) {
    return {
      ok: false,
      result,
      receipt: {
        ...base,
        status: "failed",
        executionEvidence: result.detail,
        verificationEvidence: null,
      },
    };
  }

  if (READ_ACTIONS.has(action.kind)) {
    return {
      ok: true,
      result,
      receipt: {
        ...base,
        status: "completed_verified",
        executionEvidence: result.detail,
        verificationEvidence: "The requested browser observation was returned by the paired host.",
      },
    };
  }

  const active = getBrowserBridge();
  if (!opts.verification || !active.verify) {
    return {
      ok: false,
      result,
      receipt: {
        ...base,
        status: "completed_unverified",
        executionEvidence: result.detail,
        verificationEvidence:
          "The extension acknowledged the action, but no independent post-action observation was available.",
      },
    };
  }

  let verification: { verified: boolean; evidence: string };
  try {
    verification = await active.verify(action, opts.verification, {
      runId: opts.runId,
      operationId: opts.operationId,
      signal: opts.signal,
    });
  } catch (error) {
    verification = {
      verified: false,
      evidence:
        error instanceof Error
          ? error.message
          : "The independent browser observation failed unexpectedly.",
    };
  }
  return {
    ok: verification.verified,
    result,
    receipt: {
      ...base,
      status: verification.verified ? "completed_verified" : "completed_unverified",
      executionEvidence: result.detail,
      verificationEvidence: verification.evidence,
    },
  };
}

export async function cancelBrowserRun(
  runId: string,
): Promise<{ acknowledged: boolean; detail: string }> {
  const active = getBrowserBridge();
  if (!active.cancel) {
    return {
      acknowledged: false,
      detail: "The connected browser host cannot acknowledge cancellation.",
    };
  }
  try {
    return await active.cancel(runId);
  } catch (error) {
    return {
      acknowledged: false,
      detail: error instanceof Error ? error.message : "Browser cancellation was not acknowledged.",
    };
  }
}

export async function getBrowserRunProgress(runId: string): Promise<BrowserRunProgress> {
  const active = getBrowserBridge();
  if (!active.progress) {
    return {
      status: "unknown",
      kind: null,
      operationId: null,
      detail: "The connected browser host does not expose progress.",
      updatedAt: null,
    };
  }
  try {
    return await active.progress(runId);
  } catch (error) {
    return {
      status: "unknown",
      kind: null,
      operationId: null,
      detail: error instanceof Error ? error.message : "Browser progress was unavailable.",
      updatedAt: null,
    };
  }
}

export async function emergencyStopBrowserControl(): Promise<{
  acknowledged: boolean;
  detail: string;
}> {
  const active = getBrowserBridge();
  if (!active.emergencyStop) {
    return {
      acknowledged: false,
      detail: "The connected browser host cannot acknowledge an emergency stop.",
    };
  }
  try {
    return await active.emergencyStop();
  } catch (error) {
    return {
      acknowledged: false,
      detail:
        error instanceof Error ? error.message : "Browser emergency stop was not acknowledged.",
    };
  }
}
