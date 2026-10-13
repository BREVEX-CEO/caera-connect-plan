import { describe, expect, it, vi } from "vitest";
import { ModelInstallationAuthority, type AuthorityDeps } from "../installation-authority";

/**
 * A NEW BUILD MUST NOT COST THE DEVICE ANOTHER 484 MB.
 *
 * `CLAUDE.md` forbids re-downloading after "updates, restarts, sign-in cycles,
 * or deploys", and the branch that honours it is four lines in `attemptPath`:
 * verified metadata plus bytes on disk means activate, never transfer.
 *
 * The transfer layer's own revisit test proves a complete checkpoint asks for
 * no ranges. This proves the layer above it never gets that far — the network
 * is not reached at all. Anything that puts a build identifier into the version
 * string, or stops trusting `verified`, fails here rather than on a stranger's
 * metered connection.
 */
const VERSION = "ocr-2dc0ee44eb397906";
const BYTES = 484_220_160;

function authorityOver(meta: { verified: boolean } | null, onDisk: number, durable = true) {
  const network = vi.fn(() => {
    throw new Error("the network was reached");
  });
  const activated = vi.fn(async () => ({ ok: true }) as const);
  const vault = {
    load: async () => {},
    readMeta: () => meta,
    bytesOf: async () => onDisk,
    activate: async () => durable,
    cleanupAfterActivation: async () => [],
    removeVersion: async () => {},
    readArtifact: async () => null,
    writeMeta: async () => durable,
    openWriter: async () => ({ write: async () => {}, close: async () => {} }),
  };
  const authority = new ModelInstallationAuthority({
    vault,
    fetchImpl: network,
    probeCapabilities: async () => [{ path: "wasm_threaded", available: true, why: "" }],
    resolveTarget: async () => ({
      version: VERSION,
      totalBytes: BYTES,
      sha256: "2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800",
      sources: [{ url: "https://ocade.in/api/offline/bytes/x", kind: "ocade" }],
    }),
    activateRuntime: activated,
    storageHeadroom: async () => null,
    requestPersistence: async () => true,
    hashBlob: async () => null,
    readIntent: () => null,
    writeIntent: () => {},
  } as unknown as AuthorityDeps);
  return { authority, network, activated };
}

describe("an ordinary update on a device that already installed it", () => {
  it("activates what is there and never reaches the network", async () => {
    const { authority, network, activated } = authorityOver({ verified: true }, BYTES);
    const state = await authority.install({ reason: "app_bootstrap" });

    expect(network).not.toHaveBeenCalled();
    expect(state.problem).toBeNull();
    // Not vacuous: it did not skip the network by doing nothing at all. The
    // runtime was activated, on the same version, from bytes already on disk.
    expect(activated).toHaveBeenCalledWith("wasm_threaded", VERSION, expect.any(Function));
  });

  it("is not ready when the active pointer could not be saved (F-192)", async () => {
    const { authority, activated } = authorityOver({ verified: true }, BYTES, false);
    const state = await authority.install({ reason: "app_bootstrap" });
    expect(state.problem).toMatch(/could not save/);
    expect(activated).not.toHaveBeenCalled();
  });
});

describe("a cold start with no connection (P07)", () => {
  const offline = (meta: { verified: boolean } | null, onDisk: number) => {
    const built = authorityOver(meta, onDisk);
    const deps = (built.authority as unknown as { deps: AuthorityDeps }).deps;
    deps.resolveTarget = async () => "unreachable";
    (deps.vault as unknown as { activeVersion: () => string }).activeVersion = () => VERSION;
    return built;
  };

  it("runs the model already verified on this device without asking OCADE", async () => {
    const { authority, network, activated } = offline({ verified: true }, BYTES);
    const state = await authority.install({ reason: "app_bootstrap" });
    expect(state.problem).toBeNull();
    expect(network).not.toHaveBeenCalled();
    expect(activated).toHaveBeenCalledWith("wasm_threaded", VERSION, expect.any(Function));
  });

  it("still says OCADE is unreachable when nothing verified is here", async () => {
    const { authority, activated } = offline({ verified: false }, BYTES);
    const state = await authority.install({ reason: "app_bootstrap" });
    expect(state.problem).toMatch(/could not reach/);
    expect(activated).not.toHaveBeenCalled();
  });
});

describe("removal while the engine is loading (F-069)", () => {
  it("never announces ready and unloads what finished loading", async () => {
    let finish!: () => void;
    const disposed = vi.fn(async () => {});
    const { authority } = authorityOver({ verified: true }, BYTES);
    const deps = (authority as unknown as { deps: AuthorityDeps }).deps;
    deps.activateRuntime = () =>
      new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      });
    deps.disposeRuntime = disposed;
    (deps.vault as unknown as { removeEverything: unknown }).removeEverything = async () => ({
      versionsRemoved: 1,
      legacyRemoved: 0,
      remainingFiles: 0,
    });
    const installing = authority.install({ reason: "reinstall" });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await authority.uninstall();
    finish();
    const state = await installing;
    expect(state.stage).not.toBe("ready");
    expect(authority.snapshot().stage).not.toBe("ready");
    expect(disposed).toHaveBeenCalledTimes(2);
  });
});

describe("another tab's ready (F-184)", () => {
  it("is not this tab's ready", async () => {
    const { authority, activated } = authorityOver({ verified: true }, BYTES);
    authority.observe({ ...authority.snapshot(), stage: "ready", fraction: 1 });
    expect(authority.isReady()).toBe(false);
    // And this tab's own install still activates its own runtime.
    await authority.install({ reason: "app_bootstrap" });
    expect(activated).toHaveBeenCalled();
    expect(authority.isReady()).toBe(true);
  });
});

describe("Repair (C14)", () => {
  it("proves a model marked verified again, and never activates damaged bytes", async () => {
    const { authority, activated } = authorityOver({ verified: true }, BYTES);
    const deps = (authority as unknown as { deps: AuthorityDeps }).deps;
    const vault = deps.vault as unknown as Record<string, unknown>;
    const removed = vi.fn(async () => {});
    vault.listVersions = async () => [];
    vault.removeVersion = removed;
    vault.readArtifact = async () => new Blob(["damaged"]);
    // Same length, wrong content: only hashing can tell.
    deps.hashBlob = async () => "0".repeat(64);
    // Stop before any download: the point is what Repair does with the bytes already here.
    deps.storageHeadroom = async () => 0;
    const state = await authority.repair();
    expect(removed).toHaveBeenCalledWith(VERSION);
    expect(activated).not.toHaveBeenCalled();
    expect(state.stage).not.toBe("ready");
  });

  it("an ordinary start still trusts the recorded proof", async () => {
    const { authority, activated } = authorityOver({ verified: true }, BYTES);
    await authority.install({ reason: "app_bootstrap" });
    expect(activated).toHaveBeenCalled();
  });
});

describe("room for a resumed install", () => {
  const withRoom = (onDisk: number, headroom: number) => {
    const built = authorityOver({ verified: false }, onDisk);
    const deps = (built.authority as unknown as { deps: AuthorityDeps }).deps;
    deps.storageHeadroom = async () => headroom;
    // The transfer, once reached, waits forever: reaching it is what is measured.
    const network = vi.fn(() => new Promise<Response>(() => {}));
    deps.fetchImpl = network as unknown as typeof fetch;
    return { authority: built.authority, network };
  };

  it("counts the bytes it already kept: only the rest needs room", async () => {
    // 200 MB kept of 484 MB, 400 MB free: enough for the rest, so the transfer goes on.
    const { authority, network } = withRoom(200_000_000, 400_000_000);
    void authority.install({ reason: "resumed" });
    await vi.waitFor(() => expect(network).toHaveBeenCalled());
    expect(authority.snapshot().stage).not.toBe("insufficient_storage");
  });

  it("still says so when the rest does not fit", async () => {
    const { authority, network } = withRoom(200_000_000, 300_000_000);
    const state = await authority.install({ reason: "resumed" });
    expect(state.problem).toMatch(/more local storage/);
    expect(network).not.toHaveBeenCalled();
  });
});
