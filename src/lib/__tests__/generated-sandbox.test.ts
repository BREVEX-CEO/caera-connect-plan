import { describe, expect, it } from "vitest";
import {
  acceptGeneratedSandboxResult,
  runGeneratedSandbox,
  validateGeneratedSandboxRequest,
  type GeneratedSandboxRequest,
  type GeneratedSandboxHost,
} from "../code/generated-sandbox";
import { createNodePermissionSandboxHost } from "../code/generated-sandbox-node";

function request(overrides: Partial<GeneratedSandboxRequest> = {}): GeneratedSandboxRequest {
  return {
    taskId: "phase-23",
    language: "javascript",
    script:
      'const input = await sandbox.readText("source.txt"); await sandbox.writeText("result.txt", input.toUpperCase()); sandbox.log("done");',
    inputs: [{ path: "source.txt", content: "safe input" }],
    outputs: [{ path: "result.txt", mediaType: "text/plain", maxBytes: 10_000 }],
    allowedImports: [],
    network: "disabled",
    limits: {
      wallTimeMs: 5_000,
      cpuTimeMs: 5_000,
      memoryMb: 64,
      storageBytes: 100_000,
      outputBytes: 20_000,
    },
    ...overrides,
  };
}

describe("generated sandbox admission", () => {
  it("rejects path escape, duplicate scopes, undeclared imports and unapproved network", () => {
    expect(
      validateGeneratedSandboxRequest(
        request({ inputs: [{ path: "../secret.txt", content: "no" }] }),
      ),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("escapes") });
    expect(
      validateGeneratedSandboxRequest(
        request({
          inputs: [{ path: "same.txt", content: "a" }],
          outputs: [{ path: "same.txt", mediaType: "text/plain", maxBytes: 100 }],
        }),
      ),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("more than once") });
    expect(
      validateGeneratedSandboxRequest(request({ script: 'import fs from "node:fs";' })),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("node:fs") });
    expect(validateGeneratedSandboxRequest(request({ network: "approved" }))).toMatchObject({
      ok: false,
      reason: expect.stringContaining("approval"),
    });
  });

  it("refuses unsupported Python instead of launching an unrestricted interpreter", async () => {
    const result = await runGeneratedSandbox(
      request({ language: "python", script: 'print("hello")' }),
      createNodePermissionSandboxHost(),
    );
    expect(result).toEqual({
      ok: false,
      reason: "node-permission-vm does not provide a secure python isolation boundary.",
    });
  });
});

describe("real Node permission sandbox", () => {
  it("executes through the bounded API, validates output, previews the diff and accepts artifacts", async () => {
    const source = request({
      sensitiveValues: ["private-value"],
      script:
        'const input = await sandbox.readText("source.txt"); await sandbox.writeText("result.txt", input + " private-value"); sandbox.log("private-value");',
    });
    const result = await runGeneratedSandbox(source, createNodePermissionSandboxHost());
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("verified");
    expect(result.data?.observation.outputs[0].content).toBe("safe input [REDACTED]");
    expect(result.data?.observation.stdout).not.toContain("private-value");
    expect(result.data?.diffs).toEqual([
      { path: "result.txt", before: "", after: "safe input private-value", changed: true },
    ]);
    const accepted = acceptGeneratedSandboxResult(source, result.data!);
    expect(accepted.ok).toBe(true);
    expect(accepted.data?.map((artifact) => artifact.name)).toEqual([
      "generated-phase-23.mjs",
      "generated-phase-23-receipt.json",
      "result.txt",
    ]);
    expect(JSON.stringify(accepted.data)).not.toContain("private-value");
  });

  it("cannot traverse to an undeclared output or access process, require, fetch, or eval", async () => {
    for (const script of [
      'await sandbox.writeText("../escaped.txt", "escape");',
      'await sandbox.writeText("undeclared.txt", "escape");',
      'sandbox.log(typeof process); if (typeof process !== "undefined") throw new Error("process exposed");',
      'sandbox.log(typeof require); if (typeof require !== "undefined") throw new Error("require exposed");',
      'sandbox.log(typeof fetch); if (typeof fetch !== "undefined") throw new Error("fetch exposed");',
      'eval("1 + 1");',
    ]) {
      const result = await runGeneratedSandbox(
        request({ script }),
        createNodePermissionSandboxHost(),
      );
      expect(result.ok).toBe(true);
      if (script.includes("typeof")) {
        expect(result.data?.status).toBe("verified");
      } else {
        expect(result.data?.status).toBe("failed");
      }
      expect(result.data?.observation.temporaryRootRemoved).toBe(true);
      expect(result.data?.observation.processTreeTerminated).toBe(true);
      expect(result.data?.observation.outputs).toEqual([]);
    }
  }, 20_000);

  it("kills a running script after cancellation and proves exit and cleanup", async () => {
    const controller = new AbortController();
    const pending = runGeneratedSandbox(
      request({
        script: "await sandbox.sleep(60_000);",
        limits: {
          wallTimeMs: 60_000,
          cpuTimeMs: 60_000,
          memoryMb: 64,
          storageBytes: 100_000,
          outputBytes: 20_000,
        },
      }),
      createNodePermissionSandboxHost(),
      controller.signal,
    );
    setTimeout(() => controller.abort(), 100);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("cancelled");
    expect(result.data?.receipt.verified).toBe(false);
    expect(result.data?.observation).toMatchObject({
      cancelled: true,
      processExitObserved: true,
      processTreeTerminated: true,
      temporaryRootRemoved: true,
    });
  });

  it("fails closed when a host omits any isolation or cleanup proof", async () => {
    const real = createNodePermissionSandboxHost();
    const dishonest: GeneratedSandboxHost = {
      ...real,
      id: "dishonest",
      async run(value, signal) {
        const observation = await real.run(value, signal);
        return { ...observation, hostId: "dishonest", temporaryRootRemoved: false };
      },
    };
    const result = await runGeneratedSandbox(request(), dishonest);
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringContaining("cleanup was not proven"),
    });
  });
});
