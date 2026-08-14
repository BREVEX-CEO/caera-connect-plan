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

/**
 * Resource ceilings the engine is launched under, so OCADE never makes the
 * user's machine unusable to serve itself.
 *
 * These are not tuning preferences — each one closes a specific way a local
 * engine degrades the whole device on the class of hardware OCADE targets
 * (16 GB, no dedicated GPU, weights already at 60-80% of usable RAM):
 *
 *  - MAX_LOADED_MODELS=1 — the default keeps several models resident. Two 5 GB
 *    models resident at once exceeds what this machine can hold, and the OS
 *    answers by swapping, which freezes the foreground application rather than
 *    slowing the engine.
 *  - NUM_PARALLEL=1 — parallel sequences multiply the KV cache by the number
 *    of slots. One user chatting does not need four, and four is what turns a
 *    working configuration into an out-of-memory one.
 *  - KEEP_ALIVE — weights are released after a short idle instead of being
 *    pinned indefinitely, so closing the chat gives the memory back.
 *
 * A user who deliberately sets these in their own environment is NOT
 * overridden here; see `engineResourceEnv`.
 */
export const ENGINE_RESOURCE_DEFAULTS: Record<string, string> = {
  OLLAMA_MAX_LOADED_MODELS: "1",
  OLLAMA_NUM_PARALLEL: "1",
  OLLAMA_KEEP_ALIVE: "5m",
};

/**
 * Build the resource environment for a launch.
 *
 * Deliberately does not clobber a value the user already set: someone who has
 * chosen `OLLAMA_KEEP_ALIVE=1h` on their own machine has made a decision about
 * their own hardware, and silently reversing it would be the product deciding
 * it knows better than the person who owns the computer. Absent values get
 * OCADE's safe defaults, which is the case that matters — nearly everyone.
 *
 * `OLLAMA_HOST` is NOT part of this: the bind address is a safety control, not
 * a preference, and it is forced unconditionally at the call site.
 */
/**
 * The only origins the local engine will answer.
 *
 * `tauri://localhost` is the packaged desktop shell. The two loopback origins
 * are the app in a browser during development and when the desktop window
 * loads the local server. Nothing else belongs here -- adding a public origin
 * would let that site run inference on the user's hardware.
 */
export const ENGINE_ALLOWED_ORIGINS = [
  "tauri://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export function engineResourceEnv(
  ambient: Record<string, string | undefined> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(ENGINE_RESOURCE_DEFAULTS)) {
    const existing = ambient[key];
    if (existing === undefined || existing.trim() === "") env[key] = value;
  }
  return env;
}

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
  /**
   * The environment the engine would inherit. Only read to decide which
   * resource ceilings the user has already chosen for themselves; passing
   * nothing applies OCADE's defaults in full.
   */
  ambientEnv?: Record<string, string | undefined>;
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
      // Resource ceilings first, so a stray ambient value can never widen them
      // past what the bind decision below assumes.
      ...engineResourceEnv(options.ambientEnv ?? {}),
      // Force loopback even if the ambient environment says otherwise. This is
      // the whole point of the control: an inherited OLLAMA_HOST=0.0.0.0 must
      // not be able to publish the engine.
      OLLAMA_HOST: decision.normalised,

      /*
       * ORIGIN LOCK. Forced, like the bind address, and for the same reason.
       *
       * Binding to loopback stops a MACHINE on the network reaching the engine.
       * It does nothing about a BROWSER on this machine: any page the user has
       * open can `fetch("http://localhost:11434/api/chat")`, and without an
       * origin allow-list Ollama answers it. That is a website on the far side
       * of the internet using the user's own hardware, reading nothing but
       * costing everything, and it is invisible to them.
       *
       * The allow-list names only the surfaces OCADE itself is served from --
       * the Tauri shell and the local dev origin. Anything else is refused by
       * the engine before a request body is even read.
       *
       * Not merged with `engineResourceEnv`: that function deliberately yields
       * to a value the user has already chosen, which is right for a memory
       * ceiling and wrong for a security control. A user who has set
       * OLLAMA_ORIGINS=* on their own machine has almost certainly done it to
       * make something work, not to decide that any website may use their GPU.
       */
      OLLAMA_ORIGINS: ENGINE_ALLOWED_ORIGINS.join(","),
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
