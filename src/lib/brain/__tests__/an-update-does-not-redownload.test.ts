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
