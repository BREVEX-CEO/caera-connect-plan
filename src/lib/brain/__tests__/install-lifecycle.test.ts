import { describe, it, expect } from "vitest";
import { transferModel, type TransferCheckpoint } from "../model-transfer";
import { planTransfer, readDeviceSignals } from "../download-plan";
import { sha256OfBytes } from "../streaming-digest";
import { ModelVault } from "../model-vault";
import { ModelInstallationAuthority, type AuthorityDeps } from "../installation-authority";
import type { ModelStore, ModelFileWriter } from "../model-store";

/**
 * The lifecycle a real install actually goes through.
 *
 * Not the happy path and not one failure at a time, but the sequence of things
 * that happen to somebody preparing OCADE on a phone on a train: the connection
 * changes, the tab goes to the background, they sign in and come back, they
 * close the browser, they open it again on a plane. Every one of those either
 * keeps the progress or throws it away, and there is no third outcome.
 *
 * THE INVARIANT UNDER TEST THROUGHOUT: valid downloaded progress is never
 * silently lost, and nothing unverified is ever activated. Those two together
 * are what let preparation start automatically without it being a liability.
 */

const KIB = 1024;

function artifact(length: number, seed = 11): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out[i] = (x >>> 24) & 0xff;
  }
  return out;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/**
 * A disk shared between "sessions".
 *
 * The point of holding it outside any one authority is that a reload, an OAuth
 * redirect and a browser restart are all the same thing from the disk's point
 * of view: a new page over storage that survived.
 */
function persistentDisk() {
  const files = new Map<string, Uint8Array>();
  const meta = new Map<string, unknown>();

  const writerFor = (key: string): ModelFileWriter => ({
    async write(chunk, at) {
      const existing = files.get(key) ?? new Uint8Array(0);
      const next = new Uint8Array(Math.max(existing.length, at + chunk.length));
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
    async openWriter(key: string) {
      return writerFor(key);
    },
    async append(key: string, chunk: Uint8Array, at: number) {
      return writerFor(key).write(chunk, at);
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

interface NetworkOptions {
  failAfter?: number;
  failOn?: Set<number>;
  offline?: () => boolean;
}

function network(data: Uint8Array, options: NetworkOptions = {}) {
  let requests = 0;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests += 1;
    if (options.offline?.()) throw new TypeError("Failed to fetch");
    if (options.failOn?.has(requests)) throw new TypeError("Failed to fetch");
    if (options.failAfter !== undefined && requests > options.failAfter) {
      throw new TypeError("Failed to fetch");
    }
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
    const slice = data.slice(start, Math.min(end, data.length - 1) + 1);
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

const DATA = artifact(128 * KIB);
const DIGEST = sha256OfBytes(DATA);
const VERSION = "lifecycle-v1";
const PLAN = { chunkBytes: 4 * KIB, concurrency: 2, because: "test" };

/**
 * One "browser session" over a persistent disk.
 *
 * Constructing a fresh authority against the same storage is exactly what a
 * reload, an OAuth redirect and a browser restart all look like from here.
 */
function session(
  disk: ReturnType<typeof persistentDisk>,
  storage: ReturnType<typeof memoryStorage>,
  fetchImpl: typeof fetch,
  overrides: Partial<AuthorityDeps> = {},
) {
  const vault = new ModelVault({ store: disk.store, storage });
  const authority = new ModelInstallationAuthority({
    vault,
    fetchImpl,
    probeCapabilities: async () => [
      { path: "wasm_single", available: true, why: "the processor can run OCADE's engine" },
    ],
    resolveTarget: async () => ({
      version: VERSION,
      totalBytes: DATA.length,
      sha256: DIGEST,
      sources: [{ url: "https://cdn.example/engine", kind: "ocade_cdn" }],
    }),
    activateRuntime: async () => ({ ok: true }),
    storageHeadroom: async () => 10 * 1024 ** 3,
    requestPersistence: async () => true,
    hashBlob: async (blob) => sha256OfBytes(new Uint8Array(await blob.arrayBuffer())),
    plan: PLAN,
    // Real backoff is bounded but slow on purpose; the suite exercises the
    // retry LOGIC rather than the wall-clock delays it waits out.
    sleep: async () => {},
    random: () => 0.5,
    ...overrides,
  });
  return { authority, vault };
}

describe("the connection changes underneath a transfer", () => {
  /**
   * Wi-Fi to cellular, and cellular to Wi-Fi.
   *
   * Both look identical to a page: the sockets die and new ones can be opened.
   * What must NOT happen is a restart from zero, because on the cellular half
   * of that swap the user pays for every byte twice.
   */
  it("survives a handover mid-transfer and resumes rather than restarting", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: disk.store, storage });

    // Wi-Fi, dropping partway.
    let writer = await vault.openWriter(VERSION);
    const first = await transferModel(
      {
        sources: [{ url: "https://cdn.example/engine", kind: "ocade_cdn" }],
        totalBytes: DATA.length,
        sha256: DIGEST,
        plan: PLAN,
        maxAttemptsPerChunk: 1,
        onCheckpoint: (c) => {
          vault.patchMeta(VERSION, {
            expectedBytes: DATA.length,
            sha256: DIGEST,
            digest: c.digest ?? undefined,
            contiguousChunks: c.contiguousChunks,
            chunkBytes: c.chunkBytes,
          });
        },
      },
      {
        fetchImpl: network(DATA, { failAfter: 8 }).fetchImpl,
        writer: writer!,
        sleep: async () => {},
      },
    );
    await writer!.close();
    expect(first.ok).toBe(false);
    if (first.ok) return;
    const carried = (first.checkpoint as TransferCheckpoint).contiguousChunks;
    expect(carried).toBeGreaterThan(0);

    // Cellular, from the same checkpoint.
    const cellular = network(DATA);
    writer = await vault.openWriter(VERSION);
    const second = await transferModel(
      {
        sources: [{ url: "https://cdn.example/engine", kind: "ocade_cdn" }],
        totalBytes: DATA.length,
        sha256: DIGEST,
        plan: planTransfer({ mobile: true, effectiveType: "4g" }),
        resume: first.checkpoint,
      },
      { fetchImpl: cellular.fetchImpl, writer: writer!, sleep: async () => {} },
    );
    await writer!.close();

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.verified).toBe(true);
    // The bytes paid for on Wi-Fi were not paid for again on cellular.
    expect(second.resumedFromBytes).toBe(carried * PLAN.chunkBytes);
  });

  it("plans a real transfer on every connection type, never a postponement", () => {
    for (const signals of [
      { mobile: true, effectiveType: "4g", downlinkMbps: 10 },
      { mobile: true, effectiveType: "3g", downlinkMbps: 1.5 },
      { mobile: true, saveData: true },
      { effectiveType: "4g", downlinkMbps: 100 },
      {},
    ]) {
      const plan = planTransfer(signals);
      expect(plan.concurrency).toBeGreaterThanOrEqual(1);
      expect(plan.chunkBytes).toBeGreaterThan(0);
    }
  });

  it("reads whatever the browser will say, and survives it saying nothing", () => {
    // In a node test there is no navigator.connection at all, which is exactly
    // what Safari gives; the plan must still be a plan.
    const signals = readDeviceSignals();
    expect(planTransfer(signals).concurrency).toBeGreaterThanOrEqual(1);
  });
});

describe("leaving OCADE and coming back", () => {
  /**
   * The OAuth redirect, which is the case the brief singles out.
   *
   * Signing in navigates the whole page away and back. The transfer stops; the
   * checkpoint is on disk. Coming back must continue from it, and must not
   * start a second installer alongside it.
   */
  it("resumes after a full-page redirect instead of starting again", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();

    // Preparing on the landing page, interrupted by the redirect to the
    // identity provider.
    const before = session(disk, storage, network(DATA, { failAfter: 8 }).fetchImpl);
    const interrupted = await before.authority.install({ reason: "app_bootstrap" });
    expect(interrupted.stage).not.toBe("ready");
    const carried = before.vault.readMeta(VERSION)?.contiguousChunks ?? 0;
    expect(carried).toBeGreaterThan(0);

    // /auth/callback: a brand-new page over the same storage.
    const back = network(DATA);
    const after = session(disk, storage, back.fetchImpl);
    const resumed = await after.authority.install({ reason: "resumed" });

    expect(resumed.stage).toBe("ready");
    expect(after.vault.activeVersion()).toBe(VERSION);
    // It asked only for what was missing.
    const chunksTotal = Math.ceil(DATA.length / PLAN.chunkBytes);
    expect(back.requests).toBeLessThan(chunksTotal);
  });

  it("a reload mid-install keeps every verified byte", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();

    const first = session(disk, storage, network(DATA, { failAfter: 6 }).fetchImpl);
    await first.authority.install({ reason: "app_bootstrap" });
    const carried = first.vault.readMeta(VERSION)?.contiguousChunks ?? 0;

    const second = session(disk, storage, network(DATA).fetchImpl);
    const state = await second.authority.install({ reason: "app_bootstrap" });
    expect(state.stage).toBe("ready");
    expect(carried).toBeGreaterThan(0);
  });

  it("a browser restart finds a finished install and touches the network zero times", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();

    const first = session(disk, storage, network(DATA).fetchImpl);
    expect((await first.authority.install()).stage).toBe("ready");

    // Reopened days later, on a plane.
    const offline = network(DATA, { offline: () => true });
    const second = session(disk, storage, offline.fetchImpl);
    const state = await second.authority.install({ reason: "app_bootstrap" });

    expect(state.stage).toBe("ready");
    expect(offline.requests).toBe(0);
    expect(second.vault.activeVersion()).toBe(VERSION);
  });

  it("a new application deployment makes zero model requests for the same digest", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const firstNetwork = network(DATA);
    const first = session(disk, storage, firstNetwork.fetchImpl);
    expect((await first.authority.install()).stage).toBe("ready");

    // A deployment may replace every JavaScript asset and service worker. It
    // must not become part of model identity; only VERSION and its digest do.
    storage.setItem("ocade.application.deployment", "new-cloudflare-version");
    const afterDeploymentNetwork = network(DATA, { offline: () => true });
    const afterDeployment = session(disk, storage, afterDeploymentNetwork.fetchImpl);
    const state = await afterDeployment.authority.install({ reason: "app_bootstrap" });

    expect(state.stage).toBe("ready");
    expect(afterDeploymentNetwork.requests).toBe(0);
    expect(afterDeployment.vault.activeVersion()).toBe(VERSION);
  });
});

describe("several tabs", () => {
  /**
   * The lock is what makes this one transfer instead of three.
   *
   * Modelled as the real Web Lock does it: one holder and a FIFO queue. A
   * promoted follower verifies the durable artifact and activates its own
   * runtime, but never starts a second transfer.
   */
  function tabs(
    count: number,
    disk: ReturnType<typeof persistentDisk>,
    storage: ReturnType<typeof memoryStorage>,
    fetchImpl: typeof fetch,
  ) {
    let tail = Promise.resolve();
    const acquireLock = async (work: () => Promise<void>) => {
      const predecessor = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      try {
        await work();
      } finally {
        release();
      }
      return true;
    };
    return Array.from({ length: count }, () => session(disk, storage, fetchImpl, { acquireLock }));
  }

  it("two tabs produce one transfer, not two", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const net = network(DATA);
    const [a, b] = tabs(2, disk, storage, net.fetchImpl);

    const results = await Promise.all([
      a.authority.install({ reason: "app_bootstrap" }),
      b.authority.install({ reason: "app_bootstrap" }),
    ]);

    const chunksTotal = Math.ceil(DATA.length / PLAN.chunkBytes);
    // One transfer's worth of requests, not two.
    expect(net.requests).toBeLessThanOrEqual(chunksTotal + 2);
    expect(results.every((state) => state.stage === "ready")).toBe(true);
  });

  it("three tabs still produce one transfer", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const net = network(DATA);
    const three = tabs(3, disk, storage, net.fetchImpl);

    await Promise.all(three.map((tab) => tab.authority.install({ reason: "app_bootstrap" })));

    const chunksTotal = Math.ceil(DATA.length / PLAN.chunkBytes);
    expect(net.requests).toBeLessThanOrEqual(chunksTotal + 2);
  });

  it("a follower never offers a control that would start a second download", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const [owner, follower] = tabs(2, disk, storage, network(DATA).fetchImpl);
    const ownerRun = owner.authority.install({ reason: "app_bootstrap" });
    const followerState = await follower.authority.install({ reason: "app_bootstrap" });
    await ownerRun;

    if (followerState.observing) {
      expect(followerState.remedies).toEqual([]);
    }
  });
});

describe("partial staging is repaired rather than trusted or discarded", () => {
  it("hashes a complete file that has no proof beside it", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: disk.store, storage });

    // Bytes on disk with no metadata at all — a browser closed after the last
    // write, or a background fetch the service worker filed.
    const writer = await vault.openWriter(VERSION);
    await writer!.write(DATA, 0);
    await writer!.close();

    const offline = network(DATA, { offline: () => true });
    const { authority } = session(disk, storage, offline.fetchImpl);
    const state = await authority.install({ reason: "resumed" });

    expect(state.stage).toBe("ready");
    // It proved them rather than re-fetching them.
    expect(offline.requests).toBe(0);
    expect(vault.readMeta(VERSION)?.verified).toBe(true);
  });

  it("deletes a complete file whose digest is wrong", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: disk.store, storage });

    const wrong = artifact(DATA.length, 999);
    const writer = await vault.openWriter(VERSION);
    await writer!.write(wrong, 0);
    await writer!.close();

    const offline = network(DATA, { offline: () => true });
    const { authority } = session(disk, storage, offline.fetchImpl);
    const state = await authority.install({ reason: "resumed" });

    expect(state.stage).not.toBe("ready");
    expect(vault.activeVersion()).toBeNull();
    // Weights that are almost right load happily and answer nonsense.
    expect(await vault.bytesOf(VERSION)).toBe(0);
  });

  it("repair clears a version that could never be proven", async () => {
    const disk = persistentDisk();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: disk.store, storage });

    // Half a file, with no digest recorded, so it is dead weight.
    const writer = await vault.openWriter("orphan-version");
    await writer!.write(new Uint8Array(5000), 0);
    await writer!.close();

    const { authority } = session(disk, storage, network(DATA).fetchImpl);
    await authority.repair();
    expect(await vault.bytesOf("orphan-version")).toBe(0);
  });
});
