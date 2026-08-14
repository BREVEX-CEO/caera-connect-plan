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

/**
 * STARTING A LOOPBACK ENGINE IS NOT A CLOUD OPERATION.
 *
 * These used to require `requireSupabaseAuth`, which validates a bearer against
 * the remote auth server. That made "start the local model on my own computer"
 * impossible without internet -- the second of the two gates that stopped an
 * offline session, and the more absurd of them.
 *
 * `authoriseControl()` is the gate the rest of the machine-control surface
 * already uses: a verified bearer when there is one, and otherwise the local
 * demo rule, which authorises on the request originating from THIS MACHINE.
 * That is the right question for an operation bound to loopback, and it is
 * answerable with the network down.
 */
export const startLocalRuntimeFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<SupervisorResult<StartOutcome>> => {
    const { authoriseControl } = await import("@/lib/agent/control-access.node");
    const access = await authoriseControl();
    if (!access.ok) {
      return { ok: false, failure: "refused_bind", reason: access.reason };
    }
    return startRuntime(await deps(), {
      bind: BIND,
      timeoutMs: START_TIMEOUT_MS,
      pollMs: POLL_MS,
      // Read so a ceiling the machine's owner has already set for themselves is
      // respected rather than silently overwritten.
      ambientEnv: process.env,
    });
  });

/**
 * Install the local engine runtime when the machine has never had one.
 *
 * WITHOUT THIS, A CLEAN MACHINE DEAD-ENDS. `startRuntime` searches a fixed list
 * of install paths and returns `binary_not_found` -- accurate, and useless to
 * somebody who installed OCADE and was never told a separate runtime existed.
 *
 * The Node capabilities live here because `runtime-installer.ts` is deliberately
 * pure: every dangerous operation (fetch, write, spawn) is injected, so the
 * refusals can be tested without a network and without executing anything.
 */
export const installLocalRuntimeFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ ok: boolean; detail: string; reason?: string }> => {
    const [{ installRuntime }, nodeCrypto, nodeFs, nodeOs, nodePath, nodeChild] =
      await Promise.all([
        import("@/lib/local/runtime-installer"),
        import("node:crypto"),
        import("node:fs/promises"),
        import("node:os"),
        import("node:path"),
        import("node:child_process"),
      ]);

    return installRuntime({
      platform: process.platform,
      download: async (url) => {
        const response = await fetch(url, { redirect: "follow" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          // `response.url` is the URL AFTER redirects, which is the one that
          // has to be re-checked against the pinned host.
          finalUrl: response.url || url,
        };
      },
      digest: async (bytes) =>
        nodeCrypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
      expectedDigest: async (platform) => {
        /*
         * Read from a manifest shipped WITH THE BUILD, never fetched beside the
         * download. A digest supplied by the same server as the file proves
         * nothing: whoever replaced one replaced the other.
         *
         * Absent until a release pins it, and absent means REFUSE -- see
         * `verifyDownload`. That is the correct default for a build that has
         * not yet been told what it should be installing.
         */
        try {
          const raw = await nodeFs.readFile(
            nodePath.join(process.cwd(), "release", "OCADE_RUNTIME_DIGESTS.json"),
            "utf8",
          );
          const parsed = JSON.parse(raw) as Record<string, string>;
          return parsed[platform] ?? null;
        } catch {
          return null;
        }
      },
      writeTemp: async (fileName, bytes) => {
        const target = nodePath.join(await nodeFs.mkdtemp(nodePath.join(nodeOs.tmpdir(), "ocade-")), fileName);
        await nodeFs.writeFile(target, Buffer.from(bytes));
        return target;
      },
      run: async (path, args) =>
        new Promise<number>((resolve, reject) => {
          const child = nodeChild.spawn(path, args, { windowsHide: true, stdio: "ignore" });
          child.on("error", reject);
          child.on("exit", (code) => resolve(code ?? 1));
        }),
      remove: async (path) => {
        await nodeFs.rm(path, { force: true }).catch(() => {});
      },
    });
  });

export const stopLocalRuntimeFn = createServerFn({ method: "POST" })
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
  .handler(async (): Promise<LocalRuntimeStatus> => {
    // Same reasoning as the start/stop pair above: asking whether a loopback
    // engine is running is not a question the cloud can answer, and it is one
    // first run must be able to ask with the network down.
    const { authoriseControl } = await import("@/lib/agent/control-access.node");
    const access = await authoriseControl();
    if (!access.ok) {
      return { baseUrl: runtimeBaseUrl({ host: LOOPBACK_HOST, port: DEFAULT_RUNTIME_PORT }), running: false, binaryFound: false };
    }
    const { probeRuntime, findEngineBinary } = await import("@/lib/local/runtime-supervisor.node");
    const baseUrl = runtimeBaseUrl({ host: LOOPBACK_HOST, port: DEFAULT_RUNTIME_PORT });
    const [running, binary] = await Promise.all([probeRuntime(baseUrl), findEngineBinary()]);
    // The resolved path is deliberately NOT returned: it is a machine-specific
    // absolute path, and the client only needs to know whether the engine is
    // installed, not where someone's home directory is.
    return { baseUrl, running, binaryFound: binary !== null };
  });
