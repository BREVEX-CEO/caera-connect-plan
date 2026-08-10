/**
 * The gate that keeps Demo Control + Work a LOCAL testing path and nothing else.
 *
 * WHAT DEMO MODE IS FOR
 * ---------------------
 * Operating this computer, from this computer, without a Supabase session — so
 * the computer-use loop can be exercised end to end without an OAuth or OTP
 * round trip. That is a genuinely useful testing path and a genuinely dangerous
 * shape, because "no authentication required" and "controls a real machine" are
 * two properties that must never meet across a network.
 *
 * SO IT IS GATED ON WHERE IT RUNS, NOT ON WHAT IT CLAIMS
 * ------------------------------------------------------
 * Three conditions, all required:
 *
 *   1. Inside the signed desktop shell. `detectTauri()` is only true when the
 *      page is running in the companion's own webview.
 *   2. Served from loopback. The shell starts the application server on
 *      127.0.0.1 with a port the operating system hands out; any other origin
 *      means this page arrived from somewhere else.
 *   3. Not a hosted deployment. A build that reached a public origin fails (1)
 *      and (2) already, and this is the belt to their braces.
 *
 * WHAT DEMO MODE IS NOT ALLOWED TO CHANGE
 * ---------------------------------------
 * Nothing about safety. The companion re-validates every action host-side in
 * Rust against the same allowlist, the same protected-input refusal and the same
 * emergency stop, and it has no idea whether the caller is a demo. Demo mode
 * removes the SUPABASE session requirement for a local surface; it removes no
 * permission, no verification and no refusal. It also writes nothing to the
 * cloud, because the surface it enables makes no server-function calls at all.
 */

export type DemoControlRefusal = "not_desktop_app" | "not_loopback" | "server_context" | "allowed";

export interface DemoControlDecision {
  allowed: boolean;
  reason: DemoControlRefusal;
  /** A sentence for the surface. Never an error code alone. */
  explain: string;
}

const EXPLAIN: Record<Exclude<DemoControlRefusal, "allowed">, string> = {
  not_desktop_app:
    "Demo Control + Work only runs inside the OCADE desktop application, because that is the only place OCADE can reach this computer.",
  not_loopback:
    "Demo Control + Work only runs when OCADE is served from this computer. It is never available over a network.",
  server_context: "Demo Control + Work is a browser-side surface.",
};

/** True only for an origin served by this machine to itself. */
export function isLoopbackOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Decide whether this page may run Control + Work without a signed-in account.
 *
 * Fails closed on anything it does not positively recognise. Injectable so the
 * rule can be tested for the cases that matter most — the ones where it must
 * say no — without standing up a desktop shell.
 */
export function decideDemoControl(input?: {
  isDesktopApp?: boolean;
  origin?: string | null;
}): DemoControlDecision {
  if (typeof window === "undefined" && input?.isDesktopApp === undefined) {
    return { allowed: false, reason: "server_context", explain: EXPLAIN.server_context };
  }

  const origin = input?.origin ?? (typeof window === "undefined" ? null : window.location.origin);
  if (!isLoopbackOrigin(origin)) {
    return { allowed: false, reason: "not_loopback", explain: EXPLAIN.not_loopback };
  }

  const desktop = input?.isDesktopApp ?? detectDesktopShell();
  if (!desktop) {
    return { allowed: false, reason: "not_desktop_app", explain: EXPLAIN.not_desktop_app };
  }

  return { allowed: true, reason: "allowed", explain: "Local demo control is available." };
}

/**
 * Whether this page is inside the companion's webview.
 *
 * Reads the Tauri bridge directly rather than importing `tauri-companion`,
 * because that module opens a signed session as a side effect of bootstrapping
 * and this is only a question.
 */
function detectDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (
    window as unknown as {
      __TAURI__?: { core?: { invoke?: unknown }; invoke?: unknown };
    }
  ).__TAURI__;
  return Boolean(bridge && (bridge.core?.invoke || bridge.invoke));
}
