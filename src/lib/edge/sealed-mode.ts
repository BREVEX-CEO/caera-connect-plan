/**
 * Sealed mode: a conversation that cannot reach the network.
 *
 * WHY THIS IS NOT A SETTING. Every assistant has a privacy toggle, and every
 * one of them means "we intend not to send this". Intent is implemented as a
 * branch somewhere in the code, and a branch can be wrong: a retry path, an
 * error reporter, a telemetry ping, an analytics beacon added two years later
 * by somebody who never read the privacy design. The user cannot audit any of
 * it, and neither, honestly, can the team shipping it.
 *
 * Sealed mode is a different kind of object. It does not ask the application to
 * behave; it removes the ability to misbehave, by installing a barrier in front
 * of every network primitive the page has. A telemetry call added later does
 * not quietly succeed — it throws, loudly, and the seal records the attempt.
 *
 * THE ATTEMPTS ARE THE POINT. A seal that silently swallowed blocked calls
 * would hide exactly the information worth having. `attempts` is a list of what
 * tried to leave, so "nothing was sent" can be accompanied by "and here is what
 * wanted to". That is a claim no cloud assistant can make at all — there is no
 * boundary on a server that the user is on the right side of.
 *
 * WHAT IT HONESTLY CANNOT DO, and the interface must say so:
 *  - The native managed-browser host runs outside the page and is not affected.
 *  - Another tab is a different context with its own primitives.
 *  - Code that captured a reference to `fetch` BEFORE the seal was applied
 *    still holds the original. `capturedEarly()` reports whether that risk is
 *    live rather than pretending it is not.
 *
 * Sealing is therefore a strong local guarantee, not a sandbox, and it is
 * described as one.
 *
 * HOW LONG IT STAYS UP is the caller's decision, and it used to be far shorter
 * than the interface implied: the only callers wrapped a single `generate()`
 * call, so the barrier existed for the milliseconds an answer was produced
 * while the button read "Sealed" and the toast said "until you unseal it".
 * Measured in the running app, every primitive was still the native one. A
 * seal can now carry a policy (`SealAllow`), which is what lets one stay up for
 * a whole conversation without breaking the page — see `seal-policy.ts`.
 */

import { allowNothing, type SealAllow, type SealRequest } from "./seal-policy";

export type SealedTransport = "fetch" | "xhr" | "beacon" | "websocket" | "eventsource";

export interface BlockedAttempt {
  transport: SealedTransport;
  /** Origin only — a full URL can carry the user's content. */
  origin: string;
  at: number;
}

export interface SealReport {
  /** True while the seal is installed. */
  active: boolean;
  /** Everything that tried to leave and was refused. */
  attempts: BlockedAttempt[];
  /** How long the seal has been up, in milliseconds. */
  heldMs: number;
}

/**
 * The URL string out of a URL-ish value: a string, a `URL`, or a `Request`.
 *
 * Separate from `originOf` because the policy needs the PATH — an asset
 * allowlist cannot decide anything from an origin alone — while the attempt log
 * deliberately keeps only the origin, so a refusal record never itself becomes
 * a copy of what the user was doing.
 */
function urlOf(input: unknown): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : typeof (input as { url?: string })?.url === "string"
        ? (input as { url: string }).url
        : "";
}

/** Origin of a URL-ish value, without retaining the path. */
function originOf(input: unknown): string {
  const raw = urlOf(input);
  if (!raw) return "(unknown)";
  try {
    return new URL(raw, globalThis.location?.href ?? "http://localhost").origin;
  } catch {
    return "(unknown)";
  }
}

/**
 * The error a blocked call receives.
 *
 * A named class so callers can distinguish "the seal refused this" from "the
 * network is down". Treating the two the same is how a blocked telemetry call
 * ends up retried forever in a backoff loop.
 */
export class SealedModeError extends Error {
  readonly transport: SealedTransport;
  constructor(transport: SealedTransport) {
    super(
      "This conversation is sealed: nothing may leave this device. Unseal it in the conversation menu to allow network access.",
    );
    this.name = "SealedModeError";
    this.transport = transport;
  }
}

interface Originals {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  sendBeacon?: Navigator["sendBeacon"];
  WebSocket?: typeof WebSocket;
  EventSource?: typeof EventSource;
}

/**
 * Who has patched which scope, so overlapping seals cannot corrupt the restore.
 *
 * THE BUG THIS FIXES, which was in the first version of this file. Sealing is
 * monkey-patching, and monkey-patching does not nest by itself:
 *
 *   a.seal()    // a saves the REAL fetch, installs wrapper A
 *   b.seal()    // b saves WRAPPER A, believing it is the original
 *   a.unseal()  // a restores the real fetch
 *   b.unseal()  // b restores wrapper A — over the top of the real one
 *
 * The page is left permanently sealed. Every request throws `SealedModeError`
 * forever, with no seal active to explain why, and the only recovery is a
 * reload. That is far worse than the problem sealing solves, and it is exactly
 * the failure mode this module warns about elsewhere.
 *
 * Reference counting fixes it: the FIRST seal on a scope patches and stores the
 * genuine originals; later seals join without re-patching; only the last one to
 * leave restores. Each instance still keeps its own attempt log, because two
 * conversations sealed at once should each report what THEY blocked.
 *
 * Keyed by scope so tests using injected scopes cannot interfere with each
 * other, or with a real page.
 */
const patched = new WeakMap<object, { depth: number; originals: Originals }>();

/*
 * `listeners` is declared below but referenced by `permitted`, which only runs
 * inside a wrapper — long after module evaluation. Hoisting is safe here and
 * keeps the two maps documented together.
 */

/**
 * Decide whether a request may proceed, given EVERY seal currently in force.
 *
 * Overlapping seals intersect: most restrictive wins. Without this, the
 * reference counting above would silently loosen a strict seal — the second
 * seal to arrive joins rather than re-patching, so a send-time seal installed
 * while a permissive page-level seal was already up would inherit the page's
 * allowlist instead of its own. That is the exact opposite of what the caller
 * asked for, and it would be invisible.
 */
function permitted(scope: object, request: SealRequest): boolean {
  const active = listeners.get(scope);
  if (!active || active.size === 0) return false;
  for (const seal of active) if (!seal.allow(request)) return false;
  return true;
}

/**
 * Every seal currently in force on a scope.
 *
 * The wrapper is installed once, by the first seal, so it needs to know who to
 * report a blocked attempt to. All of them: each is in force, so each is
 * entitled to say what was refused while it was up.
 */
const listeners = new WeakMap<object, Set<Seal>>();

export class Seal {
  private originals: Originals = {};
  private attempts: BlockedAttempt[] = [];
  private sealedAt = 0;
  private active = false;
  /** Captured at construction, so `capturedEarly` can compare identities. */
  private readonly fetchAtBoot: unknown;

  /**
   * What this seal still permits. Defaults to nothing at all, which is what a
   * send-time seal wants; the page-level seal passes an asset/loopback policy
   * so it can stay up without breaking navigation.
   */
  readonly allow: SealAllow;

  constructor(
    private readonly scope: typeof globalThis = globalThis,
    allow: SealAllow = allowNothing,
  ) {
    this.allow = allow;
    this.fetchAtBoot = (scope as { fetch?: unknown }).fetch;
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * Install the barrier.
   *
   * Idempotent: sealing twice must not stack wrappers, or unsealing once would
   * leave a wrapper behind and the page permanently offline.
   */
  seal(): void {
    if (this.active) return;
    const scope = this.scope as Record<string, unknown> & {
      navigator?: { sendBeacon?: Navigator["sendBeacon"] };
    };

    this.attempts = [];
    this.sealedAt = Date.now();
    this.active = true;

    /*
     * Already sealed by someone else? Join, do not re-patch.
     *
     * Re-patching would capture the existing WRAPPER as this seal's "original",
     * and restoring that later leaves the page permanently sealed. See the note
     * on `patched`.
     *
     * Attempts are still recorded per instance — but through the existing
     * wrapper, via the listener list below, so a second conversation sees what
     * it blocked without installing a second layer.
     */
    const existing = patched.get(scope);
    if (existing) {
      existing.depth += 1;
      listeners.get(scope)?.add(this);
      return;
    }

    const record = (transport: SealedTransport, target: unknown): SealedModeError => {
      const origin = originOf(target);
      const at = Date.now();
      // Every seal currently up gets the record: they are all in force, so they
      // are all entitled to report what was refused while they were.
      for (const seal of listeners.get(scope) ?? []) {
        seal.attempts.push({ transport, origin, at });
      }
      return new SealedModeError(transport);
    };

    listeners.set(scope, new Set([this]));
    patched.set(scope, { depth: 1, originals: this.originals });

    if (typeof scope.fetch === "function") {
      const original = scope.fetch as typeof fetch;
      this.originals.fetch = original;
      scope.fetch = ((input: unknown, init?: RequestInit) => {
        /*
         * `input` may be a Request, whose method and body live on the object
         * rather than in `init`. Reading both means a `new Request(url,
         * {method:"POST"})` cannot slip past a policy that only allows GETs.
         */
        const asRequest = input as Partial<Request> | undefined;
        const request: SealRequest = {
          url: urlOf(input),
          method: init?.method ?? asRequest?.method,
          hasBody: init?.body != null || asRequest?.body != null,
        };
        if (permitted(scope, request)) return original(input as RequestInfo, init);
        return Promise.reject(record("fetch", input));
      }) as typeof fetch;
    }

    if (typeof scope.XMLHttpRequest === "function") {
      this.originals.XMLHttpRequest = scope.XMLHttpRequest as typeof XMLHttpRequest;
      const Original = this.originals.XMLHttpRequest;
      class SealedXHR extends Original {
        open(method: string, url: string | URL, ...rest: unknown[]) {
          // `hasBody` is unknowable at open() — the body arrives at send(). An
          // XHR is therefore treated as always carrying one, which refuses
          // anything a GET-only policy would not have allowed anyway.
          if (!permitted(scope, { url: urlOf(url), method, hasBody: true })) {
            throw record("xhr", url);
          }
          super.open(method, url as string, ...(rest as []));
        }
      }
      scope.XMLHttpRequest = SealedXHR as unknown as typeof XMLHttpRequest;
    }

    if (scope.navigator && typeof scope.navigator.sendBeacon === "function") {
      this.originals.sendBeacon = scope.navigator.sendBeacon;
      /*
       * `sendBeacon` returns a boolean rather than throwing, and it is the
       * transport most often used for telemetry precisely because it survives
       * page unload. Returning false is the correct refusal — a throw here
       * would break callers that legitimately ignore the result.
       */
      const originalBeacon = scope.navigator.sendBeacon.bind(scope.navigator);
      scope.navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
        // A beacon always carries a payload, so it can never be an asset load.
        if (permitted(scope, { url: urlOf(url), method: "POST", hasBody: true })) {
          return originalBeacon(url, data);
        }
        record("beacon", url);
        return false;
      };
    }

    if (typeof scope.WebSocket === "function") {
      const OriginalWs = scope.WebSocket as typeof WebSocket;
      this.originals.WebSocket = OriginalWs;
      scope.WebSocket = function SealedWebSocket(url: string | URL, protocols?: string | string[]) {
        // A socket is bidirectional by definition — treated as carrying a body.
        if (permitted(scope, { url: urlOf(url), method: "GET", hasBody: true })) {
          return new OriginalWs(url, protocols);
        }
        throw record("websocket", url);
      } as unknown as typeof WebSocket;
    }

    if (typeof scope.EventSource === "function") {
      const OriginalEs = scope.EventSource as typeof EventSource;
      this.originals.EventSource = OriginalEs;
      scope.EventSource = function SealedEventSource(url: string | URL, init?: EventSourceInit) {
        if (permitted(scope, { url: urlOf(url), method: "GET", hasBody: true })) {
          return new OriginalEs(url, init);
        }
        throw record("eventsource", url);
      } as unknown as typeof EventSource;
    }
  }

  /**
   * Leave the seal. The primitives are restored only when the LAST holder goes.
   *
   * Restoring on every `unseal` would unseal the page while another
   * conversation still believed it was protected — a silent failure of the one
   * guarantee this class exists to make.
   */
  unseal(): SealReport {
    const report = this.report();
    if (!this.active) return report;
    const scope = this.scope as Record<string, unknown> & {
      navigator?: { sendBeacon?: Navigator["sendBeacon"] };
    };

    this.active = false;
    listeners.get(scope)?.delete(this);

    const state = patched.get(scope);
    if (!state) return report;

    state.depth -= 1;
    if (state.depth > 0) return report;

    // Last one out restores the GENUINE originals, captured by the first seal.
    const originals = state.originals;
    if (originals.fetch) scope.fetch = originals.fetch;
    if (originals.XMLHttpRequest) scope.XMLHttpRequest = originals.XMLHttpRequest;
    if (originals.sendBeacon && scope.navigator) {
      scope.navigator.sendBeacon = originals.sendBeacon;
    }
    if (originals.WebSocket) scope.WebSocket = originals.WebSocket;
    if (originals.EventSource) scope.EventSource = originals.EventSource;

    patched.delete(scope);
    listeners.delete(scope);
    this.originals = {};
    return report;
  }

  report(): SealReport {
    return {
      active: this.active,
      attempts: [...this.attempts],
      heldMs: this.sealedAt ? Date.now() - this.sealedAt : 0,
    };
  }

  /**
   * Could something still get out through a reference taken before sealing?
   *
   * Any module that did `const f = window.fetch` at import time holds the
   * original and is unaffected by the barrier. This cannot be prevented from
   * inside the page, so it is REPORTED instead — an honest limit stated up
   * front is worth more than a guarantee that quietly has a hole in it.
   */
  capturedEarly(): boolean {
    return this.fetchAtBoot !== undefined && this.fetchAtBoot !== this.originals.fetch;
  }
}

/** What sealing does and does not cover, for the interface to show verbatim. */
export function sealLimits(): string[] {
  return [
    "The native managed-browser host runs outside this page and is not sealed.",
    "Other tabs have their own network access.",
    "Code that took a reference to the network before sealing could still use it.",
  ];
}

/** One sentence describing what the seal held. */
export function describeSeal(report: SealReport): string {
  if (report.attempts.length === 0) {
    return "Nothing attempted to leave this device while the conversation was sealed.";
  }
  const origins = [...new Set(report.attempts.map((a) => a.origin))];
  return `${report.attempts.length} network ${
    report.attempts.length === 1 ? "attempt was" : "attempts were"
  } blocked while sealed${origins.length ? `, aimed at ${origins.join(", ")}` : ""}.`;
}
