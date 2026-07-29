import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExecutorRegistry,
  runPlannedStep,
  describeRunnable,
  type ExecutionResult,
} from "../skills/executor-registry";
import { planStep } from "../skills/work-session";
import { createTaskScope } from "../skills/task-scope";
import { readTextFile, type FileSystemLike } from "../skills/packs/local-files-pack";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "../skills/skill-pack";
import type { AdapterHealth } from "../skills/adapter-health";

const NOW = new Date("2026-07-23T10:00:00Z");

const readCapability: SkillCapability = {
  id: "files.read",
  label: "Read a text file",
  methods: ["file"],
  mutating: false,
  verifyBy: "file",
  tested: true,
};

const app: AppIdentity = {
  appId: "ocade.files.local",
  displayName: "Local files",
  version: "1.0",
};

const pack: SkillPack = {
  appId: "ocade.files.local",
  displayName: "Local files",
  category: "os_utilities",
  testedVersions: ["1."],
  capabilities: [readCapability],
  requiresLicensedInstall: false,
};

function makePlan(capability = readCapability) {
  const r = planStep({
    action: { kind: "file.open", path: "C:/anywhere/x.txt" },
    capability,
    app,
    packs: [pack],
    scope: createTaskScope({
      id: "t",
      summary: "Read a file",
      capabilities: ["file.open"],
      paths: ["C:/anywhere"],
      now: NOW,
    }),
    health: new Map<ControlMethod, AdapterHealth>(),
    availableMethods: ["file"],
    recording: "video_off",
    now: NOW,
  });
  if (r.status !== "ready") throw new Error(`plan failed: ${r.status}`);
  return r.plan;
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

/**
 * The gap this registry closes: a step could be fully planned with nothing
 * wired up to perform it. Silently doing nothing and reporting success is worse
 * than failing.
 */
describe("a capability with no executor is refused, never simulated", () => {
  it("returns `unavailable` and says so plainly", async () => {
    const r = await runPlannedStep(new ExecutorRegistry(), makePlan(), NOW);
    expect(r.status).toBe("unavailable");
    if (r.status !== "unavailable") throw new Error("unreachable");
    expect(r.reason).toMatch(/nothing wired up/i);
    expect(r.reason).toMatch(/hasn't pretended to/i);
  });

  it("produces NO receipt, because nothing happened", async () => {
    const r = await runPlannedStep(new ExecutorRegistry(), makePlan(), NOW);
    expect(r).not.toHaveProperty("receipt");
  });

  it("reports honestly how many actions can actually run", () => {
    const registry = new ExecutorRegistry();
    const caps = [
      { appId: "ocade.files.local", capability: readCapability },
      { appId: "adobe.photoshop", capability: { ...readCapability, id: "export" } },
    ];
    expect(describeRunnable(registry, caps)).toMatch(/can't perform any of these/i);

    registry.register("ocade.files.local", "files.read", async () => ({
      ok: true,
      evidence: "x",
    }));
    expect(describeRunnable(registry, caps)).toBe(
      "1 of 2 actions can run here. The rest need software or a component that isn't installed.",
    );
  });
});

/** End-to-end against the REAL filesystem, through the real pack. */
describe("a wired capability runs and produces a receipt", () => {
  it("executes for real and confirms the result", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ocade-exec-"));
    try {
      await writeFile(join(dir, "x.txt"), "real content", "utf8");

      const realFs: FileSystemLike = {
        realpath: (p) => fsp.realpath(p),
        stat: async (p) => {
          const s = await fsp.stat(p);
          return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
        },
        readFile: (p) => fsp.readFile(p, "utf8"),
        writeFile: (p, d) => fsp.writeFile(p, d, "utf8"),
        readdir: (p) => fsp.readdir(p),
        mkdir: (p) => fsp.mkdir(p).then(() => undefined),
        rename: (a, b) => fsp.rename(a, b),
        unlink: (p) => fsp.unlink(p),
      };

      const registry = new ExecutorRegistry();
      registry.register(
        "ocade.files.local",
        "files.read",
        async (): Promise<ExecutionResult> => {
          const out = await readTextFile(realFs, dir, join(dir, "x.txt"));
          return out.ok
            ? { ok: true, evidence: out.evidence, data: out.data }
            : { ok: false, evidence: out.reason };
        },
        async (_plan, execution) => {
          const observed = await readFile(join(dir, "x.txt"), "utf8");
          return {
            verified: observed === execution.data,
            evidence:
              observed === execution.data
                ? "Independent file read matched the executor output."
                : "Independent file read did not match the executor output.",
          };
        },
      );

      const r = await runPlannedStep(registry, makePlan(), NOW);
      expect(r.status).toBe("done");
      if (r.status !== "done") throw new Error("unreachable");
      expect(r.data).toBe("real content");
      expect(r.receipt.verified).toBe(true);
      expect(r.receipt.evidence).not.toMatch(/NOT CONFIRMED/);
      // Confirmed independently.
      expect(await readFile(join(dir, "x.txt"), "utf8")).toBe("real content");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("records a failure with an unconfirmed receipt", async () => {
    const registry = new ExecutorRegistry();
    registry.register("ocade.files.local", "files.read", async () => ({
      ok: false,
      evidence: "the file was locked",
    }));

    const r = await runPlannedStep(registry, makePlan(), NOW);
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.reason).toBe("the file was locked");
    expect(r.receipt.verified).toBe(false);
    expect(r.receipt.evidence).toMatch(/^NOT CONFIRMED:/);
  });

  it("turns a thrown error into an honest failure, not a crash", async () => {
    const registry = new ExecutorRegistry();
    registry.register("ocade.files.local", "files.read", async () => {
      throw new Error("adapter exploded");
    });

    const r = await runPlannedStep(registry, makePlan(), NOW);
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.reason).toContain("adapter exploded");
    expect(r.receipt.verified).toBe(false);
  });
});

/**
 * The rule that makes receipts worth anything: an executor cannot certify its
 * own work when the capability has no way to be checked.
 */
describe("an executor cannot mark its own homework", () => {
  it("refuses a forged plan whose execution method is not declared", async () => {
    const registry = new ExecutorRegistry();
    const executor = vi.fn(async () => ({ ok: true, evidence: "should not run" }));
    registry.register("ocade.files.local", "files.read", executor, () => ({
      verified: true,
      evidence: "should not verify",
    }));
    const forged = { ...makePlan(), method: "vision_input" as const };

    const r = await runPlannedStep(registry, forged, NOW);
    expect(r.status).toBe("unavailable");
    if (r.status !== "unavailable") throw new Error("unreachable");
    expect(r.reason).toMatch(/invalid plan/i);
    expect(executor).not.toHaveBeenCalled();
  });

  it("refuses a forged ready plan below the confidence threshold", async () => {
    const registry = new ExecutorRegistry();
    const executor = vi.fn(async () => ({ ok: true, evidence: "should not run" }));
    registry.register("ocade.files.local", "files.read", executor, () => ({
      verified: true,
      evidence: "should not verify",
    }));

    const r = await runPlannedStep(registry, { ...makePlan(), confidence: 0.01 }, NOW);
    expect(r.status).toBe("unavailable");
    if (r.status !== "unavailable") throw new Error("unreachable");
    expect(r.reason).toMatch(/invalid plan/i);
    expect(executor).not.toHaveBeenCalled();
  });

  it("refuses verified completion when a capability cannot be verified", async () => {
    const unverifiable = { ...readCapability, verifyBy: "none" as const };
    const registry = new ExecutorRegistry();
    registry.register(
      "ocade.files.local",
      "files.read",
      async () => ({ ok: true, evidence: "the executor says it worked" }),
      () => ({ verified: true, evidence: "a verifier claimed success" }),
    );

    const r = await runPlannedStep(registry, { ...makePlan(), capability: unverifiable }, NOW);
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.receipt.verified).toBe(false);
    expect(r.receipt.evidence).toMatch(/no independent verification method/i);
  });

  it("does not invoke a verifier after execution itself fails", async () => {
    const registry = new ExecutorRegistry();
    const verifier = vi.fn(() => ({ verified: true, evidence: "should not run" }));
    registry.register(
      "ocade.files.local",
      "files.read",
      async () => ({ ok: false, evidence: "execution failed" }),
      verifier,
    );

    const r = await runPlannedStep(registry, makePlan(), NOW);
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.receipt.verified).toBe(false);
    expect(verifier).not.toHaveBeenCalled();
  });

  it("fails closed when a successful executor has no independent verifier", async () => {
    const registry = new ExecutorRegistry();
    registry.register("ocade.files.local", "files.read", async () => ({
      ok: true,
      evidence: "executor output",
      data: "content",
    }));

    const r = await runPlannedStep(registry, makePlan(), NOW);
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.reason).toMatch(/no independent verifier/i);
    expect(r.receipt.verified).toBe(false);
  });

  it("fails closed when independent verification disagrees", async () => {
    const registry = new ExecutorRegistry();
    registry.register(
      "ocade.files.local",
      "files.read",
      async () => ({ ok: true, evidence: "executor output", data: "content" }),
      () => ({ verified: false, evidence: "Observed different content." }),
    );

    const r = await runPlannedStep(registry, makePlan(), NOW);
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    expect(r.reason).toBe("Observed different content.");
    expect(r.receipt.verified).toBe(false);
  });
});

describe("the registry itself", () => {
  it("reports what is runnable", () => {
    const r = new ExecutorRegistry();
    expect(r.runnable()).toEqual([]);
    r.register("a", "one", async () => ({ ok: true, evidence: "" }));
    r.register("b", "two", async () => ({ ok: true, evidence: "" }));
    expect(r.runnable()).toEqual(["a:one", "b:two"]);
  });

  it("replaces rather than shadows a re-registered executor", async () => {
    const r = new ExecutorRegistry();
    r.register("a", "one", async () => ({ ok: true, evidence: "first" }));
    r.register("a", "one", async () => ({ ok: true, evidence: "second" }));
    expect(r.runnable()).toHaveLength(1);
    const fn = r.get("a", "one")!;
    expect((await fn({} as never)).evidence).toBe("second");
  });

  it("distinguishes capabilities with the same id on different apps", () => {
    const r = new ExecutorRegistry();
    r.register("app.a", "read", async () => ({ ok: true, evidence: "" }));
    expect(r.has("app.a", "read")).toBe(true);
    expect(r.has("app.b", "read")).toBe(false);
  });

  it("rejects ambiguous ids before they can collide in the registry key", () => {
    const r = new ExecutorRegistry();
    expect(() => r.register("app:a", "read", async () => ({ ok: true, evidence: "" }))).toThrow(
      /safe identifiers/i,
    );
    expect(() => r.register("app", "a:read", async () => ({ ok: true, evidence: "" }))).toThrow(
      /safe identifiers/i,
    );
    expect(r.runnable()).toEqual([]);
  });
});
