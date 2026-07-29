/**
 * Tauri-backed companion adapter (Plan §23).
 *
 * Connects the app to the signed Rust command layer: every request is wrapped
 * in a `CompanionSession` envelope (monotonic counter + single-use nonce + MAC)
 * that `native/companion/safety/src/ipc.rs` verifies before anything touches
 * the machine.
 *
 * This adapter installs ITSELF only when genuinely running inside the signed
 * companion. In an ordinary browser `detectTauri()` is false and the honest
 * `UnavailableCompanion` stays active — the app never claims computer control
 * it does not have.
 */
import { CompanionSession } from "./companion-client";
import {
  COMPANION_UNAVAILABLE_REASON,
  getCompanion,
  guardAction,
  isProtectedText,
  redactForAudit,
  UnavailableCompanion,
  type CompanionAction,
  type CompanionApplication,
  type CompanionPermissionStatus,
  type CompanionStatus,
  type ExecuteOptions,
  type ExecuteResult,
  type NativeCompanionAdapter,
  setCompanionAdapter,
} from "./companion-bridge";
import type { NativeObservationAdapter, NativeObservationRequest } from "./automation-observer";
import { NativeCompanionRequiredError } from "../storage/types";

export const COMPANION_SESSION_CLOSED_REASON =
  "The secure companion session is closed. Reconnect before running computer actions.";

/** Minimal shape of the Tauri v2 bridge we rely on. */
interface TauriGlobal {
  core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  event?: {
    listen?: (name: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>;
  };
}

function tauriGlobal(): TauriGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __TAURI__?: TauriGlobal; __TAURI_INTERNALS__?: unknown };
  return w.__TAURI__ ?? null;
}

/** True only inside the real companion shell. */
export function detectTauri(): boolean {
  const g = tauriGlobal();
  return Boolean(g && (g.core?.invoke || g.invoke));
}

async function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const g = tauriGlobal();
  const fn = g?.core?.invoke ?? g?.invoke;
  if (!fn) throw new Error("The companion bridge is not available.");
  return fn(cmd, args);
}

/** One host-side audit record. Redacted before it ever reaches here. */
export interface AuditEntry {
  runId: string;
  /** Unix seconds. */
  at: number;
  detail: string;
  ok: boolean;
}

export interface TauriCompanionOptions {
  sessionId: string;
  /** Shared key established during pairing. Never leaves the machine. */
  key: Uint8Array;
  invokeFn?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}

function parseNativeOutput(value: unknown): ExecuteResult["output"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const output = value as Record<string, unknown>;
  if (
    output.kind === "screen_capture" &&
    typeof output.path === "string" &&
    !output.path.includes("\0") &&
    output.mimeType === "image/png" &&
    typeof output.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(output.sha256)
  ) {
    return {
      kind: "screen_capture",
      path: output.path,
      mimeType: "image/png",
      sha256: output.sha256,
    };
  }
  if (
    output.kind === "windows" &&
    Array.isArray(output.titles) &&
    output.titles.length <= 100 &&
    output.titles.every((title) => typeof title === "string" && title.length <= 256)
  ) {
    return { kind: "windows", titles: output.titles as string[] };
  }
  if (
    output.kind === "accessibility" &&
    Array.isArray(output.nodes) &&
    output.nodes.length <= 500 &&
    output.nodes.every(
      (node) =>
        Boolean(node) &&
        typeof node === "object" &&
        typeof (node as Record<string, unknown>).role === "string" &&
        String((node as Record<string, unknown>).role).length <= 80 &&
        typeof (node as Record<string, unknown>).name === "string" &&
        String((node as Record<string, unknown>).name).length <= 200 &&
        !isProtectedText(String((node as Record<string, unknown>).name)) &&
        typeof (node as Record<string, unknown>).enabled === "boolean",
    )
  ) {
    return {
      kind: "accessibility",
      nodes: output.nodes as Array<{ role: string; name: string; enabled: boolean }>,
    };
  }
  if (
    output.kind === "text" &&
    typeof output.value === "string" &&
    !isProtectedText(output.value)
  ) {
    return { kind: "text", value: output.value };
  }
  return undefined;
}

function parsePermissions(value: unknown): CompanionPermissionStatus[] {
  if (!Array.isArray(value)) return [];
  const states = new Set<CompanionPermissionStatus["state"]>([
    "granted",
    "denied",
    "unknown",
    "not_required",
  ]);
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.state === "string" &&
        states.has(item.state as CompanionPermissionStatus["state"]) &&
        typeof item.guidance === "string",
    )
    .map((item) => ({
      id: String(item.id).slice(0, 100),
      label: redactForAudit(String(item.label)).slice(0, 200),
      state: item.state as CompanionPermissionStatus["state"],
      guidance: redactForAudit(String(item.guidance)).slice(0, 500),
    }))
    .slice(0, 20);
}

/**
 * Signs and forwards actions to the Rust command layer.
 *
 * The client-side `guardAction` check is a courtesy that fails fast with a clear
 * message; the HOST re-validates everything, so a compromised page cannot widen
 * its own permissions by skipping it.
 */
export class TauriCompanion implements NativeCompanionAdapter, NativeObservationAdapter {
  private readonly session: CompanionSession;
  private readonly sessionId: string;
  private readonly call: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  private hostCapabilities: string[] | null = null;
  private halted = false;
  private closed = false;
  private closeAttempt: Promise<void> | null = null;

  constructor(opts: TauriCompanionOptions) {
    this.session = new CompanionSession(opts.sessionId, opts.key);
    this.sessionId = opts.sessionId;
    this.call = opts.invokeFn ?? invoke;
  }

  async status(): Promise<CompanionStatus> {
    if (this.closed) {
      return { available: false, reason: COMPANION_SESSION_CLOSED_REASON };
    }
    try {
      const raw = (await this.call("status")) as {
        available?: boolean;
        version?: string;
        halted?: boolean;
        reason?: string;
        capabilities?: string[];
        permissions?: unknown[];
        installGuidance?: unknown[];
      };
      this.halted = Boolean(raw?.halted);
      const available = Boolean(raw?.available) && !this.halted;
      this.hostCapabilities = available && Array.isArray(raw?.capabilities) ? raw.capabilities : [];
      const permissions = parsePermissions(raw?.permissions);
      const installGuidance = Array.isArray(raw?.installGuidance)
        ? raw.installGuidance
            .filter((item): item is string => typeof item === "string")
            .map((item) => redactForAudit(item).slice(0, 500))
            .slice(0, 20)
        : [];
      return {
        available,
        version: raw?.version,
        permissions,
        installGuidance,
        reason: this.halted
          ? "Emergency stop is active. Reset it before running actions."
          : available
            ? undefined
            : (raw?.reason ?? "This companion build reports no runtime-proven capabilities."),
      };
    } catch (e) {
      this.hostCapabilities = null;
      return {
        available: false,
        reason: e instanceof Error ? e.message : "The companion did not respond.",
      };
    }
  }

  async applications(): Promise<CompanionApplication[]> {
    if (this.closed) throw new Error(COMPANION_SESSION_CLOSED_REASON);
    const request = this.session.sign("application_inventory", {});
    const raw = await this.call("application_inventory", { request });
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .filter(
        (item) =>
          typeof item.appId === "string" &&
          typeof item.label === "string" &&
          Number.isSafeInteger(item.processId) &&
          typeof item.windowTitle === "string",
      )
      .filter(
        (item) =>
          !isProtectedText(String(item.appId)) &&
          !isProtectedText(String(item.label)) &&
          !isProtectedText(String(item.windowTitle)),
      )
      .map((item) => ({
        appId: String(item.appId).slice(0, 128),
        label: redactForAudit(String(item.label)).slice(0, 256),
        processId: Number(item.processId),
        windowTitle: redactForAudit(String(item.windowTitle)).slice(0, 256),
      }))
      .slice(0, 100);
  }

  /**
   * Action kinds THIS host build can actually perform, as reported by `status`.
   * Null until a successful status call — the UI must not guess.
   */
  capabilities(): string[] | null {
    return this.hostCapabilities;
  }

  /** True when emergency stop is latched and must be reset before work resumes. */
  isHalted(): boolean {
    return this.halted;
  }

  /**
   * Replace the host-side allowlist. Only apps and directories listed here can
   * ever be opened; the host re-checks, so this is not merely advisory.
   */
  /**
   * Read the host's current allowlist.
   *
   * Must be called before editing: `setAllowlist` REPLACES the list, so writing
   * without reading first would silently drop entries the UI never loaded.
   */
  async getAllowlist(): Promise<{ apps: string[]; paths: string[] }> {
    this.ensureOpen();
    const raw = (await this.call("get_allowlist")) as { apps?: string[]; paths?: string[] };
    return {
      apps: Array.isArray(raw?.apps) ? raw.apps : [],
      paths: Array.isArray(raw?.paths) ? raw.paths : [],
    };
  }

  async setAllowlist(apps: string[], paths: string[]): Promise<void> {
    this.ensureOpen();
    // MUST be signed: this widens what OCADE is permitted to open. An
    // unauthenticated permission change would defeat the entire IPC layer.
    const request = this.session.sign("set_allowlist", { apps, paths });
    await this.call("set_allowlist", { request, apps, paths });
  }

  /** Host audit trail. Already redacted host-side before it is stored. */
  async auditLog(): Promise<AuditEntry[]> {
    if (this.closed) return [];
    const raw = (await this.call("audit_log")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        runId: String(e.run_id ?? e.runId ?? "-"),
        at: Number(e.at ?? 0),
        detail: redactForAudit(String(e.detail ?? "")),
        ok: Boolean(e.ok),
      }));
  }

  /**
   * Clear a latched emergency stop. Deliberately a separate, explicit step, and
   * SIGNED — re-enabling computer control is a privileged action. (Raising the
   * stop stays unauthenticated by design: halting is never the dangerous
   * direction, and it must work even if signing is somehow broken.)
   */
  async resetEmergencyStop(): Promise<void> {
    this.ensureOpen();
    const request = this.session.sign("reset_emergency_stop", {});
    await this.call("reset_emergency_stop", { request });
    this.halted = false;
  }

  /**
   * Tear the session down and fail closed locally before waiting for the host.
   *
   * Local invalidation is the security boundary: even if the close IPC fails,
   * this object can never sign another request and worker subscribers receive
   * the honest unavailable adapter immediately.
   */
  async closeSession(): Promise<void> {
    if (this.closeAttempt) return this.closeAttempt;

    const request = this.session.sign("close_session", { sessionId: this.sessionId });
    this.closed = true;
    this.hostCapabilities = [];
    this.session.invalidate();
    invalidateCompanionBootstrap(this);
    if (getCompanion() === this) {
      setCompanionAdapter(new UnavailableCompanion(COMPANION_SESSION_CLOSED_REASON));
    }

    this.closeAttempt = (async () => {
      await this.call("close_session", { request, sessionId: this.sessionId });
    })();
    return this.closeAttempt;
  }

  async execute(action: CompanionAction, opts: ExecuteOptions): Promise<ExecuteResult> {
    if (this.closed) {
      return {
        ok: false,
        runId: opts.runId,
        detail: COMPANION_SESSION_CLOSED_REASON,
      };
    }
    // Fail fast on anything the host would refuse anyway.
    const refusal = guardAction(action, { confirmed: opts.confirmed });
    if (refusal) {
      return { ok: false, runId: opts.runId, detail: refusal };
    }
    if (opts.signal?.aborted) {
      return { ok: false, runId: opts.runId, detail: "Cancelled before it started." };
    }

    const operationId = opts.operationId ?? opts.runId;
    const signedArgs = {
      action,
      confirmed: Boolean(opts.confirmed),
      runId: opts.runId,
      operationId,
    };
    const envelope = this.session.sign("execute", signedArgs);
    try {
      const raw = (await this.call("execute", {
        request: envelope,
        ...signedArgs,
      })) as { ok?: boolean; runId?: string; detail?: string; output?: unknown };
      const output = parseNativeOutput(raw?.output);
      if (raw?.output !== undefined && !output) {
        return {
          ok: false,
          runId: opts.runId,
          detail: "The companion returned an invalid or protected action result.",
        };
      }
      return {
        ok: Boolean(raw?.ok),
        runId: raw?.runId ?? opts.runId,
        // Redact again on the way back so nothing protected reaches the UI/audit.
        detail: redactForAudit(String(raw?.detail ?? "")),
        output,
      };
    } catch (e) {
      return {
        ok: false,
        runId: opts.runId,
        detail: redactForAudit(
          e instanceof Error ? e.message : "The action could not be completed.",
        ),
      };
    }
  }

  /**
   * Query post-action OS state through a command separate from `execute`.
   * The returned IPC payload remains untrusted until automation-observer.ts
   * validates correlation, freshness, kind, source, and privacy-safe hashes.
   */
  async observe(observation: NativeObservationRequest): Promise<unknown> {
    this.ensureOpen();
    const envelope = this.session.sign("observe", { observation });
    return this.call("observe", { request: envelope, observation });
  }

  async cancel(runId: string): Promise<void> {
    this.ensureOpen();
    const envelope = this.session.sign("cancel", { runId });
    await this.call("cancel", { request: envelope, runId });
  }

  async emergencyStop(): Promise<void> {
    // Halting is deliberately unauthenticated host-side and must remain
    // available when a broken/closed signer is exactly what prompted the stop.
    if (this.closed) {
      await this.call("emergency_stop");
      return;
    }
    const envelope = this.session.sign("emergency_stop", {});
    await this.call("emergency_stop", { request: envelope });
  }

  private ensureOpen(): void {
    if (this.closed || !this.session.active) {
      throw new NativeCompanionRequiredError(COMPANION_SESSION_CLOSED_REASON);
    }
  }
}

/**
 * Install the Tauri adapter when running inside the companion.
 * Returns whether it was installed, so callers can report honestly.
 */
export function initCompanionAdapter(opts?: Partial<TauriCompanionOptions>): boolean {
  if (!detectTauri()) return false;
  const key = opts?.key;
  const sessionId = opts?.sessionId;
  // Without a paired session there is nothing to sign with; staying on the
  // unavailable adapter is the honest outcome.
  if (!key || key.length < 16 || !sessionId) return false;
  setCompanionAdapter(new TauriCompanion({ sessionId, key, invokeFn: opts?.invokeFn }));
  return true;
}

/** Events the host pushes without being asked. */
export type CompanionEventName =
  "action-started" | "action-progress" | "action-finished" | "emergency-stop";

/**
 * Subscribe to a host event. Returns an unsubscribe function that is safe to
 * call even if the listener never attached (ordinary browser, or the host went
 * away), so callers can use it directly as an effect cleanup.
 */
export function onCompanionEvent(
  name: CompanionEventName,
  handler: (payload: unknown) => void,
): () => void {
  const listen = tauriGlobal()?.event?.listen;
  if (!listen) return () => {};

  let unlisten: (() => void) | null = null;
  let cancelled = false;
  void listen(`ocade://${name}`, (e) => handler(e.payload))
    .then((fn) => {
      // Unsubscribed before the listener finished attaching — detach at once.
      if (cancelled) fn();
      else unlisten = fn;
    })
    .catch(() => {
      /* host unavailable — nothing to detach */
    });

  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = null;
  };
}

export type BootstrapResult = { installed: true } | { installed: false; reason: string };

/**
 * Ask the host to open a session, then install the signed adapter.
 *
 * The session key is minted by the Rust side and stays in memory for the life of
 * the window — it is never persisted, logged or sent anywhere. Runs at most once
 * per page load.
 */
let bootstrapped: Promise<BootstrapResult> | null = null;
/** Guards against two concurrent callers each opening a session. */
let inFlight: Promise<BootstrapResult> | null = null;
/** Adapter represented by `bootstrapped`, so closing an old object cannot evict a newer one. */
let bootstrappedAdapter: TauriCompanion | null = null;
/** Invalidates an open-session reply that arrives after sign-out or reset. */
let bootstrapGeneration = 0;

function invalidateCompanionBootstrap(expected?: TauriCompanion): void {
  if (expected && bootstrappedAdapter !== expected && getCompanion() !== expected) {
    return;
  }
  bootstrapGeneration += 1;
  bootstrapped = null;
  inFlight = null;
  bootstrappedAdapter = null;
}

export function bootstrapCompanion(
  invokeFn?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
): Promise<BootstrapResult> {
  // A SUCCESSFUL bootstrap is cached for the life of the window — the session
  // key must not be re-minted on every status check.
  if (bootstrapped) return bootstrapped;
  // A concurrent caller joins the attempt already running rather than starting
  // a second handshake.
  if (inFlight) return inFlight;

  const generation = bootstrapGeneration;
  inFlight = (async (): Promise<BootstrapResult> => {
    if (!detectTauri() && !invokeFn) {
      return { installed: false, reason: COMPANION_UNAVAILABLE_REASON };
    }
    try {
      const call = invokeFn ?? invoke;
      const raw = (await call("open_session")) as { sessionId?: string; key?: number[] };
      const sessionId = raw?.sessionId;
      const bytes = Array.isArray(raw?.key) ? Uint8Array.from(raw.key) : null;
      if (!sessionId || !bytes || bytes.length < 16) {
        return { installed: false, reason: "The companion did not return a valid session." };
      }
      if (generation !== bootstrapGeneration) {
        // Sign-out/reset won the race. Close the newly minted host session and
        // never expose its key or adapter to the application.
        const staleSession = new CompanionSession(sessionId, bytes);
        const request = staleSession.sign("close_session", { sessionId });
        staleSession.invalidate();
        await call("close_session", { request, sessionId }).catch(() => undefined);
        bytes.fill(0);
        return { installed: false, reason: COMPANION_SESSION_CLOSED_REASON };
      }
      const adapter = new TauriCompanion({ sessionId, key: bytes, invokeFn });
      bytes.fill(0);
      bootstrappedAdapter = adapter;
      setCompanionAdapter(adapter);
      return { installed: true };
    } catch (e) {
      // Deliberately does NOT include the error verbatim — a pairing failure
      // must never echo key material back into the UI.
      void e;
      return { installed: false, reason: "Could not open a secure session with the companion." };
    }
  })();

  const attempt = inFlight;
  void attempt.then((result) => {
    /*
     * Companion recovery.
     *
     * Only a SUCCESS is memoised. Caching a failure would mean a companion that
     * starts a moment after the page — the normal case on a cold boot — could
     * never connect for the rest of the session, and "Re-check" would be a
     * button that does nothing.
     */
    if (result.installed && generation === bootstrapGeneration && bootstrappedAdapter) {
      bootstrapped = attempt;
    }
    if (inFlight === attempt) inFlight = null;
  });

  return attempt;
}

/** Forget the memoised bootstrap so the next call re-pairs. */
export function resetCompanionBootstrap(): void {
  invalidateCompanionBootstrap();
}

/**
 * Sign-out/window-close hook: invalidate the active signer and its bootstrap
 * cache, then ask the host to forget the session. Safe in an ordinary browser.
 */
export async function closeActiveCompanionSession(): Promise<void> {
  const active = getCompanion();
  if (active instanceof TauriCompanion) {
    await active.closeSession();
    return;
  }

  // Also defeats a handshake that is still in flight and ensures subscribers
  // stop any worker host even when no Tauri adapter finished installing.
  invalidateCompanionBootstrap();
  setCompanionAdapter(new UnavailableCompanion(COMPANION_SESSION_CLOSED_REASON));
}
