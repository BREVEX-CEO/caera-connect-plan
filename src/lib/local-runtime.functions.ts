/**
 * OCADE Local Engine start/stop server function (B1 production wiring).
 *
 * The supervisor policy in `local/runtime-supervisor.ts` is platform-free and
 * unit-tested, but the thing that actually launches a process is Node-only. It
 * has to be a server function for the same reason `sandbox.functions.ts` does:
 * `runtime-supervisor.node.ts` statically imports `node:child_process`, and a
 * client-reachable import would either break the browser bundle or pull Node
 * builtins into it. The `await import()` inside each handler guarantees the
 * module resolves on the server only.
 *
 * THE BIND ADDRESS IS NOT A PARAMETER.
 *
 * There is deliberately no way for a caller to ask for a listen address. A
 * local inference server on 0.0.0.0 is an unauthenticated prompt and file-read
 * endpoint on the user's network, so "which interface" is not a decision the
 * client — or the model — gets to influence. The handler passes loopback, and
 * `assertLoopbackBind` refuses anything else even if this file were changed to
 * forward one.
 *
 * Scope note: this manages the engine on the machine running OCADE's server. In
 * the desktop build that is the user's own machine, which is the intended case.
 * It is not a way to reach into anyone else's.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  startRuntime,
  stopRuntime,
  runtimeBaseUrl,
  LOOPBACK_HOST,
  DEFAULT_RUNTIME_PORT,
  type SupervisorResult,
  type StartOutcome,
  type StopOutcome,
} from "@/lib/local/runtime-supervisor";

/** Ceilings the caller cannot raise, matching the sandbox function's posture. */
const START_TIMEOUT_MS = 60_000;
const STOP_TIMEOUT_MS = 20_000;
const POLL_MS = 500;

/** The one address this product will ever bind the engine to. */
const BIND = `${LOOPBACK_HOST}:${DEFAULT_RUNTIME_PORT}`;

async function deps() {
  const { nodeSupervisorDeps } = await import("@/lib/local/runtime-supervisor.node");
  return nodeSupervisorDeps();
}

export const startLocalRuntimeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SupervisorResult<StartOutcome>> => {
    return startRuntime(await deps(), {
      bind: BIND,
      timeoutMs: START_TIMEOUT_MS,
      pollMs: POLL_MS,
      // Read so a ceiling the machine's owner has already set for themselves is
      // respected rather than silently overwritten.
      ambientEnv: process.env,
    });
  });

export const stopLocalRuntimeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SupervisorResult<StopOutcome>> => {
    return stopRuntime(await deps(), {
      bind: BIND,
      timeoutMs: STOP_TIMEOUT_MS,
      pollMs: POLL_MS,
    });
  });

export interface LocalRuntimeStatus {
  baseUrl: string;
  running: boolean;
  /** Null when the engine is not installed in any allowlisted location. */
  binaryFound: boolean;
}

export const localRuntimeStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LocalRuntimeStatus> => {
    const { probeRuntime, findEngineBinary } = await import("@/lib/local/runtime-supervisor.node");
    const baseUrl = runtimeBaseUrl({ host: LOOPBACK_HOST, port: DEFAULT_RUNTIME_PORT });
    const [running, binary] = await Promise.all([probeRuntime(baseUrl), findEngineBinary()]);
    // The resolved path is deliberately NOT returned: it is a machine-specific
    // absolute path, and the client only needs to know whether the engine is
    // installed, not where someone's home directory is.
    return { baseUrl, running, binaryFound: binary !== null };
  });
