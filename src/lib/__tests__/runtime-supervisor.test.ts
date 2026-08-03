import { describe, it, expect } from "vitest";
import {
  assertLoopbackBind,
  runtimeBaseUrl,
  engineBinaryCandidates,
  startRuntime,
  stopRuntime,
  engineResourceEnv,
  ENGINE_RESOURCE_DEFAULTS,
  DEFAULT_RUNTIME_PORT,
  type SupervisorDeps,
} from "../local/runtime-supervisor";

/**
 * The supervisor's six paths, plus the control that matters most: refusing to
 * publish a local inference server onto the network.
 */

interface HarnessOptions {
  listeningAfter?: number | null;
  binary?: string | null;
  spawnThrows?: boolean;
  terminateThrows?: boolean;
  stopsAfter?: number | null;
}

function harness(options: HarnessOptions = {}) {
  const calls = { spawns: 0, probes: 0, terminates: 0, sleeps: 0 };
  let clock = 0;
  let spawnedAt: number | null = null;
  let terminatedAt: number | null = null;
  const spawnArgs: { binary: string; args: string[]; env: Record<string, string> }[] = [];

  const deps: SupervisorDeps = {
    findBinary: async () => (options.binary === undefined ? "/fake/ollama" : options.binary),
    spawnDetached: async (binary, args, env) => {
      calls.spawns += 1;
      if (options.spawnThrows) throw new Error("EACCES");
      spawnArgs.push({ binary, args, env });
      spawnedAt = clock;
    },
    probe: async () => {
      calls.probes += 1;
      if (terminatedAt !== null) {
        const after = options.stopsAfter;
        if (after === null) return true; // never stops
        return clock < terminatedAt + (after ?? 0);
      }
      const after = options.listeningAfter;
      if (after === undefined) return false;
      if (after === null) return false; // never comes up
      if (spawnedAt === null) return after === 0;
      return clock >= spawnedAt + after;
    },
    terminate: async () => {
      calls.terminates += 1;
      if (options.terminateThrows) throw new Error("access denied");
      terminatedAt = clock;
    },
    sleep: async (ms) => {
      calls.sleeps += 1;
      clock += ms;
    },
    now: () => clock,
  };

  return { deps, calls, spawnArgs, tick: (ms: number) => (clock += ms) };
}

describe("bind address is refused unless it is loopback", () => {
  it("accepts an empty value as loopback on the default port", () => {
    const d = assertLoopbackBind("");
    expect(d.ok).toBe(true);
    if (!d.ok) throw new Error("unreachable");
    expect(d.target).toEqual({ host: "127.0.0.1", port: DEFAULT_RUNTIME_PORT });
  });

  it.each(["127.0.0.1", "localhost", "::1", "[::1]", "127.0.0.1:11434", "localhost:8080"])(
    "accepts loopback form %s",
    (value) => {
      expect(assertLoopbackBind(value).ok).toBe(true);
    },
  );

  it("REFUSES 0.0.0.0 and says why, because that publishes the engine", () => {
    const d = assertLoopbackBind("0.0.0.0:11434");
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error("unreachable");
    expect(d.refusal).toBe("wildcard");
    expect(d.reason).toMatch(/publishes an unauthenticated inference endpoint/i);
  });

  it.each([
    ["::", "wildcard"],
    ["192.168.1.10", "not_loopback"],
    ["10.0.0.5:11434", "not_loopback"],
    ["engine.example.com", "not_loopback"],
    ["0.0.0.0", "wildcard"],
  ])("REFUSES %s", (value, refusal) => {
    const d = assertLoopbackBind(value);
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error("unreachable");
    expect(d.refusal).toBe(refusal);
  });

  it("refuses a privileged port rather than requiring elevation", () => {
    const d = assertLoopbackBind("127.0.0.1:80");
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error("unreachable");
    expect(d.refusal).toBe("privileged_port");
  });

  it("refuses a non-numeric port", () => {
    const d = assertLoopbackBind("127.0.0.1:notaport");
    expect(d.ok).toBe(false);
  });

  it("strips a scheme rather than reading it as a host", () => {
    expect(assertLoopbackBind("http://127.0.0.1:11434").ok).toBe(true);
  });

  it("builds a bracketed URL for IPv6", () => {
    expect(runtimeBaseUrl({ host: "::1", port: 11434 })).toBe("http://[::1]:11434");
  });
});

describe("binary resolution uses an allowlist, not PATH", () => {
  it("offers real candidates for each supported platform", () => {
    expect(engineBinaryCandidates("win32").length).toBeGreaterThan(0);
    expect(engineBinaryCandidates("darwin").length).toBeGreaterThan(0);
    expect(engineBinaryCandidates("linux").length).toBeGreaterThan(0);
  });

  it("returns nothing for an unknown platform rather than guessing", () => {
    expect(engineBinaryCandidates("aix")).toEqual([]);
  });

  it("never proposes a bare name that PATH could resolve to something else", () => {
    for (const platform of ["win32", "darwin", "linux"]) {
      for (const candidate of engineBinaryCandidates(platform)) {
        expect(candidate).toMatch(/[/\\]/);
      }
    }
  });
});

describe("startRuntime — success", () => {
  it("launches, waits for the port, and reports what it did", async () => {
    const h = harness({ listeningAfter: 800 });
    const r = await startRuntime(h.deps, { pollMs: 400, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.alreadyRunning).toBe(false);
    expect(r.baseUrl).toBe("http://127.0.0.1:11434");
    expect(h.calls.spawns).toBe(1);
  });

  it("forces the engine onto loopback via the environment it passes", async () => {
    const h = harness({ listeningAfter: 400 });
    await startRuntime(h.deps, { pollMs: 400 });
    expect(h.spawnArgs[0].env.OLLAMA_HOST).toBe("127.0.0.1:11434");
    expect(h.spawnArgs[0].args).toEqual(["serve"]);
  });

  it("overrides an ambient non-loopback host rather than inheriting it", async () => {
    const h = harness({ listeningAfter: 400 });
    // The caller asks for loopback; the point is the spawn env pins it, so a
    // stray OLLAMA_HOST=0.0.0.0 in the parent environment cannot leak through.
    await startRuntime(h.deps, { bind: "127.0.0.1", pollMs: 400 });
    expect(h.spawnArgs[0].env.OLLAMA_HOST).not.toContain("0.0.0.0");
  });
});

/*
 * The engine must not be allowed to make the machine unusable in the course of
 * serving OCADE. On the hardware this product targets — 16 GB, no dedicated
 * GPU, weights already occupying most of usable memory — the defaults that
 * cause this are a second resident model and multi-slot parallel decoding.
 */
describe("startRuntime — resource ceilings so the device stays usable", () => {
  it("launches with one resident model, one parallel slot and a bounded idle life", async () => {
    const h = harness({ listeningAfter: 400 });
    await startRuntime(h.deps, { pollMs: 400 });
    const env = h.spawnArgs[0].env;
    expect(env.OLLAMA_MAX_LOADED_MODELS).toBe("1");
    expect(env.OLLAMA_NUM_PARALLEL).toBe("1");
    expect(env.OLLAMA_KEEP_ALIVE).toBe("5m");
  });

  it("applies every ceiling when the ambient environment sets none", () => {
    expect(engineResourceEnv({})).toEqual(ENGINE_RESOURCE_DEFAULTS);
  });

  it("does not overwrite a ceiling the machine's owner has already chosen", () => {
    const env = engineResourceEnv({ OLLAMA_KEEP_ALIVE: "1h" });
    expect(env.OLLAMA_KEEP_ALIVE).toBeUndefined();
    expect(env.OLLAMA_MAX_LOADED_MODELS).toBe("1");
    expect(env.OLLAMA_NUM_PARALLEL).toBe("1");
  });

  it("treats a blank ambient value as unset rather than as a deliberate choice", () => {
    expect(engineResourceEnv({ OLLAMA_NUM_PARALLEL: "   " }).OLLAMA_NUM_PARALLEL).toBe("1");
  });

  it("carries the user's own ceilings through startRuntime", async () => {
    const h = harness({ listeningAfter: 400 });
    await startRuntime(h.deps, { pollMs: 400, ambientEnv: { OLLAMA_NUM_PARALLEL: "4" } });
    const env = h.spawnArgs[0].env;
    expect(env.OLLAMA_NUM_PARALLEL).toBeUndefined();
    expect(env.OLLAMA_MAX_LOADED_MODELS).toBe("1");
  });

  it("never lets a resource value override the bind address", async () => {
    const h = harness({ listeningAfter: 400 });
    await startRuntime(h.deps, {
      pollMs: 400,
      ambientEnv: { OLLAMA_HOST: "0.0.0.0:11434" },
    });
    expect(h.spawnArgs[0].env.OLLAMA_HOST).toBe("127.0.0.1:11434");
  });
});

describe("startRuntime — idempotency", () => {
  it("treats an already-listening engine as success and spawns nothing", async () => {
    const h = harness({ listeningAfter: 0 });
    const r = await startRuntime(h.deps);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.alreadyRunning).toBe(true);
    expect(h.calls.spawns).toBe(0);
  });
});

describe("startRuntime — refusal", () => {
  it("refuses a routable bind and never spawns", async () => {
    const h = harness({ listeningAfter: 0 });
    const r = await startRuntime(h.deps, { bind: "0.0.0.0" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("refused_bind");
    expect(h.calls.spawns).toBe(0);
    // It must not even probe — refusing comes first.
    expect(h.calls.probes).toBe(0);
  });
});

describe("startRuntime — failure", () => {
  it("reports a missing binary instead of hanging", async () => {
    const h = harness({ binary: null });
    const r = await startRuntime(h.deps);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("binary_not_found");
  });

  it("reports a spawn error", async () => {
    const h = harness({ spawnThrows: true });
    const r = await startRuntime(h.deps);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("start_failed");
    expect(r.reason).toMatch(/EACCES/);
  });

  it("times out when the port never opens, rather than waiting forever", async () => {
    const h = harness({ listeningAfter: null });
    const r = await startRuntime(h.deps, { timeoutMs: 3000, pollMs: 500 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("timed_out");
    expect(r.reason).toMatch(/did not answer/i);
  });
});

describe("startRuntime — cancellation", () => {
  it("stops before doing anything when already aborted", async () => {
    const h = harness({ listeningAfter: 5000 });
    const r = await startRuntime(h.deps, { signal: { aborted: true } });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("cancelled");
    expect(h.calls.spawns).toBe(0);
  });

  it("stops waiting when cancelled mid-flight", async () => {
    const h = harness({ listeningAfter: null });
    const signal = { aborted: false };
    const promise = startRuntime(h.deps, { signal, timeoutMs: 60_000, pollMs: 100 });
    signal.aborted = true;
    const r = await promise;
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("cancelled");
  });
});

describe("stopRuntime — success, idempotency and recovery", () => {
  it("stops a running engine and verifies the port closed", async () => {
    const h = harness({ listeningAfter: 0, stopsAfter: 400 });
    const r = await stopRuntime(h.deps, { pollMs: 400, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.alreadyStopped).toBe(false);
    expect(h.calls.terminates).toBe(1);
  });

  it("treats an already-stopped engine as success and terminates nothing", async () => {
    const h = harness({ listeningAfter: null });
    const r = await stopRuntime(h.deps);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.alreadyStopped).toBe(true);
    expect(h.calls.terminates).toBe(0);
  });

  it("does NOT report success when the port keeps answering after terminate", async () => {
    const h = harness({ listeningAfter: 0, stopsAfter: null });
    const r = await stopRuntime(h.deps, { timeoutMs: 2000, pollMs: 500 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("still_listening");
  });

  it("reports a terminate error", async () => {
    const h = harness({ listeningAfter: 0, terminateThrows: true });
    const r = await stopRuntime(h.deps);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("stop_failed");
  });

  it("refuses a routable bind on stop too", async () => {
    const h = harness({ listeningAfter: 0 });
    const r = await stopRuntime(h.deps, { bind: "0.0.0.0" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("refused_bind");
  });
});

describe("rollback / round trip", () => {
  it("start then stop returns the machine to not-listening", async () => {
    const h = harness({ listeningAfter: 400, stopsAfter: 400 });
    const started = await startRuntime(h.deps, { pollMs: 400 });
    expect(started.ok).toBe(true);
    const stopped = await stopRuntime(h.deps, { pollMs: 400 });
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) throw new Error(stopped.reason);
    expect(stopped.alreadyStopped).toBe(false);
  });
});
