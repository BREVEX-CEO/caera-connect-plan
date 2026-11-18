/**
 * Offline Mode setup lifecycle, driven through the real installation authority with an in-memory
 * store and a scripted delivery server: nothing starts until the person asks; an accepted setup
 * transfers, checks the whole digest and activates only after the engine starts; a wrong digest,
 * a failed engine start or too little space never reports ready; an interrupted transfer resumes;
 * a verified setup works with no network; removal withdraws acceptance so nothing sets itself up
 * again. Every line the person can read is free of "download", sizes and technical names.
 *
 * The authority is bundled with esbuild (already a dependency) because its relative imports have
 * no file extensions, which Node's type stripping cannot resolve on its own.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

type Module = typeof import("../../src/lib/brain/installation-authority.ts");
type StateModule = typeof import("../../src/lib/brain/installation-state.ts");
type VaultModule = typeof import("../../src/lib/brain/model-vault.ts");

let authorityModule: Module;
let stateModule: StateModule;
let vaultModule: VaultModule;
let workDir: string;

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "ocade-install-"));
  const root = path.resolve(import.meta.dirname, "../../src/lib/brain");
  const outfile = path.join(workDir, "bundle.mjs");
  await build({
    stdin: {
      contents: [
        'export * as authority from "./installation-authority";',
        'export * as state from "./installation-state";',
        'export * as vault from "./model-vault";',
      ].join("\n"),
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  const bundle = await import(pathToFileURL(outfile).href);
  authorityModule = bundle.authority;
  stateModule = bundle.state;
  vaultModule = bundle.vault;
});

after(() => rmSync(workDir, { recursive: true, force: true }));

/** An in-memory stand-in for the OPFS store, with the same contract. */
class MemoryStore {
  files = new Map<string, Uint8Array>();
  async requestPersistence() {
    return true;
  }
  async sizeOf(key: string) {
    return this.files.get(key)?.length ?? 0;
  }
  async openWriter(key: string) {
    const files = this.files;
    return {
      async write(chunk: Uint8Array, at: number) {
        const current = files.get(key) ?? new Uint8Array(0);
        const next = new Uint8Array(Math.max(current.length, at + chunk.length));
        next.set(current);
        next.set(chunk, at);
        files.set(key, next);
        return true;
      },
      async flush() {
        return true;
      },
      async close() {},
    };
  }
  async writeFile(key: string, bytes: Uint8Array) {
    this.files.set(key, bytes.slice());
    return true;
  }
  async readBlob(key: string) {
    const bytes = this.files.get(key);
    return bytes ? new Blob([bytes]) : null;
  }
  async remove(key: string) {
    this.files.delete(key);
    return true;
  }
  async list() {
    return [...this.files.entries()].map(([key, bytes]) => ({ key, bytes: bytes.length }));
  }
}

const ARTIFACT = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 7 + 3) % 251);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A delivery server that speaks Range, can fail a number of requests, or serve wrong bytes. */
function delivery(options: { failFirst?: number; corrupt?: boolean } = {}) {
  let failures = options.failFirst ?? 0;
  const served = options.corrupt ? ARTIFACT.map((b) => b ^ 1) : ARTIFACT;
  const calls = { count: 0 };
  const fetchImpl = (async (_input: unknown, init?: RequestInit) => {
    calls.count += 1;
    if (failures > 0) {
      failures -= 1;
      throw new TypeError("network dropped");
    }
    const range = new Headers(init?.headers).get("range");
    const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (!match) return new Response(served, { status: 200 });
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), served.length - 1) : served.length - 1;
    return new Response(served.slice(start, end + 1), {
      status: 206,
      headers: {
        "content-range": `bytes ${start}-${end}/${served.length}`,
        "content-length": String(end - start + 1),
      },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function makeAuthority(
  options: {
    fetchImpl?: typeof fetch;
    online?: boolean;
    headroom?: number | null;
    engineStarts?: boolean;
    store?: MemoryStore;
    accepted?: { at: number | null };
  } = {},
) {
  const store = options.store ?? new MemoryStore();
  const accepted = options.accepted ?? { at: null };
  const activations: string[] = [];
  const authority = new authorityModule.ModelInstallationAuthority({
    vault: new vaultModule.ModelVault({ store: store as never, legacy: null }),
    fetchImpl: options.fetchImpl ?? delivery().fetchImpl,
    probeCapabilities: async () => [{ path: "wasm_single", available: true, why: "test" }],
    resolveTarget: async () =>
      options.online === false
        ? "unreachable"
        : {
            version: "ocr-0000000000000001",
            totalBytes: ARTIFACT.length,
            sha256: sha(ARTIFACT),
            sources: [
              { url: "https://ocade.test/api/offline/bytes/ocr-0000000000000001", kind: "ocade" },
            ],
          },
    activateRuntime: async (_path, version) => {
      activations.push(version);
      return options.engineStarts === false
        ? { ok: false, reason: "Offline Mode could not start on this device." }
        : { ok: true };
    },
    storageHeadroom: async () => (options.headroom === undefined ? null : options.headroom),
    requestPersistence: async () => true,
    hashBlob: async (blob) => sha(new Uint8Array(await blob.arrayBuffer())),
    sleep: async () => {},
    random: () => 0.5,
    readIntent: () => accepted.at,
    writeIntent: (at) => {
      accepted.at = at;
    },
  });
  return { authority, store, accepted, activations };
}

/** What the person could read about a state. */
function customerText(state: { stage: string; problem: string | null; detail: string | null }) {
  return stateModule.describeInstall(state as never);
}

function assertPlainLanguage(text: string) {
  assert.doesNotMatch(
    text,
    /download|\b\d+(\.\d+)?\s?(k|m|g)?b\b|byte|gguf|model|weights|wasm|webgpu/i,
    text,
  );
}

test("automatic triggers never start a setup nobody asked for", async () => {
  const server = delivery();
  const { authority, accepted } = makeAuthority({ fetchImpl: server.fetchImpl });
  const state = await authority.install({ reason: "app_bootstrap" });
  assert.equal(state.stage, "idle");
  assert.equal(server.calls.count, 0);
  assert.equal(accepted.at, null);
  assert.equal(customerText(state), "Offline Mode is not set up");
});

test("an accepted setup transfers, verifies the whole digest and is ready only after the engine starts", async () => {
  const server = delivery();
  const { authority, accepted, activations } = makeAuthority({ fetchImpl: server.fetchImpl });
  const state = await authority.reinstall();
  assert.equal(state.stage, "ready", state.problem ?? "");
  assert.ok(accepted.at, "acceptance recorded");
  assert.ok(server.calls.count > 0);
  assert.deepEqual(activations, ["ocr-0000000000000001"]);
  assert.equal(customerText(state), "Offline Chat is ready");
  // Later automatic checks resume an accepted setup.
  assert.equal((await authority.install({ reason: "resumed" })).stage, "ready");
});

test("wrong bytes are never activated", async () => {
  const { authority, activations } = makeAuthority({
    fetchImpl: delivery({ corrupt: true }).fetchImpl,
  });
  const state = await authority.reinstall();
  assert.notEqual(state.stage, "ready");
  assert.deepEqual(activations, []);
  assertPlainLanguage(customerText(state));
});

test("an engine that cannot start on this device is not reported ready", async () => {
  const { authority } = makeAuthority({ engineStarts: false });
  const state = await authority.reinstall();
  assert.notEqual(state.stage, "ready");
  assertPlainLanguage(customerText(state));
});

test("too little space stops before transferring and says so plainly", async () => {
  const server = delivery();
  const { authority } = makeAuthority({ fetchImpl: server.fetchImpl, headroom: 1_000 });
  const state = await authority.reinstall();
  assert.equal(state.stage, "insufficient_storage");
  assert.equal(server.calls.count, 0);
  assert.equal(customerText(state), "Not enough free space to set up Offline Mode.");
});

test("an interrupted transfer recovers and finishes", async () => {
  const { authority } = makeAuthority({ fetchImpl: delivery({ failFirst: 2 }).fetchImpl });
  const state = await authority.reinstall();
  assert.equal(state.stage, "ready", state.problem ?? "");
});

test("a verified setup starts with no network, and with nothing set up says so plainly", async () => {
  const store = new MemoryStore();
  const accepted = { at: null as number | null };
  assert.equal((await makeAuthority({ store, accepted }).authority.reinstall()).stage, "ready");
  const offline = makeAuthority({ store, accepted, online: false });
  assert.equal((await offline.authority.install({ reason: "app_bootstrap" })).stage, "ready");

  const fresh = makeAuthority({ online: false, accepted: { at: 1 } });
  const state = await fresh.authority.install({ reason: "app_bootstrap" });
  assert.equal(state.stage, "recoverable_error");
  assertPlainLanguage(customerText(state));
});

test("removal withdraws acceptance, empties the store, and nothing sets itself up again", async () => {
  const server = delivery();
  const { authority, accepted, store } = makeAuthority({ fetchImpl: server.fetchImpl });
  assert.equal((await authority.reinstall()).stage, "ready");
  const removed = await authority.uninstall();
  assert.equal(removed.ok, true);
  assert.equal(accepted.at, null);
  assert.equal(
    store.files.size === 0 || [...store.files.keys()].every((k) => !/ocr-/.test(k)),
    true,
  );
  const before = server.calls.count;
  const state = await authority.install({ reason: "app_bootstrap" });
  assert.equal(state.stage, "idle");
  assert.equal(server.calls.count, before);
  assert.equal(customerText(state), stateModule.REMOVED_DETAIL);
});

test("every stage's customer line avoids download words, sizes and technical names", () => {
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
  ];
  for (const stage of stages) {
    for (const fraction of [null, 0.42]) {
      assertPlainLanguage(customerText({ stage, problem: null, detail: null, fraction } as never));
    }
  }
});
