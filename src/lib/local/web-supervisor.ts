/**
 * The supervisor that exists when there is no process to supervise.
 *
 * `runtime-supervisor.ts` starts a local engine binary. It needs a companion
 * that can spawn a process, so in a plain browser tab it can do nothing at all
 * — and a plain browser tab is how most people meet OCADE.
 *
 * That left a gap the product talked its way around: OCADE claims to run on
 * your own hardware, and in a browser it genuinely can, through the WebGPU and
 * WebAssembly adapters. What it could not do was SURVIVE. Close the laptop lid
 * on a plane, reopen the tab, and the application itself would not load,
 * because every navigation needed the server. A local-first product whose shell
 * requires the network is local-first only while the network is up.
 *
 * So this is the fallback supervisor, and it supervises three things a browser
 * actually controls:
 *
 *   1. THE SHELL — a service worker keeps the application openable offline.
 *   2. INSTALLABILITY — a manifest lets it be launched as its own window,
 *      which is what makes an "app" that keeps running rather than a tab that
 *      gets closed.
 *   3. HONEST CAPABILITY — it reports what it can and cannot supervise, so no
 *      screen offers to start an engine the browser has no way to start.
 *
 * The capability decision is pure. Registration is the only part that touches
 * the browser, and it is injected, so every branch is reachable from a test on
 * a machine with no service-worker support at all.
 */

/** What kind of supervision is available to this installation. */
export type SupervisionMode =
  /** A companion can start and stop a real engine process. */
  | "process"
  /** No companion: the browser supervises its own engines and shell only. */
  | "web"
  /** Neither. Nothing can be supervised and nothing should claim otherwise. */
  | "none";

export interface SupervisionInputs {
  /** A signed native companion is present and reachable. */
  companionAvailable: boolean;
  /** The browser exposes a service worker registration API. */
  serviceWorkerSupported: boolean;
  /** At least one in-browser engine adapter reported itself usable. */
  browserEngineAvailable: boolean;
}

export interface SupervisionCapability {
  mode: SupervisionMode;
  /** Can OCADE start or stop an engine process? Only a companion can. */
  canStartEngineProcess: boolean;
  /** Will the application open with no network? */
  canRunOffline: boolean;
  /** Can OCADE answer at all without a network round trip? */
  canAnswerOffline: boolean;
  /** One sentence for the screen. Never claims more than the mode allows. */
  summary: string;
}

/**
 * Decide what this installation can honestly supervise.
 *
 * The distinction that matters is between "the app opens offline" and "OCADE
 * answers offline". A service worker gives the first; only a local engine gives
 * the second. Collapsing them into one "works offline" badge is the lie this
 * function exists to avoid — a user who reads "works offline" and then gets a
 * refusal on their first question has been told something untrue.
 */
export function supervisionCapability(input: SupervisionInputs): SupervisionCapability {
  const canRunOffline = input.serviceWorkerSupported;
  const canAnswerOffline = input.browserEngineAvailable || input.companionAvailable;

  if (input.companionAvailable) {
    return {
      mode: "process",
      canStartEngineProcess: true,
      canRunOffline,
      canAnswerOffline: true,
      summary: "OCADE can start and stop the engine on this computer.",
    };
  }

  if (input.serviceWorkerSupported || input.browserEngineAvailable) {
    return {
      mode: "web",
      canStartEngineProcess: false,
      canRunOffline,
      canAnswerOffline,
      summary: webSummary(canRunOffline, canAnswerOffline),
    };
  }

  return {
    mode: "none",
    canStartEngineProcess: false,
    canRunOffline: false,
    canAnswerOffline: false,
    summary:
      "This browser cannot run OCADE offline or on-device. Install the desktop app, or use OCADE Cloud.",
  };
}

function webSummary(canRunOffline: boolean, canAnswerOffline: boolean): string {
  if (canRunOffline && canAnswerOffline) {
    return "OCADE opens without a connection and can answer using an engine in this browser.";
  }
  if (canRunOffline) {
    // The precise case the split exists for: the shell is offline-capable but
    // there is no engine, so questions still need the network.
    return "OCADE opens without a connection, but answering still needs OCADE Cloud or an on-device engine.";
  }
  return "OCADE can answer using an engine in this browser, but the app itself still needs a connection to open.";
}

export type RegistrationOutcome =
  { ok: true; scope: string } | { ok: false; reason: string; retryable: boolean };

export interface RegistrarDeps {
  /** Injected so the failure branches are reachable without a browser. */
  register?: (path: string) => Promise<{ scope: string }>;
  supported: boolean;
  /** Service workers require a secure context; localhost counts as one. */
  secureContext: boolean;
}

export const SERVICE_WORKER_PATH = "/sw.js";

/**
 * Install the offline shell, or say precisely why not.
 *
 * Never throws. A browser that refuses a service worker is an ordinary state —
 * private browsing, an insecure origin, a locked-down enterprise profile — and
 * the correct response is an application that still works online and a status
 * line that is true, not an unhandled rejection in the console.
 */
export async function registerOfflineShell(deps: RegistrarDeps): Promise<RegistrationOutcome> {
  if (!deps.supported) {
    return {
      ok: false,
      reason: "This browser does not support offline mode.",
      retryable: false,
    };
  }
  if (!deps.secureContext) {
    // Worth distinguishing: this one is fixed by visiting the https URL, and
    // telling the user "not supported" would send them looking for a new
    // browser instead.
    return {
      ok: false,
      reason: "Offline mode needs a secure (https) connection.",
      retryable: true,
    };
  }
  if (!deps.register) {
    return { ok: false, reason: "No service worker registrar was provided.", retryable: false };
  }
  try {
    const registration = await deps.register(SERVICE_WORKER_PATH);
    return { ok: true, scope: registration.scope };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Offline mode could not be enabled.",
      retryable: true,
    };
  }
}

/**
 * Read the ambient browser and register, for the one real call site.
 *
 * Kept separate from `registerOfflineShell` so that function stays pure of
 * globals and fully testable; this wrapper is the only part that cannot be
 * exercised outside a browser.
 */
export async function registerOfflineShellFromBrowser(): Promise<RegistrationOutcome> {
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  return registerOfflineShell({
    supported,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    register: supported
      ? (path) => navigator.serviceWorker.register(path).then((r) => ({ scope: r.scope }))
      : undefined,
  });
}
