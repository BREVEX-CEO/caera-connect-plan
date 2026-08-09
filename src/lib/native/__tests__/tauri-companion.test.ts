import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TauriCompanion,
  detectTauri,
  initCompanionAdapter,
  onCompanionEvent,
  bootstrapCompanion,
  closeActiveCompanionSession,
  COMPANION_SESSION_CLOSED_REASON,
  resetCompanionBootstrap,
} from "../tauri-companion";
import { canonical, computeMac, parseBody, type IpcEnvelope } from "../companion-client";
import {
  getCompanion,
  setCompanionAdapter,
  subscribeCompanionAdapter,
  UnavailableCompanion,
} from "../companion-bridge";

const KEY = new Uint8Array(32).fill(7);

/** Records every invoke so we can assert what actually crossed the boundary. */
function recorder(reply: unknown = { ok: true, runId: "r1", detail: "done" }) {
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  const fn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    calls.push({ cmd, args });
    return reply;
  });
  return { calls, fn };
}

function make(reply?: unknown) {
  const r = recorder(reply);
  return {
    ...r,
    companion: new TauriCompanion({ sessionId: "s1", key: KEY, invokeFn: r.fn }),
  };
}

/** The envelope minus its MAC — exactly what the host re-hashes. */
function unsigned(env: IpcEnvelope): Omit<IpcEnvelope, "mac"> {
  const { mac: _mac, ...rest } = env;
  void _mac;
  return rest;
}

afterEach(() => {
  // Never leave a fake adapter installed for another test file.
  setCompanionAdapter(new UnavailableCompanion());
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("detecting the real companion", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("is false in an ordinary browser, so the honest unavailable adapter stays", () => {
    (globalThis as unknown as { window: unknown }).window = {};
    expect(detectTauri()).toBe(false);
    expect(initCompanionAdapter({ sessionId: "s1", key: KEY })).toBe(false);
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
  });

  it("is false during SSR where there is no window at all", () => {
    expect(detectTauri()).toBe(false);
  });

  it("is true only when a real invoke bridge is present", () => {
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: { core: { invoke: () => {} } },
    };
    expect(detectTauri()).toBe(true);
  });

  it("REFUSES to install without a paired session key — nothing to sign with", () => {
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: { core: { invoke: () => {} } },
    };
    expect(initCompanionAdapter({ sessionId: "s1" })).toBe(false);
    expect(initCompanionAdapter({ sessionId: "s1", key: new Uint8Array(8) })).toBe(false);
    expect(initCompanionAdapter({ key: KEY })).toBe(false);
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
  });

  it("installs when genuinely inside the companion with a paired key", () => {
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: { core: { invoke: () => {} } },
    };
    expect(initCompanionAdapter({ sessionId: "s1", key: KEY, invokeFn: async () => ({}) })).toBe(
      true,
    );
    expect(getCompanion()).toBeInstanceOf(TauriCompanion);
  });
});

describe("every request is signed", () => {
  it("sends an envelope the Rust host can verify", async () => {
    const { companion, calls } = make();
    await companion.execute({ kind: "window.list" }, { runId: "r1" });

    const env = calls[0].args?.request as IpcEnvelope;
    expect(env.session_id).toBe("s1");
    expect(env.counter).toBe(1);
    expect(env.nonce).toMatch(/^[0-9a-f]{32}$/);
    // The MAC must match what ipc.rs recomputes over the canonical string.
    expect(env.mac).toBe(computeMac(KEY, canonical(unsigned(env))));
  });

  it("signs the complete managed-browser request before forwarding it", async () => {
    const reply = { id: 7, ok: true, data: { connected: true, browser: "chrome" } };
    const { companion, calls } = make(reply);
    const hostRequest = {
      version: 1,
      command: "status",
      sessionId: "s1",
    };

    await expect(companion.browserHostRequest(hostRequest)).resolves.toEqual(reply);
    expect(calls[0].cmd).toBe("browser_host_request");
    expect(calls[0].args?.hostRequest).toEqual(hostRequest);
    const envelope = calls[0].args?.request as IpcEnvelope;
    expect(envelope.mac).toBe(computeMac(KEY, canonical(unsigned(envelope))));
    expect(parseBody(envelope.body)).toEqual({
      command: "browser_host_request",
      args: { hostRequest },
    });
  });

  it("routes managed-browser emergency stop through the global host latch", async () => {
    const { companion, calls } = make(true);
    const result = await companion.browserHostRequest({ version: 1, command: "emergency_stop" });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("emergency_stop");
  });

  it("signs the complete bounded Python-host request before forwarding it", async () => {
    const reply = { id: 9, ok: true, result: { transport: "inherited-stdio-only" } };
    const { companion, calls } = make(reply);
    const hostRequest = { version: 1 as const, command: "health", params: {} };

    await expect(companion.pythonHostRequest(hostRequest)).resolves.toEqual(reply);
    expect(calls[0].cmd).toBe("python_host_request");
    expect(calls[0].args?.hostRequest).toEqual(hostRequest);
    const envelope = calls[0].args?.request as IpcEnvelope;
    expect(envelope.mac).toBe(computeMac(KEY, canonical(unsigned(envelope))));
    expect(parseBody(envelope.body)).toEqual({
      command: "python_host_request",
      args: { hostRequest },
    });
  });

  it("signs authenticated application inventory and validates bounded redacted entries", async () => {
    const { companion, calls } = make([
      { appId: "notepad", label: "Notes", processId: 42, windowTitle: "Notes" },
      {
        appId: "unsafe",
        label: "password 998877",
        processId: 43,
        windowTitle: "password 998877",
      },
      { appId: "malformed", label: "Missing process", windowTitle: "" },
    ]);
    const applications = await companion.applications();
    expect(applications).toEqual([
      { appId: "notepad", label: "Notes", processId: 42, windowTitle: "Notes" },
    ]);
    expect(calls[0].cmd).toBe("application_inventory");
    const envelope = calls[0].args?.request as IpcEnvelope;
    expect(envelope.mac).toBe(computeMac(KEY, canonical(unsigned(envelope))));
    expect(parseBody(envelope.body)).toEqual({
      command: "application_inventory",
      args: {},
    });
  });

  it("carries the command and args in the signed body, not just alongside it", async () => {
    const { companion, calls } = make();
    await companion.execute(
      { kind: "window.focus", target: "Notes" },
      { runId: "r1", operationId: "r1:step:0", confirmed: true },
    );

    const env = calls[0].args?.request as IpcEnvelope;
    const { command, args } = parseBody(env.body);
    expect(command).toBe("execute");
    expect(args).toEqual({
      action: { kind: "window.focus", target: "Notes" },
      confirmed: true,
      runId: "r1",
      operationId: "r1:step:0",
    });
    expect(calls[0].args).toMatchObject({
      runId: "r1",
      operationId: "r1:step:0",
    });
  });

  it("uses the run id as the stable operation id for interactive callers", async () => {
    const { companion, calls } = make();
    await companion.execute({ kind: "window.list" }, { runId: "interactive-1" });

    expect(parseBody((calls[0].args?.request as IpcEnvelope).body).args).toMatchObject({
      runId: "interactive-1",
      operationId: "interactive-1",
    });
  });

  it("advances the counter so a replayed envelope is rejected by the host", async () => {
    const { companion, calls } = make();
    await companion.execute({ kind: "window.list" }, { runId: "a" });
    await companion.execute({ kind: "screen.read" }, { runId: "b" });
    await companion.cancel("a");
    await companion.emergencyStop();

    const counters = calls.map((c) => (c.args?.request as IpcEnvelope).counter);
    expect(counters).toEqual([1, 2, 3, 4]);
    const nonces = new Set(calls.map((c) => (c.args?.request as IpcEnvelope).nonce));
    expect(nonces.size).toBe(4);
  });

  it("signs cancel and emergency stop too — they are not unauthenticated back doors", async () => {
    const { companion, calls } = make();
    await companion.cancel("run-9");
    await companion.emergencyStop();

    expect(calls.map((c) => c.cmd)).toEqual(["cancel", "emergency_stop"]);
    for (const c of calls) {
      const env = c.args?.request as IpcEnvelope;
      expect(env.mac).toBe(computeMac(KEY, canonical(unsigned(env))));
    }
    expect(parseBody((calls[0].args?.request as IpcEnvelope).body).args).toEqual({
      runId: "run-9",
    });
  });
});

describe("the guard runs before anything is sent", () => {
  it("never transmits protected input — the request is not even signed", async () => {
    const { companion, fn } = make();
    const res = await companion.execute(
      { kind: "text.type", text: "my password is hunter2" },
      { runId: "r1", confirmed: true },
    );
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/pause|yourself/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses an unconfirmed confirm-tier action without touching the machine", async () => {
    const { companion, fn } = make();
    const res = await companion.execute({ kind: "app.open", appId: "notes" }, { runId: "r1" });
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/confirmation/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("honours an already-aborted signal without sending anything", async () => {
    const { companion, fn } = make();
    const ctrl = new AbortController();
    ctrl.abort();
    const res = await companion.execute(
      { kind: "window.list" },
      { runId: "r1", signal: ctrl.signal },
    );
    expect(res.ok).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("results coming back from the host", () => {
  it("redacts protected content in the reply before it reaches the UI or audit", async () => {
    const { companion } = make({ ok: true, runId: "r1", detail: "typed the password 998877" });
    const res = await companion.execute({ kind: "window.list" }, { runId: "r1" });
    expect(res.detail).not.toContain("998877");
    expect(res.detail).not.toMatch(/password/i);
  });

  it("reports a transport failure honestly instead of claiming success", async () => {
    const companion = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => {
        throw new Error("companion pipe closed");
      },
    });
    const res = await companion.execute({ kind: "window.list" }, { runId: "r1" });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain("pipe closed");
  });

  it("does not invent success when the host omits ok", async () => {
    const { companion } = make({ runId: "r1", detail: "" });
    const res = await companion.execute({ kind: "window.list" }, { runId: "r1" });
    expect(res.ok).toBe(false);
  });

  it("accepts only bounded, typed native outputs", async () => {
    const { companion } = make({
      ok: true,
      runId: "r",
      detail: "captured",
      output: {
        kind: "screen_capture",
        path: "C:\\private\\screen.png",
        mimeType: "image/png",
        sha256: "a".repeat(64),
      },
    });
    const result = await companion.execute({ kind: "screen.read" }, { runId: "r" });
    expect(result.output).toEqual({
      kind: "screen_capture",
      path: "C:\\private\\screen.png",
      mimeType: "image/png",
      sha256: "a".repeat(64),
    });
  });

  it("accepts only bounded accessibility nodes without protected names", async () => {
    const { companion } = make({
      ok: true,
      runId: "r",
      detail: "read",
      output: {
        kind: "accessibility",
        nodes: [
          { role: "Button", name: "Save", enabled: true },
          { role: "Edit", name: "Search", enabled: true },
        ],
      },
    });
    const result = await companion.execute({ kind: "accessibility.read" }, { runId: "r" });
    expect(result.output).toEqual({
      kind: "accessibility",
      nodes: [
        { role: "Button", name: "Save", enabled: true },
        { role: "Edit", name: "Search", enabled: true },
      ],
    });

    const protectedResult = await make({
      ok: true,
      runId: "r",
      detail: "read",
      output: {
        kind: "accessibility",
        nodes: [{ role: "Edit", name: "password 998877", enabled: true }],
      },
    }).companion.execute({ kind: "accessibility.read" }, { runId: "r" });
    expect(protectedResult.ok).toBe(false);
    expect(protectedResult.output).toBeUndefined();
  });

  it("fails closed on malformed or protected native output", async () => {
    const { companion } = make({
      ok: true,
      runId: "r",
      detail: "read",
      output: { kind: "text", value: "password=secret" },
    });
    const result = await companion.execute({ kind: "screen.read" }, { runId: "r" });
    expect(result.ok).toBe(false);
    expect(result.output).toBeUndefined();
    expect(result.detail).toMatch(/invalid or protected/i);
  });
});

describe("host-reported capabilities", () => {
  it("is null until a successful status call — the UI must not guess", async () => {
    const { companion } = make();
    expect(companion.capabilities()).toBeNull();
  });

  it("reports exactly what the host build says it can do", async () => {
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({ available: true, capabilities: ["window.list", "screen.read"] }),
    });
    await c.status();
    expect(c.capabilities()).toEqual(["window.list", "screen.read"]);
  });

  it("clears capabilities when the host stops responding, rather than keeping stale ones", async () => {
    let fail = false;
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => {
        if (fail) throw new Error("gone");
        return { available: true, capabilities: ["window.list"] };
      },
    });
    await c.status();
    expect(c.capabilities()).toEqual(["window.list"]);
    fail = true;
    await c.status();
    expect(c.capabilities()).toBeNull();
  });

  it("clears capabilities and preserves the host reason when the running shell has no OS backend", async () => {
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({
        available: false,
        capabilities: ["window.list"],
        reason: "No runtime-proven operating-system action backend.",
      }),
    });
    const status = await c.status();
    expect(status.available).toBe(false);
    expect(status.reason).toMatch(/no runtime-proven/i);
    expect(c.capabilities()).toEqual([]);
  });
});

describe("allowlist, audit and stop recovery", () => {
  it("sends the allowlist SIGNED — an unauthenticated permission change would defeat the IPC layer", async () => {
    const { companion, calls } = make({ ok: true });
    await companion.setAllowlist(["notes"], ["C:/work"]);

    expect(calls[0].cmd).toBe("set_allowlist");
    expect(calls[0].args?.apps).toEqual(["notes"]);
    expect(calls[0].args?.paths).toEqual(["C:/work"]);

    const env = calls[0].args?.request as IpcEnvelope;
    expect(env).toBeDefined();
    expect(env.mac).toBe(computeMac(KEY, canonical(unsigned(env))));
    // The allowlist itself is inside the signed body, so it cannot be swapped.
    expect(parseBody(env.body).args).toEqual({ apps: ["notes"], paths: ["C:/work"] });
  });

  it("signs the emergency-stop RESET, since re-enabling control is privileged", async () => {
    const { companion, calls } = make({ ok: true });
    await companion.resetEmergencyStop();
    const env = calls[0].args?.request as IpcEnvelope;
    expect(env).toBeDefined();
    expect(env.mac).toBe(computeMac(KEY, canonical(unsigned(env))));
  });

  it("normalises the host audit trail and redacts it again on the way in", async () => {
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => [
        { run_id: "run-1", at: 1700000000, detail: "Opened notes", ok: true },
        { run_id: "run-2", at: 1700000001, detail: "typed password 445566", ok: false },
      ],
    });
    const entries = await c.auditLog();
    expect(entries[0]).toEqual({
      runId: "run-1",
      at: 1700000000,
      detail: "Opened notes",
      ok: true,
    });
    expect(entries[1].detail).not.toContain("445566");
    expect(entries[1].detail).not.toMatch(/password/i);
  });

  it("returns an empty audit rather than throwing on a malformed reply", async () => {
    const c = new TauriCompanion({ sessionId: "s1", key: KEY, invokeFn: async () => "nonsense" });
    await expect(c.auditLog()).resolves.toEqual([]);
  });

  it("tracks the halted flag and clears it only on an explicit reset", async () => {
    let halted = true;
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async (cmd) => {
        if (cmd === "reset_emergency_stop") {
          halted = false;
          return true;
        }
        return { available: true, halted };
      },
    });
    await c.status();
    expect(c.isHalted()).toBe(true);
    await c.resetEmergencyStop();
    expect(c.isHalted()).toBe(false);
    expect((await c.status()).available).toBe(true);
  });

  it("closes the session with its own id", async () => {
    const { companion, calls } = make({ ok: true });
    setCompanionAdapter(companion);
    await companion.closeSession();
    expect(calls[0]).toMatchObject({
      cmd: "close_session",
      args: {
        sessionId: "s1",
        request: { body: 'close_session|{"sessionId":"s1"}', session_id: "s1" },
      },
    });
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
    expect((await getCompanion().status()).reason).toBe(COMPANION_SESSION_CLOSED_REASON);
  });

  it("invalidates locally before a slow host close finishes", async () => {
    let release!: () => void;
    const closing = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    const companion = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async (cmd) => {
        calls.push(cmd);
        if (cmd === "close_session") await closing;
        return { ok: true };
      },
    });
    setCompanionAdapter(companion);
    const replacements: unknown[] = [];
    const off = subscribeCompanionAdapter((adapter) => replacements.push(adapter));

    const pending = companion.closeSession();
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
    expect(replacements).toHaveLength(1);
    expect(replacements[0]).toBeInstanceOf(UnavailableCompanion);
    expect((await companion.status()).available).toBe(false);
    const result = await companion.execute({ kind: "window.list" }, { runId: "late" });
    expect(result).toEqual({
      ok: false,
      runId: "late",
      detail: COMPANION_SESSION_CLOSED_REASON,
    });
    expect(calls).toEqual(["close_session"]);
    release();
    await pending;
    off();
  });

  it("blocks every later signed command locally but keeps emergency stop available", async () => {
    const { companion, calls } = make({ ok: true });
    await companion.closeSession();

    await expect(companion.setAllowlist(["notes"], [])).rejects.toThrow(/closed/i);
    await expect(companion.resetEmergencyStop()).rejects.toThrow(/closed/i);
    await expect(companion.cancel("late")).rejects.toThrow(/closed/i);
    await expect(
      companion.observe({ kind: "window.focus", runId: "late", operationId: "late:0" }),
    ).rejects.toThrow(/closed/i);
    // An unreadable host allowlist is unknown, not empty. Returning an empty
    // list here would let a reconnecting UI overwrite permissions it never
    // successfully loaded.
    await expect(companion.getAllowlist()).rejects.toThrow(/closed/i);
    await expect(companion.auditLog()).resolves.toEqual([]);

    await companion.emergencyStop();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      cmd: "close_session",
      args: { sessionId: "s1", request: { body: 'close_session|{"sessionId":"s1"}' } },
    });
    expect(calls[1]).toEqual({ cmd: "emergency_stop", args: undefined });
  });

  it("is idempotent even when two callers close concurrently", async () => {
    const { companion, calls } = make({ ok: true });
    await Promise.all([companion.closeSession(), companion.closeSession()]);
    expect(calls.filter((c) => c.cmd === "close_session")).toHaveLength(1);
  });

  it("stays locally closed when the host close IPC fails", async () => {
    const companion = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => {
        throw new Error("pipe already gone");
      },
    });
    setCompanionAdapter(companion);
    await expect(companion.closeSession()).rejects.toThrow(/pipe already gone/i);
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
    await expect(companion.cancel("late")).rejects.toThrow(/closed/i);
  });
});

/**
 * Companion recovery.
 *
 * The companion frequently starts a moment AFTER the page on a cold boot. If a
 * failed handshake were cached, it could never connect for the rest of the
 * session and "Re-check" would be a button that does nothing.
 */
describe("bootstrap recovery", () => {
  beforeEach(() => resetCompanionBootstrap());
  afterEach(() => resetCompanionBootstrap());

  it("does NOT cache a failure — a later attempt can still succeed", async () => {
    let up = false;
    const invokeFn = async () => {
      if (!up) throw new Error("companion not started");
      return { sessionId: "s1", key: Array.from(KEY) };
    };

    const first = await bootstrapCompanion(invokeFn);
    expect(first.installed).toBe(false);

    up = true; // companion finished starting
    const second = await bootstrapCompanion(invokeFn);
    expect(second.installed).toBe(true);
    expect(getCompanion()).toBeInstanceOf(TauriCompanion);
  });

  it("caches a SUCCESS so the session key is not re-minted on every check", async () => {
    let opens = 0;
    const invokeFn = async () => {
      opens++;
      return { sessionId: "s1", key: Array.from(KEY) };
    };
    await bootstrapCompanion(invokeFn);
    await bootstrapCompanion(invokeFn);
    await bootstrapCompanion(invokeFn);
    expect(opens).toBe(1);
  });

  it("closing a successful session clears the cache so reconnect opens a new one", async () => {
    let opens = 0;
    const invokeFn = async (cmd: string) => {
      if (cmd === "open_session") {
        opens++;
        return { sessionId: `s${opens}`, key: Array.from(KEY) };
      }
      return true;
    };
    await bootstrapCompanion(invokeFn);
    const first = getCompanion();
    await closeActiveCompanionSession();
    await bootstrapCompanion(invokeFn);
    expect(opens).toBe(2);
    expect(getCompanion()).toBeInstanceOf(TauriCompanion);
    expect(getCompanion()).not.toBe(first);
  });

  it("sign-out defeats an in-flight handshake and closes the stale host session", async () => {
    let release!: (value: unknown) => void;
    const opened = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
    const invokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      calls.push({ cmd, args });
      if (cmd === "open_session") return opened;
      return true;
    });

    const pending = bootstrapCompanion(invokeFn);
    await closeActiveCompanionSession();
    release({ sessionId: "stale", key: Array.from(KEY) });

    const result = await pending;
    expect(result).toEqual({ installed: false, reason: COMPANION_SESSION_CLOSED_REASON });
    expect(getCompanion()).toBeInstanceOf(UnavailableCompanion);
    expect(calls).toContainEqual(
      expect.objectContaining({
        cmd: "close_session",
        args: expect.objectContaining({
          sessionId: "stale",
          request: expect.objectContaining({
            body: 'close_session|{"sessionId":"stale"}',
            session_id: "stale",
          }),
        }),
      }),
    );
  });

  it("joins a concurrent attempt instead of opening two sessions", async () => {
    let opens = 0;
    const invokeFn = async () => {
      opens++;
      await new Promise((r) => setTimeout(r, 5));
      return { sessionId: "s1", key: Array.from(KEY) };
    };
    const [a, b] = await Promise.all([bootstrapCompanion(invokeFn), bootstrapCompanion(invokeFn)]);
    expect(a.installed).toBe(true);
    expect(b.installed).toBe(true);
    expect(opens).toBe(1);
  });

  it("refuses a session the host returns malformed, and stays retryable", async () => {
    let good = false;
    const invokeFn = async () =>
      good ? { sessionId: "s1", key: Array.from(KEY) } : { sessionId: "s1", key: [1, 2, 3] };

    expect((await bootstrapCompanion(invokeFn)).installed).toBe(false);
    good = true;
    expect((await bootstrapCompanion(invokeFn)).installed).toBe(true);
  });

  it("never echoes the underlying error, which could carry key material", async () => {
    const invokeFn = async () => {
      throw new Error("key=ABCDEF0123456789 rejected");
    };
    const r = await bootstrapCompanion(invokeFn);
    expect(r.installed).toBe(false);
    if (r.installed) throw new Error("unreachable");
    expect(r.reason).not.toContain("ABCDEF0123456789");
  });
});

describe("host events", () => {
  it("returns a safe no-op unsubscribe outside the companion", () => {
    const off = onCompanionEvent("action-started", () => {});
    expect(() => off()).not.toThrow();
  });

  it("subscribes to the namespaced host event and detaches on unsubscribe", async () => {
    const detach = vi.fn();
    const names: string[] = [];
    const listen = vi.fn(async (name: string) => {
      names.push(name);
      return detach;
    });
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: { core: { invoke: () => {} }, event: { listen } },
    };

    const off = onCompanionEvent("emergency-stop", () => {});
    await Promise.resolve();
    expect(names[0]).toBe("ocade://emergency-stop");
    off();
    expect(detach).toHaveBeenCalled();
  });

  it("detaches even when unsubscribed before the listener finished attaching", async () => {
    const detach = vi.fn();
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: { core: { invoke: () => {} }, event: { listen: async () => detach } },
    };
    const off = onCompanionEvent("action-finished", () => {});
    off(); // unsubscribe first — the promise has not resolved yet
    await Promise.resolve();
    await Promise.resolve();
    expect(detach).toHaveBeenCalled();
  });

  it("delivers the payload to the handler", async () => {
    // Held in an object so TS doesn't narrow the captured handler away to `never`.
    const handlers: { fire?: (e: { payload: unknown }) => void } = {};
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: {
        core: { invoke: () => {} },
        event: {
          listen: async (_n: string, h: (e: { payload: unknown }) => void) => {
            handlers.fire = h;
            return () => {};
          },
        },
      },
    };
    const seen: unknown[] = [];
    onCompanionEvent("action-started", (p) => seen.push(p));
    await Promise.resolve();
    handlers.fire?.({ payload: "run-7" });
    expect(seen).toEqual(["run-7"]);
  });
});

describe("signed native observation channel", () => {
  it("signs the observation request independently from execution", async () => {
    const { companion, calls } = make({ ok: true });
    const observation = {
      kind: "window.focus" as const,
      runId: "run-7",
      operationId: "run-7:step:0",
    };

    await companion.observe(observation);

    expect(calls[0].cmd).toBe("observe");
    const envelope = calls[0].args?.request as IpcEnvelope;
    expect(envelope.mac).toBe(computeMac(KEY, canonical(unsigned(envelope))));
    expect(parseBody(envelope.body)).toEqual({
      command: "observe",
      args: { observation },
    });
    expect(calls[0].args?.observation).toEqual(observation);
  });
});

describe("status", () => {
  it("reports available when the host says so", async () => {
    const s = await new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({ available: true, version: "0.1.0" }),
    }).status();
    expect(s.available).toBe(true);
    expect(s.version).toBe("0.1.0");
  });

  it("normalises permission and setup evidence without trusting malformed host fields", async () => {
    const status = await new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({
        available: true,
        version: "0.1.0",
        capabilities: ["window.list"],
        permissions: [
          {
            id: "screen_capture",
            label: "Screen capture",
            state: "granted",
            guidance: "Private cache only.",
          },
          { id: "bad", label: "Bad", state: "invented", guidance: "No" },
        ],
        installGuidance: ["Restart the signed companion.", 123],
      }),
    }).status();
    expect(status.permissions).toEqual([
      {
        id: "screen_capture",
        label: "Screen capture",
        state: "granted",
        guidance: "Private cache only.",
      },
    ]);
    expect(status.installGuidance).toEqual(["Restart the signed companion."]);
  });

  it("reports UNAVAILABLE while emergency stop is latched", async () => {
    const s = await new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({ available: true, halted: true }),
    }).status();
    expect(s.available).toBe(false);
    expect(s.reason).toMatch(/emergency stop/i);
  });

  it("reports unavailable, not a crash, when the host cannot be reached", async () => {
    const s = await new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => {
        throw new Error("no such pipe");
      },
    }).status();
    expect(s.available).toBe(false);
    expect(s.reason).toBe("no such pipe");
  });

  it("uses an honest fallback when an unavailable host omits its reason", async () => {
    const s = await new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => ({ available: false, capabilities: [] }),
    }).status();
    expect(s.available).toBe(false);
    expect(s.reason).toMatch(/no runtime-proven capabilities/i);
  });
});
