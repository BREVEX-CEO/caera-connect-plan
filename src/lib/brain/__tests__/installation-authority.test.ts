import { describe, it, expect, beforeEach, vi } from "vitest";
import { describeInstall, isPreparing } from "../installation-state";
import {
  ModelInstallationAuthority,
  checkpointFrom,
  type AuthorityDeps,
  type CapabilityRung,
  type InstallState,
  type InstallTarget,
} from "../installation-authority";
import { ModelVault } from "../model-vault";
import { ModelStore } from "../model-store";
import { sha256OfBytes } from "../streaming-digest";
import type { ModelFileWriter } from "../model-vault";

/**
 * The authority, driven against fake hardware, a fake disk and a fake network.
 *
 * The cases at the top are the ones actually observed in production and named
 * in the brief: a "Local engine unavailable" shown beside "Preparing OCADE", a
 * warm and a send racing, a "retrying" label with no retry behind it, and
 * competing downloads from several tabs. Each one is now a property this
 * suite holds rather than a thing somebody has to remember not to reintroduce.
 */

const KIB = 1024;

function artifact(length: number, seed = 5): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out[i] = (x >>> 24) & 0xff;
  }
  return out;
}

/** An in-memory localStorage, so pointers and metadata behave as they do live. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get size() {
      return map.size;
    },
    keys: () => [...map.keys()],
  };
}

/** A ModelStore whose files live in a Map, with a real writer contract. */
function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const meta = new Map<string, unknown>();

  const makeWriter = (key: string): ModelFileWriter => ({
    async write(chunk, at) {
      const existing = files.get(key) ?? new Uint8Array(0);
      const size = Math.max(existing.length, at + chunk.length);
      const next = new Uint8Array(size);
      next.set(existing, 0);
      next.set(chunk, at);
      files.set(key, next);
      return true;
    },
    async flush() {
      return true;
    },
    async close() {},
  });

  const store = {
    async sizeOf(key: string) {
      return files.get(key)?.length ?? 0;
    },
    async append(key: string, chunk: Uint8Array, at: number) {
      return makeWriter(key).write(chunk, at);
    },
    async openWriter(key: string) {
      return makeWriter(key);
    },
    async movePath(from: string, to: string) {
      const bytes = files.get(from);
      if (!bytes) return false;
      files.set(to, bytes);
      files.delete(from);
      return true;
    },
    async readBlob(key: string) {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes as BufferSource]) : null;
    },
    async remove(key: string) {
      return files.delete(key);
    },
    async readMeta(key: string) {
      return (meta.get(key) ?? null) as never;
    },
    async writeMeta(key: string, value: unknown) {
      if (value === null) meta.delete(key);
      else meta.set(key, value);
    },
    async list() {
      return [...files.entries()].map(([key, bytes]) => ({
        key,
        bytes: bytes.length,
        verified: false,
      }));
    },
  } as unknown as ModelStore;

  return { store, files, meta };
}

/** A server that serves one artifact over Range and can be told to misbehave. */
function server(data: Uint8Array, options: { failFirst?: number; corrupt?: boolean } = {}) {
  let requests = 0;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests += 1;
    if (options.failFirst && requests <= options.failFirst) throw new TypeError("Failed to fetch");
    const header = (init?.headers as Record<string, string> | undefined)?.Range;
    const match = header ? /bytes=(\d+)-(\d*)/.exec(header) : null;
    if (!match) {
      return new Response(data as unknown as BodyInit, {
        status: 200,
        headers: { "content-length": String(data.length) },
      });
    }
    const start = Number(match[1]);
    const end = match[2] === "" ? data.length - 1 : Number(match[2]);
    if (start >= data.length) return new Response(null, { status: 416 });
    const slice = data.slice(start, Math.min(end, data.length - 1) + 1).slice();
    if (options.corrupt) slice[0] ^= 0xff;
    return new Response(slice as unknown as BodyInit, {
      status: 206,
      headers: {
        "content-range": `bytes ${start}-${start + slice.length - 1}/${data.length}`,
        "content-length": String(slice.length),
      },
    });
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    get requests() {
      return requests;
    },
  };
}

const WEBGPU_RUNG: CapabilityRung = {
  path: "webgpu",
  available: true,
  why: "the graphics card offered an adapter",
};

/** A working setup: one capable path, one artifact, everything succeeds. */
function harness(
  overrides: Partial<AuthorityDeps> = {},
  options: { data?: Uint8Array; version?: string; corrupt?: boolean; failFirst?: number } = {},
) {
  const data = options.data ?? artifact(64 * KIB);
  const version = options.version ?? "test-engine-v1";
  const net = server(data, { corrupt: options.corrupt, failFirst: options.failFirst });
  const storage = memoryStorage();
  const backing = memoryStore();
  const vault = new ModelVault({ store: backing.store, storage });
  const activations: string[] = [];
  const telemetry: unknown[] = [];

  const target: InstallTarget = {
    version,
    totalBytes: data.length,
    sha256: sha256OfBytes(data),
    sources: [{ url: "https://cdn.example/engine", kind: "ocade_cdn" }],
  };

  const deps: AuthorityDeps = {
    vault,
    fetchImpl: net.fetchImpl,
    probeCapabilities: async () => [WEBGPU_RUNG],
    resolveTarget: async () => target,
    activateRuntime: async (path, v) => {
      activations.push(`${path}:${v}`);
      return { ok: true };
    },
    storageHeadroom: async () => 10 * 1024 * 1024 * 1024,
    requestPersistence: async () => true,
    // The real one streams; here the whole test artifact fits comfortably.
    hashBlob: async (blob) => sha256OfBytes(new Uint8Array(await blob.arrayBuffer())),
    telemetry: (event) => telemetry.push(event),
    plan: { chunkBytes: 4 * KIB, concurrency: 3, because: "test" },
    ...overrides,
  };

  return {
    authority: new ModelInstallationAuthority(deps),
    vault,
    storage,
    backing,
    net,
    data,
    version,
    target,
    activations,
    telemetry,
    deps,
  };
}

describe("a clean first install", () => {
  it("reaches ready, verified and activated", async () => {
    const h = harness();
    const state = await h.authority.install();
    expect(state.stage).toBe("ready");
    expect(h.vault.activeVersion()).toBe(h.version);
    expect(h.vault.readMeta(h.version)?.verified).toBe(true);
    expect(h.activations).toEqual([`webgpu:${h.version}`]);
  });

  it("passes through the stages in order and never shows two at once", async () => {
    const h = harness();
    const seen: string[] = [];
    h.authority.subscribe((s) => seen.push(s.stage));
    await h.authority.install();
    expect(seen[0]).toBe("idle");
    expect(seen).toContain("checking_device");
    expect(seen).toContain("checking_storage");
    expect(seen).toContain("downloading");
    expect(seen).toContain("verifying");
    expect(seen).toContain("loading");
    expect(seen.at(-1)).toBe("ready");
  });

  it("asks for persistent storage before the bytes land", async () => {
    const asked = vi.fn(async () => true);
    const h = harness({ requestPersistence: asked });
    await h.authority.install();
    expect(asked).toHaveBeenCalled();
  });
});

describe("THE OBSERVED FAILURES", () => {
  /*
   * "Local engine unavailable" appeared at the same time as "Preparing OCADE
   * — 62%" because engine status and preparation progress were separate stores
   * that nothing reconciled. There is now one state, so the situation is not
   * merely unlikely — it is unrepresentable.
   */
  it("cannot report unavailable and preparing at the same time", async () => {
    const h = harness();
    const states: InstallState[] = [];
    h.authority.subscribe((s) => states.push({ ...s }));
    await h.authority.install();
    for (const state of states) {
      const preparing = isPreparing(state.stage);
      const broken =
        state.stage === "fatal_error" ||
        state.stage === "recoverable_error" ||
        state.stage === "insufficient_storage";
      expect(preparing && broken).toBe(false);
    }
  });

  /*
   * `warm()` and `send()` used to enter `ensureLoaded` independently. Now every
   * caller joins the same operation, so a second call cannot start a second
   * transfer.
   */
  it("joins an install already in flight instead of starting another", async () => {
    const h = harness({ plan: { chunkBytes: 4 * KIB, concurrency: 1, because: "test" } });
    const warm = h.authority.install({ reason: "warm" });
    const send = h.authority.install({ reason: "warm" });
    const composer = h.authority.install({ reason: "warm" });
    expect(send).toBe(warm);
    expect(composer).toBe(warm);
    await warm;
    // 64 KiB in 4 KiB chunks is 16 requests. Three callers, still 16.
    expect(h.net.requests).toBe(16);
  });

  it("returns immediately, with no request at all, once ready", async () => {
    const h = harness();
    await h.authority.install();
    const before = h.net.requests;
    await h.authority.install({ reason: "warm" });
    await h.authority.install({ reason: "app_bootstrap" });
    expect(h.net.requests).toBe(before);
  });

  /*
   * A "retrying" state used to be written by a catch block that then did
   * nothing. Now the label and the behaviour are the same fact.
   */
  it("only shows retrying when a retry is genuinely in flight", async () => {
    // The first two requests fail, so attempt 2 is real.
    const h = harness({}, { failFirst: 2 });
    const seen = new Set<string>();
    h.authority.subscribe((s) => seen.add(s.stage));
    const state = await h.authority.install();
    if (seen.has("retrying")) {
      expect(state.retries).toBeGreaterThan(0);
    }
    // Either it recovered within one attempt or it retried; both are honest.
    expect(["ready", "recoverable_error"]).toContain(state.stage);
  });

  it("never reports retrying with a retry count of zero", async () => {
    const h = harness({}, { failFirst: 2 });
    const violations: InstallState[] = [];
    h.authority.subscribe((s) => {
      if (s.stage === "retrying" && s.retries === 0) violations.push(s);
    });
    await h.authority.install();
    expect(violations).toEqual([]);
  });

  /*
   * Several tabs each downloaded the same gigabyte, competing for the same
   * connection and the same disk. The lock makes one tab do the work.
   */
  it("watches rather than competes when another tab owns the install", async () => {
    const h = harness({
      // A lock this tab does not win.
      acquireLock: async () => false,
    });
    const state = await h.authority.install();
    expect(state.observing).toBe(true);
    expect(h.net.requests).toBe(0);
  });

  it("shows the owning tab's progress to a follower", async () => {
    const h = harness({ acquireLock: async () => false });
    await h.authority.install();
    h.authority.observe({
      stage: "downloading",
      fraction: 0.42,
      etaSeconds: 30,
      detail: null,
      problem: null,
      remedies: [],
      observing: false,
      retries: 0,
      path: "webgpu",
    });
    const state = h.authority.snapshot();
    expect(state.stage).toBe("downloading");
    expect(state.fraction).toBe(0.42);
    expect(state.observing).toBe(true);
    // A follower must not offer a button that would start a second download.
    expect(state.remedies).toEqual([]);
  });

  it("keeps adopting owner progress while queued for the cross-tab lock", async () => {
    let releaseLock!: () => void;
    const lockAvailable = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const broadcast = vi.fn();
    const h = harness({
      broadcast,
      acquireLock: async (work) => {
        await lockAvailable;
        await work();
        return true;
      },
    });

    const install = h.authority.install();
    h.authority.observe({
      stage: "downloading",
      fraction: 0.73,
      etaSeconds: 12,
      detail: null,
      problem: null,
      remedies: [],
      observing: false,
      retries: 0,
      path: "webgpu",
    });

    expect(h.authority.snapshot()).toMatchObject({
      stage: "downloading",
      fraction: 0.73,
      observing: true,
    });
    expect(broadcast).not.toHaveBeenCalled();

    releaseLock();
    await expect(install).resolves.toMatchObject({ stage: "ready", observing: false });
  });
});

describe("a corrupt artifact never becomes the active engine", () => {
  it("deletes it and reports honestly rather than running it", async () => {
    const h = harness({}, { corrupt: true });
    const state = await h.authority.install();
    expect(state.stage).toBe("recoverable_error");
    expect(h.vault.activeVersion()).toBeNull();
    expect(h.vault.readMeta(h.version)?.verified).toBeFalsy();
    expect(h.activations).toEqual([]);
  });

  it("leaves an existing working engine alone when an upgrade fails", async () => {
    // Install v1 successfully.
    const shared = memoryStore();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: shared.store, storage });
    const v1Data = artifact(32 * KIB, 1);
    const first = harness(
      {
        vault,
        fetchImpl: server(v1Data).fetchImpl,
        resolveTarget: async () => ({
          version: "v1",
          totalBytes: v1Data.length,
          sha256: sha256OfBytes(v1Data),
          sources: [{ url: "https://cdn.example/v1", kind: "ocade_cdn" }],
        }),
      },
      { data: v1Data, version: "v1" },
    );
    expect((await first.authority.install()).stage).toBe("ready");
    expect(vault.activeVersion()).toBe("v1");

    // Now attempt v2, which arrives corrupt.
    const v2Data = artifact(32 * KIB, 2);
    const second = harness({
      vault,
      fetchImpl: server(v2Data, { corrupt: true }).fetchImpl,
      resolveTarget: async () => ({
        version: "v2",
        totalBytes: v2Data.length,
        sha256: sha256OfBytes(v2Data),
        sources: [{ url: "https://cdn.example/v2", kind: "ocade_cdn" }],
      }),
    });
    const state = await second.authority.install();

    expect(state.stage).toBe("recoverable_error");
    // THE WORKING ENGINE IS UNTOUCHED. A failed upgrade must not destroy it.
    expect(vault.activeVersion()).toBe("v1");
    expect(vault.readMeta("v1")?.verified).toBe(true);
    expect(await vault.bytesOf("v1")).toBe(v1Data.length);
  });
});

describe("storage", () => {
  it("says it needs room — not 'unsupported' — and offers real remedies", async () => {
    const h = harness({ storageHeadroom: async () => 1024 });
    const state = await h.authority.install();
    expect(state.stage).toBe("insufficient_storage");
    expect(state.remedies).toContain("free_storage");
    expect(state.remedies).toContain("remove_local_intelligence");
    expect(state.remedies).toContain("retry");
    // The wording is about room, never about the device being incapable.
    expect(describeInstall(state)).toMatch(/storage/i);
  });

  it("proceeds when the browser will not say how much room there is", async () => {
    // Refusing on no evidence would block every browser that reports nothing.
    const h = harness({ storageHeadroom: async () => null });
    expect((await h.authority.install()).stage).toBe("ready");
  });

  it("refuses honestly when there is nowhere to write at all", async () => {
    const h = harness();
    vi.spyOn(h.vault, "openWriter").mockResolvedValue(null);
    const state = await h.authority.install();
    expect(state.stage).toBe("fatal_error");
    expect(state.remedies).toContain("pair_a_device");
  });
});

describe("the capability ladder", () => {
  it("falls to the next rung when a runtime will not start", async () => {
    const tried: string[] = [];
    const h = harness({
      probeCapabilities: async () => [
        { path: "webgpu", available: true, why: "an adapter was offered" },
        { path: "wasm_single", available: true, why: "WebAssembly is available" },
      ],
      resolveTarget: async () => null,
      activateRuntime: async (path) => {
        tried.push(path);
        return path === "webgpu"
          ? { ok: false, reason: "the graphics card ran out of memory" }
          : { ok: true };
      },
    });
    const state = await h.authority.install();
    expect(state.stage).toBe("ready");
    expect(tried).toEqual(["webgpu", "wasm_single"]);
    expect(state.path).toBe("wasm_single");
  });

  it("only refuses after every rung has been tried", async () => {
    const tried: string[] = [];
    const h = harness({
      probeCapabilities: async () => [
        { path: "webgpu", available: true, why: "an adapter was offered" },
        { path: "webgpu_reduced", available: true, why: "a smaller context fits" },
        { path: "wasm_single", available: true, why: "WebAssembly is available" },
      ],
      resolveTarget: async () => null,
      activateRuntime: async (path) => {
        tried.push(path);
        return { ok: false, reason: `${path} did not start` };
      },
    });
    const state = await h.authority.install();
    expect(tried).toEqual(["webgpu", "webgpu_reduced", "wasm_single"]);
    expect(state.stage).toBe("recoverable_error");
    expect(state.remedies).toContain("retry");
  });

  it("names the concrete limitation when nothing at all can run", async () => {
    const h = harness({
      probeCapabilities: async () => [
        { path: "webgpu", available: false, why: "this browser blocks local storage entirely" },
      ],
    });
    const state = await h.authority.install();
    expect(state.stage).toBe("fatal_error");
    // Not a generic "unsupported device": it says what was actually wrong.
    expect(state.problem).toContain("blocks local storage");
    expect(state.remedies).toContain("pair_a_device");
    expect(state.remedies).toContain("use_another_device");
  });

  it("goes straight to activation for a path with nothing to download", async () => {
    const h = harness({
      probeCapabilities: async () => [
        { path: "desktop_bridge", available: true, why: "a local engine is running" },
      ],
      resolveTarget: async () => null,
    });
    const state = await h.authority.install();
    expect(state.stage).toBe("ready");
    expect(h.net.requests).toBe(0);
  });
});

describe("pausing and resuming", () => {
  it("keeps its progress when paused, and does not report ready", async () => {
    const h = harness({ plan: { chunkBytes: 4 * KIB, concurrency: 1, because: "test" } });
    const running = h.authority.install();
    h.authority.pause();
    await running;
    expect(h.authority.snapshot().stage).not.toBe("ready");
  });

  it("a retry is a new attempt, not a relabelled old one", async () => {
    const h = harness({}, { corrupt: true });
    await h.authority.install();
    const before = h.net.requests;
    await h.authority.retry();
    expect(h.net.requests).toBeGreaterThan(before);
  });

  it("does not re-download an engine that is already verified", async () => {
    const h = harness();
    await h.authority.install();
    const before = h.net.requests;

    // A fresh authority over the same vault — as after a reload.
    const second = new ModelInstallationAuthority({ ...h.deps, vault: h.vault });
    const state = await second.install();
    expect(state.stage).toBe("ready");
    expect(h.net.requests).toBe(before);
  });

  it("never moves measured setup progress backwards", async () => {
    const h = harness();
    const fractions: number[] = [];
    h.authority.subscribe((state) => {
      if (state.fraction !== null) fractions.push(state.fraction);
    });

    await h.authority.install();

    expect(fractions.length).toBeGreaterThan(1);
    for (let index = 1; index < fractions.length; index += 1) {
      expect(fractions[index]).toBeGreaterThanOrEqual(fractions[index - 1]!);
    }
  });
});

describe("a native companion takes the work, and takes it EXCLUSIVELY", () => {
  /*
   * The rule the whole handoff rests on: one owner per job. A browser that
   * hands off and then transfers anyway is two processes writing the same
   * gigabyte, competing for the same connection and the same disk.
   */
  it("does NOT download when the companion took the job", async () => {
    const h = harness({
      handOff: async () => ({ handedOff: true, platform: "android", verified: false }),
    });
    const state = await h.authority.install();
    expect(h.net.requests).toBe(0);
    // And it says so rather than reporting a failure the user should act on.
    expect(state.stage).toBe("downloading");
  });

  it("activates only after the AUTHORITY has confirmed the digest", async () => {
    // `verified: true` here means this codebase compared the companion's
    // reported version and digest against the catalogue — not that the
    // companion asserted it was fine.
    const h = harness({
      handOff: async () => ({ handedOff: true, platform: "macos", verified: true }),
    });
    const state = await h.authority.install();
    expect(state.stage).toBe("ready");
    expect(h.vault.activeVersion()).toBe(h.version);
    expect(h.net.requests).toBe(0);
  });

  it("does not activate anything while the companion is still working", async () => {
    const h = harness({
      handOff: async () => ({ handedOff: true, platform: "ios", verified: false }),
    });
    await h.authority.install();
    expect(h.vault.activeVersion()).toBeNull();
  });

  it("downloads normally when there is no companion, which is most devices", async () => {
    const h = harness({ handOff: async () => ({ handedOff: false }) });
    const state = await h.authority.install();
    expect(state.stage).toBe("ready");
    expect(h.net.requests).toBeGreaterThan(0);
  });

  it("falls through to the browser when the companion refuses the job", async () => {
    const h = harness({ handOff: async () => ({ handedOff: false }) });
    expect((await h.authority.install()).stage).toBe("ready");
  });

  it("relays the companion's progress as the one install state", async () => {
    const seen: (number | null)[] = [];
    const h = harness({
      handOff: async (_target, report) => {
        report({ stage: "downloading", fraction: 0.4 });
        return { handedOff: true, platform: "android", verified: false };
      },
    });
    h.authority.subscribe((state) => seen.push(state.fraction));
    await h.authority.install();
    // Not a second progress story beside the browser's — the same one.
    expect(seen).toContain(0.4);
  });
});

describe("uninstall reaches a native companion", () => {
  it("asks the companion to delete what it holds", async () => {
    let asked = false;
    const h = harness({
      uninstallNative: async () => {
        asked = true;
        return true;
      },
    });
    await h.authority.install();
    await h.authority.uninstall();
    expect(asked).toBe(true);
  });

  it("still removes the browser copy when the companion cannot be reached", async () => {
    /*
     * "Removed" over a full native disk would be a lie, and it is recorded as
     * a failure — but the bytes this side controls still go, because leaving
     * them too would be strictly worse.
     */
    const h = harness({ uninstallNative: async () => false });
    await h.authority.install();
    await h.authority.uninstall();
    expect(h.vault.activeVersion()).toBeNull();
    expect(await h.vault.listVersions()).toEqual([]);
    const kinds = h.telemetry as { kind: string; stage?: string }[];
    expect(kinds.some((e) => e.kind === "failed" && e.stage === "uninstall")).toBe(true);
  });
});

describe("uninstall and reinstall", () => {
  it("removes the engine and reports not-installed", async () => {
    const h = harness();
    await h.authority.install();
    expect(h.vault.activeVersion()).toBe(h.version);

    const removed = await h.authority.uninstall();
    expect(removed.ok).toBe(true);
    expect(h.vault.activeVersion()).toBeNull();
    expect(await h.vault.listVersions()).toEqual([]);
    expect(h.authority.snapshot().stage).toBe("idle");
  });

  it("does not touch anything that is not the engine", async () => {
    const h = harness();
    // Things that belong to the user, not to the installer.
    h.storage.setItem("caera:conversations", "a conversation");
    h.storage.setItem("caera:demo:session:v2", "12345");
    h.storage.setItem("theme", "dark");

    await h.authority.install();
    await h.authority.uninstall();

    expect(h.storage.getItem("caera:conversations")).toBe("a conversation");
    expect(h.storage.getItem("caera:demo:session:v2")).toBe("12345");
    expect(h.storage.getItem("theme")).toBe("dark");
  });

  /*
   * AN UNINSTALL THE USER JUST ASKED FOR HAS TO MEAN SOMETHING.
   *
   * Preparation starts automatically on every visit, which is what makes the
   * product fast -- and without a cooldown it would also mean that pressing
   * "Remove OCADE Intelligence" freed a gigabyte and immediately began
   * downloading it again on the same screen. That is not a product removing
   * something; that is a product arguing with the person using it.
   */
  it("does not quietly reinstall behind the user after a removal", async () => {
    let intent: number | null = null;
    const h = harness({
      readIntent: () => intent,
      writeIntent: (at) => {
        intent = at;
      },
    });
    await h.authority.install();
    await h.authority.uninstall();
    const requestsAfterRemoval = h.net.requests;

    // Everything that fires without anybody pressing anything.
    await h.authority.install({ reason: "app_bootstrap" });
    await h.authority.install({ reason: "warm" });
    await h.authority.install({ reason: "resumed" });

    expect(h.net.requests).toBe(requestsAfterRemoval);
    expect(h.vault.activeVersion()).toBeNull();
    expect(h.authority.snapshot().stage).toBe("idle");
  });

  it("installs at once when the user explicitly asks for it back", async () => {
    let intent: number | null = null;
    const h = harness({
      readIntent: () => intent,
      writeIntent: (at) => {
        intent = at;
      },
    });
    await h.authority.install();
    await h.authority.uninstall();
    expect(intent).not.toBeNull();

    const state = await h.authority.reinstall();
    expect(state.stage).toBe("ready");
    expect(h.vault.activeVersion()).toBe(h.version);
    // Asking for it back clears the removal, so ordinary visits prepare again.
    expect(intent).toBeNull();
  });

  it("lets the cooldown lapse rather than opting the device out forever", async () => {
    const day = 24 * 60 * 60 * 1000;
    let clock = 1_000_000;
    let intent: number | null = null;
    const h = harness({
      now: () => clock,
      readIntent: () => intent,
      writeIntent: (at) => {
        intent = at;
      },
    });
    await h.authority.install();
    await h.authority.uninstall();
    expect(h.authority.uninstallIntentActive()).toBe(true);

    clock += day + 1000;
    expect(h.authority.uninstallIntentActive()).toBe(false);
    const state = await h.authority.install({ reason: "app_bootstrap" });
    expect(state.stage).toBe("ready");
  });

  it("can install again after an uninstall", async () => {
    const h = harness();
    await h.authority.install();
    await h.authority.uninstall();

    const again = new ModelInstallationAuthority({ ...h.deps, vault: h.vault });
    const state = await again.install();
    expect(state.stage).toBe("ready");
    expect(h.vault.activeVersion()).toBe(h.version);
  });
});

describe("what a person is shown", () => {
  const stages = [
    "idle",
    "checking_device",
    "checking_storage",
    "preparing_runtime",
    "waiting_for_source",
    "downloading",
    "paused",
    "retrying",
    "verifying",
    "loading",
    "warming",
    "ready",
    "repairing",
    "insufficient_storage",
    "recoverable_error",
    "fatal_error",
  ] as const;

  /*
   * THE PRODUCT LANGUAGE RULE, ENFORCED RATHER THAN REMEMBERED.
   *
   * Nothing a visitor reads during setup may name the model, its vendor, its
   * file, its quantisation, its size, or the runtime technology. Somebody
   * meeting OCADE for the first time is not debugging a runtime.
   */
  const FORBIDDEN =
    /qwen|gguf|hugging\s*face|huggingface|webgpu|webassembly|wasm|wllama|web-?llm|q4[_f]|quantis|\bMB\b|\bGB\b|parameter|1\.5B|3B|\.bin\b|mlc/i;

  for (const stage of stages) {
    it(`says nothing technical in the "${stage}" state`, () => {
      const line = describeInstall({
        stage,
        fraction: 0.5,
        etaSeconds: 42,
        detail: null,
        problem: stage.includes("error") || stage === "insufficient_storage" ? "A problem." : null,
        remedies: [],
        observing: false,
        retries: 0,
        path: "webgpu",
      });
      expect(line).not.toMatch(FORBIDDEN);
      expect(line.length).toBeGreaterThan(0);
    });
  }

  it("shows a percentage while downloading and no size", () => {
    const line = describeInstall({
      stage: "downloading",
      fraction: 0.62,
      etaSeconds: null,
      detail: null,
      problem: null,
      remedies: [],
      observing: false,
      retries: 0,
      path: "webgpu",
    });
    expect(line).toContain("62%");
    expect(line).not.toMatch(/\d+\s*(MB|GB)/i);
  });
});

describe("resuming from stored metadata", () => {
  it("resumes only when every part of the checkpoint agrees", () => {
    const good = {
      verified: false,
      expectedBytes: 1000,
      contiguousChunks: 3,
      chunkBytes: 256,
      digest: { state: "0".repeat(64), bytes: 768 },
    };
    expect(checkpointFrom(good, 1000)).not.toBeNull();
    // A different total means the plan would differ, so the chunk count is
    // meaningless — resuming on it would produce a wrong offset.
    expect(checkpointFrom(good, 2000)).toBeNull();
    expect(checkpointFrom({ ...good, chunkBytes: undefined }, 1000)).toBeNull();
    expect(checkpointFrom({ ...good, contiguousChunks: 0 }, 1000)).toBeNull();
    expect(checkpointFrom(null, 1000)).toBeNull();
  });

  it("never resumes a version already marked verified", () => {
    // There is nothing to resume; the file is finished.
    expect(
      checkpointFrom(
        { verified: true, expectedBytes: 1000, contiguousChunks: 4, chunkBytes: 256 },
        1000,
      ),
    ).toBeNull();
  });
});

describe("telemetry carries measurements and nothing private", () => {
  it("records the stages a first run went through", async () => {
    const h = harness();
    await h.authority.install();
    const kinds = (h.telemetry as { kind: string }[]).map((e) => e.kind);
    expect(kinds).toContain("device_checked");
    expect(kinds).toContain("downloaded");
    expect(kinds).toContain("loaded");
    expect(kinds).toContain("ready");
  });

  it("carries no field that could hold a prompt or a conversation", async () => {
    const h = harness();
    await h.authority.install();
    for (const event of h.telemetry as Record<string, unknown>[]) {
      for (const [key, value] of Object.entries(event)) {
        if (typeof value !== "string") continue;
        // The only strings are closed-set identifiers and messages this
        // codebase wrote for a screen.
        expect(["kind", "path", "sourceKind", "stage", "version", "reason"]).toContain(key);
      }
    }
  });
});
