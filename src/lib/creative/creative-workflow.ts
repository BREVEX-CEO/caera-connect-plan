/**
 * Creative application control (Stage 2, Phase 30).
 *
 * The workflow is host-neutral, but Blender is the reference adapter. It
 * prefers Blender Python, background CLI, an approved plug-in, project-file
 * inspection, accessibility, then vision/input. Every mutation starts from a
 * byte-verified project checkpoint; scripts execute only inside a bounded host;
 * scene, render and export results are independently inspected; failure
 * restores and re-verifies the checkpoint.
 */
import { inspectMedia, type MediaInspection } from "../media/inspect";
import {
  governResources,
  type HardwareSnapshot,
  type JobSpec,
  type Recommendation,
} from "../skills/resource-governor";
import { validateGltf } from "../vision3d/gltf";

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_SCRIPT_CHARS = 1_000_000;
const MAX_OUTPUTS = 20;
const MAX_OUTPUT_BYTES = 250 * 1024 * 1024;

export type CreativeRoute =
  "python_api" | "cli" | "plugin" | "project_file" | "accessibility" | "vision_input";

export const BLENDER_ROUTE_ORDER: readonly CreativeRoute[] = [
  "python_api",
  "cli",
  "plugin",
  "project_file",
  "accessibility",
  "vision_input",
];

export interface CreativeRouteCapability {
  route: CreativeRoute;
  available: boolean;
  approved: boolean;
  confidence: number;
  supportsMutation: boolean;
  supportsIndependentVerification: boolean;
  supportsRecovery: boolean;
  evidence: string;
}

export interface CreativeAdapterStatus {
  appId: string;
  product: string;
  version: string;
  installed: boolean;
  executable: string;
  publisher: string;
  signatureVerified: boolean;
  renderEngines: string[];
  routes: CreativeRouteCapability[];
  evidence: string;
}

export interface CreativeProjectRef {
  projectId: string;
  path: string;
  format: "blend" | "gltf" | "generic";
}

export interface CreativeCheckpoint {
  checkpointId: string;
  projectId: string;
  sha256: string;
  byteLength: number;
  createdAt: string;
  evidence: string;
}

export interface CreativeSceneObservation {
  projectSha256: string;
  objects: number;
  materials: number;
  lights: number;
  cameras: number;
  missingGeometry: string[];
  invalidModifiers: string[];
  logErrors: string[];
  evidence: string;
}

export interface CreativeOutput {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
  sha256: string;
  byteLength: number;
}

export interface CreativeExecutionObservation {
  route: CreativeRoute;
  isolated: boolean;
  networkDenied: boolean;
  readScopeEnforced: boolean;
  writeScopeEnforced: boolean;
  processTreeTerminated: boolean;
  exitCode: number;
  cancelled: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  outputNames: string[];
  startedAt: string;
  finishedAt: string;
  evidence: string;
}

export interface CreativeAdapterHost {
  probe(signal?: AbortSignal): Promise<CreativeAdapterStatus>;
  checkpoint(project: CreativeProjectRef, signal?: AbortSignal): Promise<CreativeCheckpoint>;
  verifyCheckpoint(
    checkpoint: CreativeCheckpoint,
    signal?: AbortSignal,
  ): Promise<{ verified: boolean; evidence: string }>;
  execute(
    input: {
      project: CreativeProjectRef;
      route: CreativeRoute;
      script: string;
      expectedOutputs: string[];
      timeoutMs: number;
    },
    signal?: AbortSignal,
  ): Promise<CreativeExecutionObservation>;
  inspectProject(
    project: CreativeProjectRef,
    signal?: AbortSignal,
  ): Promise<CreativeSceneObservation>;
  readOutput(name: string, signal?: AbortSignal): Promise<CreativeOutput | null>;
  restore(
    project: CreativeProjectRef,
    checkpoint: CreativeCheckpoint,
    signal?: AbortSignal,
  ): Promise<{ restored: boolean; projectSha256: string; evidence: string }>;
}

export interface CreativeOutputSpec {
  name: string;
  kind: "render_image" | "render_video" | "gltf";
  maxBytes: number;
  minWidth?: number;
  minHeight?: number;
}

export interface CreativePlan {
  runId: string;
  appId: string;
  project: CreativeProjectRef;
  script: string;
  expectedScene: {
    minObjects: number;
    requireLight: boolean;
    requireCamera: boolean;
  };
  outputs: CreativeOutputSpec[];
  resources: {
    job: JobSpec;
    hardware: HardwareSnapshot;
  };
  timeoutMs: number;
  confirmed: boolean;
}

export interface CreativeOutputReceipt {
  name: string;
  kind: CreativeOutputSpec["kind"];
  sha256: string;
  byteLength: number;
  verified: boolean;
  media?: MediaInspection;
  evidence: string;
}

export interface CreativeWorkflowReceipt {
  runId: string;
  appId: string;
  appVersion: string | null;
  route: CreativeRoute | null;
  status: "failed" | "cancelled" | "completed_unverified" | "completed_verified";
  checkpoint: CreativeCheckpoint | null;
  resourceDecision: Recommendation | null;
  scene: CreativeSceneObservation | null;
  outputs: CreativeOutputReceipt[];
  recovery: {
    attempted: boolean;
    verified: boolean;
    evidence: string;
  };
  evidence: string[];
  recordedAt: string;
}

export interface CreativeWorkflowResult {
  ok: boolean;
  receipt: CreativeWorkflowReceipt;
}

export type CreativeOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

function normaliseRelativePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, "/");
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path.startsWith("//") ||
    /^[A-Za-z]:\//.test(path)
  ) {
    return null;
  }
  const parts = path.split("/").filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return null;
  return parts.join("/");
}

async function digest(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);
  const value = await globalThis.crypto.subtle.digest("SHA-256", copied.buffer);
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validRoute(route: CreativeRouteCapability): boolean {
  return (
    BLENDER_ROUTE_ORDER.includes(route.route) &&
    typeof route.available === "boolean" &&
    typeof route.approved === "boolean" &&
    Number.isFinite(route.confidence) &&
    route.confidence >= 0 &&
    route.confidence <= 1 &&
    typeof route.supportsMutation === "boolean" &&
    typeof route.supportsIndependentVerification === "boolean" &&
    typeof route.supportsRecovery === "boolean" &&
    route.evidence.trim().length > 0
  );
}

export function validateCreativePlan(plan: CreativePlan): CreativeOutcome<CreativePlan> {
  if (!SAFE_ID.test(plan.runId) || !SAFE_ID.test(plan.appId)) {
    return { ok: false, reason: "The creative run or application id is invalid." };
  }
  if (
    !SAFE_ID.test(plan.project.projectId) ||
    !normaliseRelativePath(plan.project.path) ||
    !["blend", "gltf", "generic"].includes(plan.project.format)
  ) {
    return { ok: false, reason: "The creative project reference is unsafe or malformed." };
  }
  if (!plan.script.trim() || plan.script.length > MAX_SCRIPT_CHARS) {
    return { ok: false, reason: "The creative script is empty or exceeds the source limit." };
  }
  if (
    !Number.isInteger(plan.expectedScene.minObjects) ||
    plan.expectedScene.minObjects < 1 ||
    typeof plan.expectedScene.requireLight !== "boolean" ||
    typeof plan.expectedScene.requireCamera !== "boolean"
  ) {
    return { ok: false, reason: "The expected scene postconditions are invalid." };
  }
  if (
    !Array.isArray(plan.outputs) ||
    plan.outputs.length === 0 ||
    plan.outputs.length > MAX_OUTPUTS
  ) {
    return { ok: false, reason: "A creative run needs a bounded non-empty output list." };
  }
  const names = new Set<string>();
  for (const output of plan.outputs) {
    const path = normaliseRelativePath(output.name);
    if (
      !path ||
      names.has(path) ||
      !["render_image", "render_video", "gltf"].includes(output.kind) ||
      !Number.isSafeInteger(output.maxBytes) ||
      output.maxBytes <= 0 ||
      output.maxBytes > MAX_OUTPUT_BYTES ||
      (output.minWidth !== undefined &&
        (!Number.isInteger(output.minWidth) || output.minWidth < 1)) ||
      (output.minHeight !== undefined &&
        (!Number.isInteger(output.minHeight) || output.minHeight < 1))
    ) {
      return { ok: false, reason: "A creative output rule is unsafe, duplicate or unbounded." };
    }
    names.add(path);
  }
  if (
    !Number.isInteger(plan.timeoutMs) ||
    plan.timeoutMs < 1_000 ||
    plan.timeoutMs > 24 * 60 * 60 * 1000
  ) {
    return { ok: false, reason: "The creative execution timeout is invalid." };
  }
  if (!plan.confirmed) {
    return { ok: false, reason: "Creative project mutation needs explicit confirmation." };
  }
  return {
    ok: true,
    data: {
      ...plan,
      project: { ...plan.project, path: normaliseRelativePath(plan.project.path)! },
      outputs: plan.outputs.map((output) => ({
        ...output,
        name: normaliseRelativePath(output.name)!,
      })),
    },
    evidence: `Admitted ${plan.outputs.length} bounded creative output${plan.outputs.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Apply Blender's exact preference while retaining universal safety gates.
 * Vision/input is never admitted for a mutation because it cannot guarantee
 * project recovery or independently validate a scripted result.
 */
export function selectCreativeRoute(
  status: CreativeAdapterStatus,
): CreativeOutcome<CreativeRouteCapability> {
  if (
    !SAFE_ID.test(status.appId) ||
    !status.product.trim() ||
    !status.version.trim() ||
    !status.executable.trim() ||
    !status.publisher.trim() ||
    !Array.isArray(status.routes) ||
    status.routes.length === 0 ||
    status.routes.some((route) => !validRoute(route)) ||
    new Set(status.routes.map((route) => route.route)).size !== status.routes.length
  ) {
    return { ok: false, reason: "The creative adapter identity or route evidence is malformed." };
  }
  if (!status.installed || !status.signatureVerified) {
    return {
      ok: false,
      reason: "The creative application is not installed with a verified executable signature.",
    };
  }
  for (const routeName of BLENDER_ROUTE_ORDER) {
    const route = status.routes.find((candidate) => candidate.route === routeName);
    if (
      !route ||
      !route.available ||
      !route.approved ||
      !route.supportsMutation ||
      !route.supportsIndependentVerification ||
      !route.supportsRecovery ||
      route.confidence < 0.9
    ) {
      continue;
    }
    if (route.route === "vision_input") continue;
    return {
      ok: true,
      data: route,
      evidence: `Selected ${route.route} for ${status.product} ${status.version}. ${route.evidence}`,
    };
  }
  return {
    ok: false,
    reason:
      "No approved creative route has adequate confidence, mutation support, independent verification and recovery.",
  };
}

function baseReceipt(plan: CreativePlan, now: Date): CreativeWorkflowReceipt {
  return {
    runId: plan.runId,
    appId: plan.appId,
    appVersion: null,
    route: null,
    status: "failed",
    checkpoint: null,
    resourceDecision: null,
    scene: null,
    outputs: [],
    recovery: { attempted: false, verified: false, evidence: "No recovery was needed." },
    evidence: [],
    recordedAt: now.toISOString(),
  };
}

async function recover(
  host: CreativeAdapterHost,
  plan: CreativePlan,
  checkpoint: CreativeCheckpoint,
  signal?: AbortSignal,
): Promise<CreativeWorkflowReceipt["recovery"]> {
  try {
    const restored = await host.restore(plan.project, checkpoint, signal);
    const verified =
      restored.restored && restored.projectSha256.toLowerCase() === checkpoint.sha256;
    return {
      attempted: true,
      verified,
      evidence: verified
        ? `${restored.evidence} Restored project SHA-256 matched the checkpoint.`
        : `${restored.evidence} The restored project did not match the checkpoint digest.`,
    };
  } catch (error) {
    return {
      attempted: true,
      verified: false,
      evidence:
        error instanceof Error
          ? `Checkpoint recovery failed: ${error.message}`
          : "Checkpoint recovery failed unexpectedly.",
    };
  }
}

async function verifyOutput(
  output: CreativeOutput,
  rule: CreativeOutputSpec,
): Promise<CreativeOutcome<CreativeOutputReceipt>> {
  if (
    output.name !== rule.name ||
    output.byteLength !== output.bytes.byteLength ||
    output.byteLength <= 0 ||
    output.byteLength > rule.maxBytes ||
    !SHA256.test(output.sha256.toLowerCase())
  ) {
    return { ok: false, reason: `${rule.name} has invalid output metadata or size.` };
  }
  const actualHash = await digest(output.bytes);
  if (actualHash !== output.sha256.toLowerCase()) {
    return { ok: false, reason: `${rule.name} changed before verification.` };
  }

  if (rule.kind === "gltf") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(output.bytes));
    } catch {
      return { ok: false, reason: `${rule.name} is not valid JSON.` };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: `${rule.name} is not a glTF object.` };
    }
    const checked = validateGltf(parsed as Record<string, unknown>);
    if (!checked.ok) return { ok: false, reason: `${rule.name}: ${checked.reason}` };
    return {
      ok: true,
      data: {
        name: output.name,
        kind: rule.kind,
        sha256: actualHash,
        byteLength: output.byteLength,
        verified: true,
        evidence: `${checked.evidence} Output bytes and SHA-256 matched.`,
      },
      evidence: `${rule.name} is a conforming byte-verified glTF export.`,
    };
  }

  const inspected = inspectMedia(output.bytes, output.name);
  if (!inspected.ok) return { ok: false, reason: `${rule.name}: ${inspected.reason}` };
  if (
    (rule.kind === "render_image" && inspected.data.kind !== "image") ||
    (rule.kind === "render_video" && inspected.data.kind !== "video")
  ) {
    return { ok: false, reason: `${rule.name} is not the requested render media kind.` };
  }
  const width =
    inspected.data.kind === "image" ? inspected.data.image?.width : inspected.data.video?.width;
  const height =
    inspected.data.kind === "image" ? inspected.data.image?.height : inspected.data.video?.height;
  if (
    (rule.minWidth !== undefined && (!width || width < rule.minWidth)) ||
    (rule.minHeight !== undefined && (!height || height < rule.minHeight))
  ) {
    return { ok: false, reason: `${rule.name} is below the requested dimensions.` };
  }
  if (inspected.data.extensionMatches === false) {
    return { ok: false, reason: `${rule.name} does not match its claimed media extension.` };
  }
  return {
    ok: true,
    data: {
      name: output.name,
      kind: rule.kind,
      sha256: actualHash,
      byteLength: output.byteLength,
      verified: true,
      media: inspected.data,
      evidence: `${inspected.evidence} Output bytes and SHA-256 matched.`,
    },
    evidence: `${rule.name} is byte-verified render media.`,
  };
}

/**
 * Execute one creative plan. Host acknowledgements cannot produce success:
 * the checkpoint, scene postconditions, output bytes and output formats are all
 * independently observed after execution.
 */
export async function runCreativeWorkflow(
  host: CreativeAdapterHost,
  requestedPlan: CreativePlan,
  options: { signal?: AbortSignal; now?: Date } = {},
): Promise<CreativeWorkflowResult> {
  const now = options.now ?? new Date();
  const admitted = validateCreativePlan(requestedPlan);
  const receipt = baseReceipt(requestedPlan, now);
  if (!admitted.ok) {
    receipt.evidence.push(admitted.reason);
    return { ok: false, receipt };
  }
  const plan = admitted.data;
  if (options.signal?.aborted) {
    receipt.status = "cancelled";
    receipt.evidence.push("The creative run was cancelled before probing.");
    return { ok: false, receipt };
  }

  let status: CreativeAdapterStatus;
  try {
    status = await host.probe(options.signal);
  } catch (error) {
    receipt.evidence.push(
      error instanceof Error
        ? `Creative adapter probe failed: ${error.message}`
        : "Creative adapter probe failed.",
    );
    return { ok: false, receipt };
  }
  receipt.appVersion = status.version;
  if (status.appId !== plan.appId) {
    receipt.evidence.push("The probed creative application does not match the requested app.");
    return { ok: false, receipt };
  }
  const route = selectCreativeRoute(status);
  if (!route.ok) {
    receipt.evidence.push(route.reason);
    return { ok: false, receipt };
  }
  receipt.route = route.data.route;
  receipt.evidence.push(route.evidence);
  if (
    status.product.trim().toLowerCase() === "blender" &&
    route.data.route === "python_api" &&
    !/(?:^|\n)\s*(?:import\s+bpy\b|from\s+bpy\s+import\b)/m.test(plan.script)
  ) {
    receipt.evidence.push(
      "The selected Blender Python route requires an explicit bpy import; no project mutation was attempted.",
    );
    return { ok: false, receipt };
  }
  receipt.evidence.push(
    `Approved script SHA-256: ${await digest(new TextEncoder().encode(plan.script))}.`,
  );

  const resource = governResources(plan.resources.job, plan.resources.hardware);
  if (!resource.ok) {
    receipt.evidence.push(resource.reason);
    return { ok: false, receipt };
  }
  receipt.resourceDecision = resource.data;
  receipt.evidence.push(resource.evidence);
  if (["refuse", "defer", "downgrade"].includes(resource.data.action)) {
    return { ok: false, receipt };
  }

  let checkpoint: CreativeCheckpoint;
  try {
    checkpoint = await host.checkpoint(plan.project, options.signal);
    receipt.checkpoint = checkpoint;
    const shapeValid =
      SAFE_ID.test(checkpoint.checkpointId) &&
      checkpoint.projectId === plan.project.projectId &&
      SHA256.test(checkpoint.sha256) &&
      Number.isSafeInteger(checkpoint.byteLength) &&
      checkpoint.byteLength > 0 &&
      Number.isFinite(Date.parse(checkpoint.createdAt));
    const verified = shapeValid
      ? await host.verifyCheckpoint(checkpoint, options.signal)
      : { verified: false, evidence: "Checkpoint metadata was malformed." };
    receipt.evidence.push(checkpoint.evidence, verified.evidence);
    if (!verified.verified) return { ok: false, receipt };
  } catch (error) {
    receipt.evidence.push(
      error instanceof Error
        ? `Project checkpoint failed: ${error.message}`
        : "Project checkpoint failed.",
    );
    return { ok: false, receipt };
  }

  let execution: CreativeExecutionObservation;
  try {
    execution = await host.execute(
      {
        project: plan.project,
        route: route.data.route,
        script: plan.script,
        expectedOutputs: plan.outputs.map((output) => output.name),
        timeoutMs: plan.timeoutMs,
      },
      options.signal,
    );
  } catch (error) {
    receipt.evidence.push(
      error instanceof Error
        ? `Creative execution failed: ${error.message}`
        : "Creative execution failed.",
    );
    receipt.recovery = await recover(host, plan, checkpoint, options.signal);
    return { ok: false, receipt };
  }
  receipt.evidence.push(execution.evidence);
  const executionVerified =
    execution.route === route.data.route &&
    execution.isolated &&
    execution.networkDenied &&
    execution.readScopeEnforced &&
    execution.writeScopeEnforced &&
    execution.processTreeTerminated &&
    execution.exitCode === 0 &&
    !execution.cancelled &&
    !execution.timedOut &&
    Number.isFinite(Date.parse(execution.startedAt)) &&
    Number.isFinite(Date.parse(execution.finishedAt)) &&
    Date.parse(execution.finishedAt) >= Date.parse(execution.startedAt) &&
    plan.outputs.every((output) => execution.outputNames.includes(output.name));
  if (!executionVerified) {
    receipt.status = execution.cancelled ? "cancelled" : "failed";
    receipt.evidence.push("The creative host did not prove bounded successful execution.");
    receipt.recovery = await recover(host, plan, checkpoint, options.signal);
    return { ok: false, receipt };
  }

  try {
    const scene = await host.inspectProject(plan.project, options.signal);
    receipt.scene = scene;
    receipt.evidence.push(scene.evidence);
    const sceneVerified =
      SHA256.test(scene.projectSha256) &&
      scene.objects >= plan.expectedScene.minObjects &&
      (!plan.expectedScene.requireLight || scene.lights > 0) &&
      (!plan.expectedScene.requireCamera || scene.cameras > 0) &&
      scene.missingGeometry.length === 0 &&
      scene.invalidModifiers.length === 0 &&
      scene.logErrors.length === 0;
    if (!sceneVerified) {
      receipt.evidence.push("The post-execution scene failed its structural or log checks.");
      receipt.recovery = await recover(host, plan, checkpoint, options.signal);
      return { ok: false, receipt };
    }

    for (const rule of plan.outputs) {
      const output = await host.readOutput(rule.name, options.signal);
      if (!output) {
        receipt.evidence.push(`${rule.name} was not produced.`);
        receipt.recovery = await recover(host, plan, checkpoint, options.signal);
        return { ok: false, receipt };
      }
      const verified = await verifyOutput(output, rule);
      if (!verified.ok) {
        receipt.evidence.push(verified.reason);
        receipt.recovery = await recover(host, plan, checkpoint, options.signal);
        return { ok: false, receipt };
      }
      receipt.outputs.push(verified.data);
      receipt.evidence.push(verified.evidence);
    }
  } catch (error) {
    receipt.evidence.push(
      error instanceof Error
        ? `Creative verification failed: ${error.message}`
        : "Creative verification failed.",
    );
    receipt.recovery = await recover(host, plan, checkpoint, options.signal);
    return { ok: false, receipt };
  }

  receipt.status = "completed_verified";
  receipt.recovery = {
    attempted: false,
    verified: true,
    evidence: "No recovery was needed; the original checkpoint remains available.",
  };
  receipt.evidence.push("Scene, render and export outputs completed and independently verified.");
  return { ok: true, receipt };
}

export const CREATIVE_RUNTIME_BOUNDARY =
  "Creative control source is available, but no installed Blender or other creative application, GPU renderer, signed adapter, or live project has been validated in this environment. Controlled fixtures are not an installed-application claim.";
