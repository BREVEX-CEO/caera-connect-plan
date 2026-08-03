import { describe, it, expect, vi } from "vitest";
import {
  checkDisk,
  pullModel,
  verifyInstalled,
  removeModel,
  activateModel,
  planRepair,
  planRollback,
  DISK_MARGIN,
} from "../local/model-lifecycle";

/** Build a fetch that streams NDJSON lines like the runtime's pull endpoint. */
function ndjsonFetch(lines: unknown[], status = 200) {
  return vi.fn(async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        for (const l of lines) c.enqueue(enc.encode(JSON.stringify(l) + "\n"));
        c.close();
      },
    });
    return new Response(body, { status });
  }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
}
const jsonFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as (
    input: string,
    init?: RequestInit,
  ) => Promise<Response>;

describe("checkDisk", () => {
  it("requires margin above the raw model size", () => {
    const d = checkDisk(1_000_000_000, 1_050_000_000);
    expect(d.needBytes).toBe(Math.round(1_000_000_000 * DISK_MARGIN));
    expect(d.sufficient).toBe(false);
    expect(d.reason).toMatch(/free disk/);
  });

  it("passes when there is room", () => {
    expect(checkDisk(1_000_000_000, 100_000_000_000).sufficient).toBe(true);
  });

  it("does not treat unknown free space as a full disk", () => {
    expect(checkDisk(1e9, 0).sufficient).toBe(true);
    expect(checkDisk(1e9, Number.NaN).sufficient).toBe(true);
  });
});

describe("pullModel", () => {
  it("reports streaming progress with a percentage", async () => {
    const seen: number[] = [];
    const res = await pullModel("http://127.0.0.1:11434", "tiny:1b", {
      fetchImpl: ndjsonFetch([
        { status: "pulling manifest" },
        { status: "downloading", completed: 50, total: 100, digest: "sha256:abc" },
        { status: "downloading", completed: 100, total: 100, digest: "sha256:abc" },
        { status: "success" },
      ]),
      onProgress: (p) => p.percent !== null && seen.push(p.percent),
    });
    expect(res.ok).toBe(true);
    expect(seen).toEqual([50, 100]);
    if (res.ok) expect(res.lastStatus).toBe("success");
  });

  it("REFUSES before downloading when the disk cannot hold the model", async () => {
    const fetchImpl = vi.fn();
    const res = await pullModel("http://127.0.0.1:11434", "big:70b", {
      expectedBytes: 40_000_000_000,
      freeStorageBytes: 1_000_000_000,
      fetchImpl: fetchImpl as never,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("insufficient_disk");
    // The point of a pre-flight check: the network was never touched.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces a runtime error from the stream rather than reporting success", async () => {
    const res = await pullModel("http://127.0.0.1:11434", "nope:1b", {
      fetchImpl: ndjsonFetch([{ status: "pulling" }, { error: "model 'nope:1b' not found" }]),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure).toBe("runtime_error");
      expect(res.reason).toMatch(/not found/);
    }
  });

  it("reports cancellation as resumable, not as failure", async () => {
    const abortingFetch = (async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const res = await pullModel("http://127.0.0.1:11434", "tiny:1b", { fetchImpl: abortingFetch });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure).toBe("cancelled");
      expect(res.reason).toMatch(/resumed/i);
    }
  });

  it("reports an unreachable engine distinctly from a runtime error", async () => {
    const dead = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const res = await pullModel("http://127.0.0.1:11434", "tiny:1b", { fetchImpl: dead });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("unreachable");
  });
});

describe("verifyInstalled", () => {
  it("catches a pull that claimed success but installed nothing", async () => {
    const res = await verifyInstalled(
      "http://127.0.0.1:11434",
      "ghost:1b",
      jsonFetch({ models: [{ name: "other:1b", size: 1 }] }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failure).toBe("not_installed");
      expect(res.reason).toMatch(/reported success but the model is not present/);
    }
  });

  it("reports a missing digest as UNVERIFIED, never as verified", async () => {
    const res = await verifyInstalled(
      "http://127.0.0.1:11434",
      "tiny:1b",
      jsonFetch({ models: [{ name: "tiny:1b", size: 100 }] }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.digest).toBeNull();
      expect(res.digestVerified).toBe(false);
    }
  });

  it("reports a present digest as verified", async () => {
    const res = await verifyInstalled(
      "http://127.0.0.1:11434",
      "tiny:1b",
      jsonFetch({ models: [{ name: "tiny:1b", size: 100, digest: "sha256:beef" }] }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.digestVerified).toBe(true);
  });
});

describe("removeModel", () => {
  it("removes an installed model", async () => {
    const res = await removeModel("http://127.0.0.1:11434", "tiny:1b", jsonFetch({}, 200));
    expect(res.ok).toBe(true);
  });

  it("distinguishes 'not installed' from a real failure", async () => {
    const missing = await removeModel("http://127.0.0.1:11434", "tiny:1b", jsonFetch({}, 404));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.failure).toBe("not_installed");

    const broken = await removeModel("http://127.0.0.1:11434", "tiny:1b", jsonFetch({}, 500));
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.failure).toBe("runtime_error");
  });
});

describe("activateModel — downloaded is not ready", () => {
  const ok = {
    runInference: async () => ({ ok: true, text: "OCADE_READY" }),
    runCancellable: async () => ({ cancelled: true }),
  };

  it("reports ready only after inference AND cancellation both pass", async () => {
    const res = await activateModel("tiny:1b", ok);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.inferenceOk).toBe(true);
      expect(res.cancellationOk).toBe(true);
    }
  });

  it("refuses a model that installed but cannot answer", async () => {
    const res = await activateModel("tiny:1b", {
      ...ok,
      runInference: async () => ({ ok: false, text: "" }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("inference_failed");
  });

  it("refuses a model that answers but ignores cancellation", async () => {
    // A model that cannot be stopped will hang the user with no way out, so it
    // is refused even though it demonstrably works.
    const res = await activateModel("tiny:1b", {
      ...ok,
      runCancellable: async () => ({ cancelled: false }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("cancellation_not_honoured");
  });

  it("treats a throwing inference as failure, not as success", async () => {
    const res = await activateModel("tiny:1b", {
      ...ok,
      runInference: async () => {
        throw new Error("boom");
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("inference_failed");
  });
});

describe("planRepair", () => {
  const baseInput = {
    runtimeReachable: true,
    modelInstalled: true,
    modelId: "tiny:1b",
    lastInferenceOk: true,
    freeStorageBytes: 100e9,
    modelBytes: 1e9,
  };

  it("starts the runtime when it is not running", () => {
    expect(planRepair({ ...baseInput, runtimeReachable: false }).kind).toBe("start_runtime");
  });

  it("reinstalls a missing model", () => {
    expect(planRepair({ ...baseInput, modelInstalled: false }).kind).toBe("reinstall");
  });

  it("asks for disk instead of a doomed reinstall", () => {
    const a = planRepair({ ...baseInput, modelInstalled: false, freeStorageBytes: 1e6 });
    expect(a.kind).toBe("free_disk");
  });

  it("reinstalls a model that is present but cannot answer", () => {
    const a = planRepair({ ...baseInput, lastInferenceOk: false });
    expect(a.kind).toBe("reinstall");
    if (a.kind === "reinstall") expect(a.why).toMatch(/damaged/);
  });

  it("does nothing when healthy", () => {
    expect(planRepair(baseInput).kind).toBe("none");
  });
});

describe("planRollback", () => {
  it("rolls back to a previous model that is still installed", () => {
    const p = planRollback({
      failedModelId: "new:2b",
      previousModelId: "old:1b",
      installedModelIds: ["old:1b", "new:2b"],
    });
    expect(p.target).toBe("old:1b");
  });

  it("refuses to roll back to something no longer installed", () => {
    // Rolling back to an absent model would leave the user with no engine.
    const p = planRollback({
      failedModelId: "new:2b",
      previousModelId: "old:1b",
      installedModelIds: ["new:2b"],
    });
    expect(p.target).toBeNull();
    expect(p.reason).toMatch(/no longer installed/);
  });

  it("says so when there is nothing to roll back to", () => {
    const p = planRollback({
      failedModelId: "new:2b",
      previousModelId: null,
      installedModelIds: ["new:2b"],
    });
    expect(p.target).toBeNull();
  });
});
