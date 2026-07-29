import { describe, it, expect, afterEach, vi } from "vitest";
import {
  TauriCompanion,
  bootstrapCompanion,
  resetCompanionBootstrap,
} from "../native/tauri-companion";
import {
  getCompanion,
  setCompanionAdapter,
  UnavailableCompanion,
} from "../native/companion-bridge";
import { canonical, computeMac, type IpcEnvelope } from "../native/companion-client";
import {
  decideBrowserAction,
  dispatchBrowserAction,
  setBrowserBridge,
  UnavailableBrowserBridge,
  originOf,
  DEFAULT_SITE_POLICY,
  type SitePolicy,
} from "../native/browser-bridge";

const KEY = new Uint8Array(32).fill(9);

/**
 * END-TO-END COPILOT SESSION.
 *
 * Walks the real lifecycle against a fake host that verifies signatures the way
 * `ipc.rs` does: pair → capabilities → allowlist → run → stop → recover.
 * The seams that matter are authentication (every command signed) and recovery
 * (a latched stop must block work until explicitly cleared).
 */
function fakeHost() {
  const calls: { cmd: string; env?: IpcEnvelope }[] = [];
  const seenCounters: number[] = [];
  let halted = false;
  let allowlist: { apps: string[]; paths: string[] } = { apps: [], paths: [] };
  const audit: { run_id: string; at: number; detail: string; ok: boolean }[] = [];

  const invokeFn = async (cmd: string, args?: Record<string, unknown>) => {
    const env = args?.request as IpcEnvelope | undefined;
    calls.push({ cmd, env });

    // Verify exactly as the Rust host does.
    if (env) {
      const { mac, ...unsigned } = env;
      if (mac !== computeMac(KEY, canonical(unsigned))) throw new Error("BadMac");
      if (seenCounters.includes(env.counter)) throw new Error("Replay");
      seenCounters.push(env.counter);
    }

    switch (cmd) {
      case "open_session":
        return { sessionId: "s-live", key: Array.from(KEY) };
      case "status":
        return {
          available: true,
          version: "0.1.0",
          halted,
          capabilities: ["window.list", "selection.read", "app.open"],
        };
      case "get_allowlist":
        return { apps: allowlist.apps, paths: allowlist.paths };
      case "set_allowlist":
        allowlist = { apps: args?.apps as string[], paths: args?.paths as string[] };
        return true;
      case "execute": {
        if (halted) throw new Error("Emergency stop is active.");
        const action = args?.action as { kind: string; appId?: string };
        if (action.kind === "app.open" && !allowlist.apps.includes(action.appId ?? "")) {
          throw new Error("That application is not on your allowed list.");
        }
        audit.push({ run_id: "run-1", at: 1700000000, detail: "Opened notes.", ok: true });
        return { ok: true, runId: "run-1", detail: "Opened notes." };
      }
      case "emergency_stop":
        halted = true;
        audit.push({ run_id: "-", at: 1700000001, detail: "EMERGENCY STOP.", ok: true });
        return true;
      case "reset_emergency_stop":
        halted = false;
        return true;
      case "audit_log":
        return audit;
      default:
        return true;
    }
  };

  return {
    invokeFn,
    calls,
    get halted() {
      return halted;
    },
    get allowlist() {
      return allowlist;
    },
  };
}

afterEach(() => {
  resetCompanionBootstrap();
  setCompanionAdapter(new UnavailableCompanion());
  setBrowserBridge(new UnavailableBrowserBridge());
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("copilot session lifecycle", () => {
  it("pairs, reports host capabilities, and installs the signed adapter", async () => {
    const host = fakeHost();
    const boot = await bootstrapCompanion(host.invokeFn);
    expect(boot.installed).toBe(true);

    const companion = getCompanion() as TauriCompanion;
    const status = await companion.status();
    expect(status.available).toBe(true);
    expect(companion.capabilities()).toContain("selection.read");
  });

  it("every command after pairing carries a valid, non-replayed signature", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;

    await c.setAllowlist(["notes"], ["C:/work"]);
    await c.execute({ kind: "app.open", appId: "notes" }, { runId: "r", confirmed: true });
    await c.cancel("r");

    const signed = host.calls.filter((x) => x.env);
    expect(signed.length).toBeGreaterThanOrEqual(3);
    // Verification inside the host would have thrown on BadMac or Replay.
    const counters = signed.map((x) => x.env!.counter);
    expect(new Set(counters).size).toBe(counters.length);
  });

  it("the host refuses an app that is not on the allowlist", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;

    const denied = await c.execute(
      { kind: "app.open", appId: "not-allowed" },
      { runId: "r1", confirmed: true },
    );
    expect(denied.ok).toBe(false);
    expect(denied.detail).toMatch(/not on your allowed list/i);

    await c.setAllowlist(["notes"], []);
    const allowed = await c.execute(
      { kind: "app.open", appId: "notes" },
      { runId: "r2", confirmed: true },
    );
    expect(allowed.ok).toBe(true);
  });

  /**
   * `set_allowlist` REPLACES the list. A UI that edits without reading first
   * would silently revoke every entry it had not loaded.
   */
  it("the allowlist can be READ back, so an edit cannot silently drop entries", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;

    await c.setAllowlist(["notes", "editor"], ["C:/work"]);

    // Simulates a reload: a fresh panel hydrates from the host.
    const loaded = await c.getAllowlist();
    expect(loaded.apps).toEqual(["notes", "editor"]);
    expect(loaded.paths).toEqual(["C:/work"]);

    // Adding one more keeps the existing entries.
    await c.setAllowlist([...loaded.apps, "browser"], loaded.paths);
    expect((await c.getAllowlist()).apps).toEqual(["notes", "editor", "browser"]);
  });

  it("fails closed instead of treating an unreadable allowlist as empty", async () => {
    const c = new TauriCompanion({
      sessionId: "s1",
      key: KEY,
      invokeFn: async () => {
        throw new Error("pipe closed");
      },
    });
    await expect(c.getAllowlist()).rejects.toThrow("pipe closed");
  });

  it("protected input never reaches the host at all", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;

    const before = host.calls.length;
    const r = await c.execute(
      { kind: "selection.replace", text: "my password is hunter2" },
      { runId: "r1", confirmed: true },
    );
    expect(r.ok).toBe(false);
    expect(host.calls.length).toBe(before); // nothing was transmitted
  });

  it("emergency stop latches, blocks work, and requires an explicit reset", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;
    await c.setAllowlist(["notes"], []);

    await c.emergencyStop();
    expect(host.halted).toBe(true);
    expect((await c.status()).available).toBe(false);

    const blocked = await c.execute(
      { kind: "app.open", appId: "notes" },
      { runId: "r1", confirmed: true },
    );
    expect(blocked.ok).toBe(false);

    await c.resetEmergencyStop();
    expect((await c.status()).available).toBe(true);
    const resumed = await c.execute(
      { kind: "app.open", appId: "notes" },
      { runId: "r2", confirmed: true },
    );
    expect(resumed.ok).toBe(true);
  });

  it("the audit trail records what happened, already redacted", async () => {
    const host = fakeHost();
    await bootstrapCompanion(host.invokeFn);
    const c = getCompanion() as TauriCompanion;
    await c.setAllowlist(["notes"], []);
    await c.execute({ kind: "app.open", appId: "notes" }, { runId: "r1", confirmed: true });

    const log = await c.auditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].detail).toBeTruthy();
    expect(log.some((e) => /password|hunter2/i.test(e.detail))).toBe(false);
  });
});

/**
 * END-TO-END SITE PERMISSIONS.
 * The journey a user takes on the Browser control settings page.
 */
describe("browser site permissions", () => {
  const SITE = "https://app.example.com";
  const base = (over: Partial<SitePolicy> = {}): SitePolicy => ({
    ...DEFAULT_SITE_POLICY,
    allowOrigins: [SITE],
    ...over,
  });

  it("normalises a typed address to an origin", () => {
    expect(originOf("https://app.example.com/some/path?x=1")).toBe(SITE);
  });

  it("allowing a site does NOT grant reading — that is separate", async () => {
    const d = decideBrowserAction({ kind: "dom.read", url: `${SITE}/` }, base());
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.reason).toMatch(/not permitted/i);
  });

  it("granting read permits it, and blocking still wins over allow", async () => {
    expect(
      decideBrowserAction({ kind: "dom.read", url: `${SITE}/` }, base({ readOrigins: [SITE] }))
        .allow,
    ).toBe(true);

    const blocked = decideBrowserAction(
      { kind: "dom.read", url: `${SITE}/` },
      base({ readOrigins: [SITE], denyOrigins: [SITE] }),
    );
    expect(blocked.allow).toBe(false);
  });

  it("an unlisted site is refused entirely", () => {
    const d = decideBrowserAction({ kind: "navigate", url: "https://evil.test/" }, base());
    expect(d.allow).toBe(false);
  });

  it("private windows are never in scope, whatever the policy says", () => {
    const d = decideBrowserAction(
      { kind: "dom.read", url: `${SITE}/` },
      base({ readOrigins: [SITE] }),
      {
        isPrivateWindow: true,
      },
    );
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.reason).toMatch(/private/i);
  });

  it("reports honestly when no bridge is connected instead of faking success", async () => {
    const r = await dispatchBrowserAction(
      { kind: "dom.read", url: `${SITE}/` },
      base({ readOrigins: [SITE] }),
    );
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/isn't connected|not connected|needs the/i);
  });

  it("a screenshot always carries masking once a bridge exists", async () => {
    const seen: { redaction?: unknown }[] = [];
    setBrowserBridge({
      status: async () => ({ available: true }),
      perform: async (_a, opts) => {
        seen.push(opts);
        return { ok: true, detail: "captured" };
      },
    });
    await dispatchBrowserAction(
      { kind: "screenshot", url: `${SITE}/` },
      base({ readOrigins: [SITE] }),
    );
    expect(seen[0].redaction).toBeDefined();
  });
});
