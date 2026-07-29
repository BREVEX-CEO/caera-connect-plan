import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BLENDER_ROUTE_ORDER,
  CREATIVE_RUNTIME_BOUNDARY,
  runCreativeWorkflow,
  selectCreativeRoute,
  validateCreativePlan,
  type CreativeAdapterHost,
  type CreativeAdapterStatus,
  type CreativeExecutionObservation,
  type CreativeOutput,
  type CreativePlan,
  type CreativeRoute,
  type CreativeSceneObservation,
} from "../creative/creative-workflow";
import { exportGltf, serialiseGltf } from "../vision3d/gltf";
import { buildBox } from "../vision3d/mesh";
import type { Scene } from "../vision3d/scene";

const CHECKPOINT_SHA = "a".repeat(64);
const PROJECT_SHA = "b".repeat(64);
const REAL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function gltfBytes(): Uint8Array {
  const box = buildBox(1, 1, 1);
  if (!box.ok) throw new Error(box.reason);
  const scene: Scene = {
    name: "Phase 30 fixture",
    objects: [{ name: "Cube", mesh: box.data, material: "Clay" }],
    materials: [{ name: "Clay", baseColor: [0.4, 0.3, 0.2], metallic: 0, roughness: 0.6 }],
    lights: [{ name: "Key", kind: "area", intensity: 100, color: [1, 1, 1] }],
  };
  const exported = exportGltf(scene);
  if (!exported.ok) throw new Error(exported.reason);
  return new TextEncoder().encode(serialiseGltf(exported.data));
}

function output(name: string, bytes: Uint8Array, mediaType: string): CreativeOutput {
  return {
    name,
    bytes,
    mediaType,
    sha256: sha256(bytes),
    byteLength: bytes.byteLength,
  };
}

function capability(
  route: CreativeRoute,
  overrides: Partial<CreativeAdapterStatus["routes"][number]> = {},
): CreativeAdapterStatus["routes"][number] {
  return {
    route,
    available: true,
    approved: true,
    confidence: 0.99,
    supportsMutation: true,
    supportsIndependentVerification: true,
    supportsRecovery: true,
    evidence: `${route} deterministic adapter evidence`,
    ...overrides,
  };
}

function status(overrides: Partial<CreativeAdapterStatus> = {}): CreativeAdapterStatus {
  return {
    appId: "blender",
    product: "Blender",
    version: "4.3.2",
    installed: true,
    executable: "C:/Program Files/Blender Foundation/Blender/blender.exe",
    publisher: "Blender Foundation",
    signatureVerified: true,
    renderEngines: ["BLENDER_EEVEE_NEXT", "CYCLES"],
    routes: BLENDER_ROUTE_ORDER.map((route) => capability(route)),
    evidence: "Executable identity, version and engines were deterministically probed.",
    ...overrides,
  };
}

function plan(overrides: Partial<CreativePlan> = {}): CreativePlan {
  return {
    runId: "creative-run-30",
    appId: "blender",
    project: {
      projectId: "scene-project",
      path: "projects/phase-30/scene.blend",
      format: "blend",
    },
    script: "import bpy\nbpy.ops.mesh.primitive_cube_add()\n",
    expectedScene: { minObjects: 2, requireLight: true, requireCamera: true },
    outputs: [
      { name: "renders/final.png", kind: "render_image", maxBytes: 1024, minWidth: 1 },
      { name: "exports/final.gltf", kind: "gltf", maxBytes: 1024 * 1024 },
    ],
    resources: {
      job: {
        kind: "render",
        workUnits: 100,
        bytesPerUnit: 1024,
        msPerUnit: 10,
        outputBytes: 1024 * 1024,
        fixedMemoryBytes: 1024 * 1024,
      },
      hardware: {
        totalRamBytes: 16 * 1024 ** 3,
        availableRamBytes: 8 * 1024 ** 3,
        freeStorageBytes: 100 * 1024 ** 3,
        hasGpu: true,
        thermalState: "nominal",
      },
    },
    timeoutMs: 60_000,
    confirmed: true,
    ...overrides,
  };
}

class FixtureHost implements CreativeAdapterHost {
  calls: string[] = [];
  adapterStatus = status();
  checkpointVerified = true;
  restored = true;
  throwAt: "execute" | "inspect" | null = null;
  execution: CreativeExecutionObservation = {
    route: "python_api",
    isolated: true,
    networkDenied: true,
    readScopeEnforced: true,
    writeScopeEnforced: true,
    processTreeTerminated: true,
    exitCode: 0,
    cancelled: false,
    timedOut: false,
    stdout: "Saved scene.blend; rendered final.png; exported final.gltf",
    stderr: "",
    outputNames: ["renders/final.png", "exports/final.gltf"],
    startedAt: "2026-07-26T08:00:00.000Z",
    finishedAt: "2026-07-26T08:00:02.000Z",
    evidence: "Bounded fixture process exited zero and its process tree terminated.",
  };
  scene: CreativeSceneObservation = {
    projectSha256: PROJECT_SHA,
    objects: 2,
    materials: 2,
    lights: 1,
    cameras: 1,
    missingGeometry: [],
    invalidModifiers: [],
    logErrors: [],
    evidence: "Reloaded project contained two objects, light, camera and no logged errors.",
  };
  outputs = new Map<string, CreativeOutput>([
    ["renders/final.png", output("renders/final.png", REAL_PNG, "image/png")],
    ["exports/final.gltf", output("exports/final.gltf", gltfBytes(), "model/gltf+json")],
  ]);

  async probe() {
    this.calls.push("probe");
    return this.adapterStatus;
  }

  async checkpoint(project: CreativePlan["project"]) {
    this.calls.push("checkpoint");
    return {
      checkpointId: "checkpoint-30",
      projectId: project.projectId,
      sha256: CHECKPOINT_SHA,
      byteLength: 4096,
      createdAt: "2026-07-26T07:59:59.000Z",
      evidence: "Versioned .blend checkpoint bytes were persisted.",
    };
  }

  async verifyCheckpoint() {
    this.calls.push("verifyCheckpoint");
    return {
      verified: this.checkpointVerified,
      evidence: this.checkpointVerified
        ? "Checkpoint bytes matched their SHA-256."
        : "Checkpoint digest did not match.",
    };
  }

  async execute(input: Parameters<CreativeAdapterHost["execute"]>[0]) {
    this.calls.push(`execute:${input.route}`);
    if (this.throwAt === "execute") throw new Error("fixture process launch failed");
    return { ...this.execution, route: input.route };
  }

  async inspectProject() {
    this.calls.push("inspectProject");
    if (this.throwAt === "inspect") throw new Error("fixture project could not be reopened");
    return this.scene;
  }

  async readOutput(name: string) {
    this.calls.push(`readOutput:${name}`);
    return this.outputs.get(name) ?? null;
  }

  async restore() {
    this.calls.push("restore");
    return {
      restored: this.restored,
      projectSha256: this.restored ? CHECKPOINT_SHA : PROJECT_SHA,
      evidence: this.restored ? "Checkpoint restored." : "Restore failed.",
    };
  }
}

describe("creative plan admission and Blender routing", () => {
  it("normalises safe paths and rejects traversal, duplicate outputs and missing confirmation", () => {
    const admitted = validateCreativePlan(
      plan({
        project: { projectId: "scene-project", path: "projects\\scene.blend", format: "blend" },
      }),
    );
    expect(admitted.ok && admitted.data.project.path).toBe("projects/scene.blend");
    expect(
      validateCreativePlan(
        plan({
          project: { projectId: "scene-project", path: "../secret.blend", format: "blend" },
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateCreativePlan(
        plan({
          outputs: [
            { name: "same.png", kind: "render_image", maxBytes: 100 },
            { name: "./same.png", kind: "render_image", maxBytes: 100 },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(validateCreativePlan(plan({ confirmed: false })).ok).toBe(false);
  });

  it("uses the exact API to CLI to plugin preference and never mutates through vision alone", () => {
    const python = selectCreativeRoute(status());
    expect(python.ok).toBe(true);
    expect(python.ok && python.data.route).toBe("python_api");
    const withoutPython = status({
      routes: BLENDER_ROUTE_ORDER.map((route) =>
        capability(route, { available: route !== "python_api" }),
      ),
    });
    const cli = selectCreativeRoute(withoutPython);
    expect(cli.ok && cli.data.route).toBe("cli");
    const visionOnly = status({
      routes: [capability("vision_input")],
    });
    expect(selectCreativeRoute(visionOnly).ok).toBe(false);
  });

  it("requires signed installed application identity and explicit bpy source", async () => {
    expect(selectCreativeRoute(status({ signatureVerified: false })).ok).toBe(false);
    const host = new FixtureHost();
    const result = await runCreativeWorkflow(host, plan({ script: "print('not bpy')" }));
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/requires an explicit bpy import/i);
    expect(host.calls).toEqual(["probe"]);
  });
});

describe("checkpointed creative execution", () => {
  it("verifies a complete deterministic scene, render and glTF export without claiming a live app", async () => {
    const host = new FixtureHost();
    const result = await runCreativeWorkflow(host, plan(), {
      now: new Date("2026-07-26T08:00:03.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({
      status: "completed_verified",
      route: "python_api",
      appVersion: "4.3.2",
      recovery: { attempted: false, verified: true },
    });
    expect(result.receipt.outputs).toHaveLength(2);
    expect(result.receipt.outputs.every((item) => item.verified)).toBe(true);
    expect(result.receipt.evidence.join(" ")).toMatch(/script SHA-256/i);
    expect(host.calls).not.toContain("restore");
    expect(CREATIVE_RUNTIME_BOUNDARY).toMatch(/no installed Blender/i);
  });

  it("does not checkpoint or execute when the resource governor defers the job", async () => {
    const host = new FixtureHost();
    const deferred = plan({
      resources: {
        ...plan().resources,
        hardware: { ...plan().resources.hardware, thermalState: "critical" },
      },
    });
    const result = await runCreativeWorkflow(host, deferred);
    expect(result.ok).toBe(false);
    expect(result.receipt.resourceDecision?.action).toBe("defer");
    expect(host.calls).toEqual(["probe"]);
  });

  it("does not execute when checkpoint bytes cannot be independently verified", async () => {
    const host = new FixtureHost();
    host.checkpointVerified = false;
    const result = await runCreativeWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(host.calls).toEqual(["probe", "checkpoint", "verifyCheckpoint"]);
  });

  it("restores when process isolation, exit or output acknowledgements are incomplete", async () => {
    const host = new FixtureHost();
    host.execution.networkDenied = false;
    const result = await runCreativeWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(result.receipt.recovery).toMatchObject({ attempted: true, verified: true });
    expect(host.calls.at(-1)).toBe("restore");
  });

  it("restores when scene structure or application logs fail inspection", async () => {
    const host = new FixtureHost();
    host.scene = { ...host.scene, cameras: 0, logErrors: ["Cycles device unavailable"] };
    const result = await runCreativeWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/structural or log checks/i);
    expect(result.receipt.recovery.verified).toBe(true);
  });

  it("restores when render bytes change or an export is not conforming glTF", async () => {
    const host = new FixtureHost();
    const png = host.outputs.get("renders/final.png")!;
    host.outputs.set("renders/final.png", { ...png, sha256: "c".repeat(64) });
    const changed = await runCreativeWorkflow(host, plan());
    expect(changed.ok).toBe(false);
    expect(changed.receipt.evidence.join(" ")).toMatch(/changed before verification/i);
    expect(changed.receipt.recovery.verified).toBe(true);

    const invalidHost = new FixtureHost();
    const invalid = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    invalidHost.outputs.set(
      "exports/final.gltf",
      output("exports/final.gltf", invalid, "model/gltf+json"),
    );
    const badExport = await runCreativeWorkflow(invalidHost, plan());
    expect(badExport.ok).toBe(false);
    expect(badExport.receipt.evidence.join(" ")).toMatch(/gltf/i);
    expect(badExport.receipt.recovery.verified).toBe(true);
  });

  it("recovers from host exceptions after checkpoint creation", async () => {
    const host = new FixtureHost();
    host.throwAt = "inspect";
    const result = await runCreativeWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/could not be reopened/i);
    expect(result.receipt.recovery).toMatchObject({ attempted: true, verified: true });
  });

  it("cancels before probing without touching the application", async () => {
    const host = new FixtureHost();
    const controller = new AbortController();
    controller.abort();
    const result = await runCreativeWorkflow(host, plan(), { signal: controller.signal });
    expect(result.ok).toBe(false);
    expect(result.receipt.status).toBe("cancelled");
    expect(host.calls).toEqual([]);
  });
});
