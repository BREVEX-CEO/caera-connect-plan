/**
 * OCADE Local Engine — runtime supervisor (B1).
 *
 * WHAT WAS MISSING
 * ----------------
 * Every existing local-engine path (`ocade-local.ts` discovery and streaming,
 * `model-lifecycle.ts` pull/verify/activate) assumes the runtime is ALREADY
 * listening. Nothing could start it. In practice that meant OCADE's local mode
 * worked only for a user who had already opened a terminal — which is precisely
 * the manual step the product exists to remove.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is not "run a command for the model". The model never supplies a path,
 * an argument, or a host. This module:
 *
 *   - launches ONE binary, resolved from a fixed allowlist of known install
 *     locations for the current platform;
 *   - passes a fixed argument vector;
 *   - forces the listen address to loopback and REFUSES to start otherwise,
 *     including when the ambient environment already points the runtime at a
 *     routable address;
 *   - verifies by probing the port, never by trusting the spawn's exit status.
 *
 * A local inference server bound to 0.0.0.0 is an unauthenticated prompt and
 * file-read endpoint on the user's network. `assertLoopbackBind` is the control
 * that stops that, so it fails closed on anything it does not positively
 * recognise as loopback.
 *
 * Effects are injected so the policy is unit-testable and the module stays
 * SSR-safe: nothing here imports node:child_process.
 */

export const DEFAULT_RUNTIME_PORT = 11434;
export const LOOPBACK_HOST = "127.0.0.1";

/** The only hosts that keep the engine off the network. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export type BindRefusal =
  "not_loopback" | "unparseable" | "wildcard" | "port_out_of_range" | "privileged_port";

export interface BindTarget {
  host: string;
  port: number;
}

export type BindDecision =
  | { ok: true; target: BindTarget; normalised: string }
  | { ok: false; refusal: BindRefusal; reason: string };

/**
 * Decide whether a requested listen address is safe.
 *
 * Fails closed: anything not positively recognised as loopback is refused with
 * a reason a user can act on. `0.0.0.0` and `::` are called out separately
 * because they are the specific mistake that publishes the engine.
 */
export function assertLoopbackBind(value: string | undefined | null): BindDecision {
  const raw = (value ?? "").trim();
  if (raw === "") {
    return {
      ok: true,
      target: { host: LOOPBACK_HOST, port: DEFAULT_RUNTIME_PORT },
      normalised: `${LOOPBACK_HOST}:${DEFAULT_RUNTIME_PORT}`,
    };
  }

  // Strip any scheme and path FIRST. Doing this after the host:port split made
  // "http://127.0.0.1:11434" unparseable, because the scheme's own colon meant
  // the string no longer looked like a single host:port pair.
  const bare = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");

  // Accept "host", "host:port", and bracketed IPv6 "[::1]:port".
  let host = bare;
  let portText: string | null = null;
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(bare);
  if (bracketed) {
    host = bracketed[1];
    portText = bracketed[2] ?? null;
  } else {
    const lastColon = bare.lastIndexOf(":");
    // A bare IPv6 literal has several colons and no port.
    const colonCount = (bare.match(/:/g) ?? []).length;
    if (lastColon > -1 && colonCount === 1) {
      host = bare.slice(0, lastColon);
      portText = bare.slice(lastColon + 1);
    }
  }

  if (host === "0.0.0.0" || host === "::" || host === "*") {
    return {
      ok: false,
      refusal: "wildcard",
      reason: `Refusing to start the local engine on ${host}: that publishes an unauthenticated inference endpoint to every network this machine is on. Use ${LOOPBACK_HOST}.`,
    };
  }

  if (host === "") {
    return { ok: false, refusal: "unparseable", reason: `Could not read a host from "${raw}".` };
  }

  if (!LOOPBACK_HOSTS.has(host.toLowerCase())) {
    return {
      ok: false,
      refusal: "not_loopback",
      reason: `Refusing to start the local engine on "${host}": only loopback is allowed, so prompts and model files never leave this machine.`,
    };
  }

  let port = DEFAULT_RUNTIME_PORT;
  if (portText !== null) {
    if (!/^\d+$/.test(portText)) {
      return { ok: false, refusal: "unparseable", reason: `"${portText}" is not a port number.` };
    }
    port = Number(portText);
    if (port < 1 || port > 65535) {
      return {
        ok: false,
        refusal: "port_out_of_range",
        reason: `Port ${port} is outside 1-65535.`,
      };
    }
    if (port < 1024) {
      return {
        ok: false,
        refusal: "privileged_port",
        reason: `Port ${port} is privileged and would need elevation. The local engine must never require administrator rights.`,
      };
    }
  }

  const normalisedHost = host.includes(":") ? `[${host}]` : host;
  return { ok: true, target: { host, port }, normalised: `${normalisedHost}:${port}` };
}

/** Base URL for a validated target. */
export function runtimeBaseUrl(target: BindTarget): string {
  const host = target.host.includes(":") ? `[${target.host}]` : target.host;
  return `http://${host}:${target.port}`;
}

/**
 * Known install locations, per platform. An allowlist rather than a PATH lookup:
 * PATH is user-writable, so resolving through it would let anything named
 * `ollama.exe` earlier in PATH be launched by the product.
 */
export const ENGINE_BINARY_CANDIDATES: Record<string, string[]> = {
  win32: [
    "%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe",
    "%PROGRAMFILES%\\Ollama\\ollama.exe",
    "%PROGRAMFILES(X86)%\\Ollama\\ollama.exe",
  ],
  darwin: [
    "/Applications/Ollama.app/Contents/Resources/ollama",
    "/usr/local/bin/ollama",
    "/opt/homebrew/bin/ollama",
  ],
  linux: ["/usr/local/bin/ollama", "/usr/bin/ollama", "/bin/ollama"],
};

/** Candidates for a platform, or an empty list when the platform is unsupported. */
export function engineBinaryCandidates(platform: string): string[] {
  return ENGINE_BINARY_CANDIDATES[platform] ?? [];
}

export type SupervisorFailure =
  | "binary_not_found"
  | "refused_bind"
  | "start_failed"
  | "timed_out"
  | "cancelled"
  | "still_listening"
  | "stop_failed";

export interface SupervisorError {
  ok: false;
  failure: SupervisorFailure;
  reason: string;
}

export type SupervisorResult<T> = ({ ok: true } & T) | SupervisorError;

const fail = (failure: SupervisorFailure, reason: string): SupervisorError => ({
  ok: false,
  failure,
  reason,
});

export interface SupervisorDeps {
  /** Resolve the engine binary, or null when it is not installed. */
  findBinary: () => Promise<string | null>;
  /** Launch detached. Resolves once spawned — NOT once listening. */
  spawnDetached: (binary: string, args: string[], env: Record<string, string>) => Promise<void>;
  /** True when the runtime answers on this base URL. */
  probe: (baseUrl: string) => Promise<boolean>;
  /** Ask the running engine to stop. Resolves whether or not it worked. */
  terminate: () => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface StartOptions {
  /** Requested listen address; defaults to loopback. */
  bind?: string;
  /** Give up after this long. */
  timeoutMs?: number;
  /** Gap between readiness probes. */
  pollMs?: number;
  signal?: { aborted: boolean };
}

export interface StartOutcome {
  baseUrl: string;
  target: BindTarget;
  /** True when it was already listening and nothing was launched. */
  alreadyRunning: boolean;
  binary: string | null;
  waitedMs: number;
  probes: number;
}

/**
 * Start the runtime, idempotently.
 *
 * Already listening is SUCCESS with `alreadyRunning: true`, not an error and not
 * a second process — retrying a start must never produce two engines fighting
 * over the same port.
 */
export async function startRuntime(
  deps: SupervisorDeps,
  options: StartOptions = {},
): Promise<SupervisorResult<StartOutcome>> {
  const decision = assertLoopbackBind(options.bind);
  if (!decision.ok) return fail("refused_bind", decision.reason);

  const target = decision.target;
  const baseUrl = runtimeBaseUrl(target);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 400;
  const started = deps.now();
  let probes = 0;

  if (options.signal?.aborted) return fail("cancelled", "Start cancelled before it began.");

  probes += 1;
  if (await deps.probe(baseUrl)) {
    return {
      ok: true,
      baseUrl,
      target,
      alreadyRunning: true,
      binary: null,
      waitedMs: deps.now() - started,
      probes,
    };
  }

  const binary = await deps.findBinary();
  if (!binary) {
    return fail(
      "binary_not_found",
      "The OCADE Local Engine runtime is not installed in any known location on this machine.",
    );
  }

  try {
    await deps.spawnDetached(binary, ["serve"], {
      // Force loopback even if the ambient environment says otherwise. This is
      // the whole point of the control: an inherited OLLAMA_HOST=0.0.0.0 must
      // not be able to publish the engine.
      OLLAMA_HOST: decision.normalised,
    });
  } catch (error) {
    return fail("start_failed", `Could not launch the local engine: ${String(error)}`);
  }

  // Spawning proves a process was created, not that it is serving. Only the
  // port answering counts as started.
  for (;;) {
    if (options.signal?.aborted) return fail("cancelled", "Start cancelled while waiting.");
    if (deps.now() - started > timeoutMs) {
      return fail(
        "timed_out",
        `The local engine did not answer on ${baseUrl} within ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    await deps.sleep(pollMs);
    probes += 1;
    if (await deps.probe(baseUrl)) {
      return {
        ok: true,
        baseUrl,
        target,
        alreadyRunning: false,
        binary,
        waitedMs: deps.now() - started,
        probes,
      };
    }
  }
}

export interface StopOutcome {
  baseUrl: string;
  /** True when it was already stopped and nothing was terminated. */
  alreadyStopped: boolean;
  waitedMs: number;
}

/**
 * Stop the runtime, idempotently, and verify the port actually closed.
 *
 * A terminate call that returns without error proves nothing — the check is
 * that the port stops answering.
 */
export async function stopRuntime(
  deps: SupervisorDeps,
  options: StartOptions = {},
): Promise<SupervisorResult<StopOutcome>> {
  const decision = assertLoopbackBind(options.bind);
  if (!decision.ok) return fail("refused_bind", decision.reason);

  const baseUrl = runtimeBaseUrl(decision.target);
  const timeoutMs = options.timeoutMs ?? 20_000;
  const pollMs = options.pollMs ?? 400;
  const started = deps.now();

  if (!(await deps.probe(baseUrl))) {
    return { ok: true, baseUrl, alreadyStopped: true, waitedMs: deps.now() - started };
  }

  try {
    await deps.terminate();
  } catch (error) {
    return fail("stop_failed", `Could not stop the local engine: ${String(error)}`);
  }

  for (;;) {
    if (options.signal?.aborted) return fail("cancelled", "Stop cancelled while waiting.");
    if (deps.now() - started > timeoutMs) {
      return fail(
        "still_listening",
        `The local engine was asked to stop but ${baseUrl} is still answering after ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    await deps.sleep(pollMs);
    if (!(await deps.probe(baseUrl))) {
      return { ok: true, baseUrl, alreadyStopped: false, waitedMs: deps.now() - started };
    }
  }
}
