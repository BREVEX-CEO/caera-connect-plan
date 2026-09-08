import { isProtectedText } from "@/lib/security/protected-text";

export type MobileMissionCommandKind =
  | "task.create"
  | "instruction.add"
  | "instruction.correct"
  | "approval.decide"
  | "run.pause"
  | "run.resume"
  | "run.cancel"
  | "emergency.stop"
  | "session.revoke"
  | "output.download";

export const MOBILE_MISSION_COMMAND_KINDS: readonly MobileMissionCommandKind[] = [
  "task.create",
  "instruction.add",
  "instruction.correct",
  "approval.decide",
  "run.pause",
  "run.resume",
  "run.cancel",
  "emergency.stop",
  "session.revoke",
  "output.download",
] as const;

export interface MobileMissionScope {
  capabilities: MobileMissionCommandKind[];
  taskIds: string[];
  applicationIds: string[];
  fileIds: string[];
}

export type MobileMissionCommandBody =
  | { kind: "task.create"; text: string }
  | { kind: "instruction.add"; taskId: string; text: string }
  | {
      kind: "instruction.correct";
      taskId: string;
      instructionId: string;
      text: string;
    }
  | {
      kind: "approval.decide";
      taskId: string;
      approvalId: string;
      decision: "approved" | "denied";
    }
  | { kind: "run.pause" | "run.resume" | "run.cancel"; taskId: string }
  | { kind: "emergency.stop" }
  | { kind: "session.revoke" }
  | { kind: "output.download"; taskId: string; outputId: string };

export interface UnsignedMobileMissionCommand {
  v: 1;
  commandId: string;
  deviceId: string;
  sessionId: string;
  target: "pc_task_only";
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  scope: MobileMissionScope;
  body: MobileMissionCommandBody;
}

export interface SignedMobileMissionCommand extends UnsignedMobileMissionCommand {
  keyId: string;
  signature: string;
}

export interface MobileMissionTrust {
  deviceId: string;
  sessionId: string;
  keyId: string;
  publicKey: JsonWebKey;
  revoked: boolean;
  now?: Date;
}

export interface MobileMissionTaskStatus {
  id: string;
  title: string;
  state: "queued" | "running" | "paused" | "blocked" | "completed" | "failed" | "cancelled";
  pcOnline: boolean;
  companionHealth: "healthy" | "degraded" | "offline";
  activeApplication: string | null;
  currentStep: string | null;
  lastVerifiedCheckpoint: string | null;
  progressPercent: number | null;
  error: string | null;
  blocker: string | null;
  preview: {
    enabled: boolean;
    redacted: boolean;
    dataUrl: string | null;
  };
}

export interface MobileMissionOutput {
  id: string;
  taskId: string;
  name: string;
  sizeBytes: number;
  sha256: string;
  status: "ready" | "partial" | "failed";
  downloadable: boolean;
}

export interface MobileMissionApproval {
  id: string;
  taskId: string;
  summary: string;
  risk: "read_only" | "low" | "confirm" | "high" | "prohibited";
  expiresAt: string;
  status: "pending" | "approved" | "denied" | "expired" | "cancelled";
}

export interface MobileMissionReceiptSummary {
  id: string;
  taskId: string;
  headline: string;
  outcome: "succeeded" | "failed" | "cancelled" | "unverified";
  observedAt: string;
}

export interface MobileMissionSnapshot {
  observedAt: string;
  task: MobileMissionTaskStatus | null;
  approvals: MobileMissionApproval[];
  outputs: MobileMissionOutput[];
  receipts: MobileMissionReceiptSummary[];
}

export interface MobileMissionReceipt {
  commandId: string;
  acknowledged: boolean;
  outcome: "completed" | "refused" | "failed";
  observedAt: string;
  evidence: string[];
  detail: string;
}

export interface MobileMissionHost {
  execute(command: SignedMobileMissionCommand, signal?: AbortSignal): Promise<MobileMissionReceipt>;
}

export type MobileMissionOutcome<T> =
  { ok: true; data: T; evidence: string[] } | { ok: false; reason: string; evidence: string[] };

const COMMAND_TTL_MS = 2 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const MAX_TEXT_LENGTH = 8_000;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/;
const NONCE = /^[A-Za-z0-9_-]{22,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export const MOBILE_MISSION_RUNTIME_BOUNDARY =
  "The mobile companion supervises PC tasks only. It never automates the phone screen, protected inputs or arbitrary desktop actions, and live commands remain unavailable until a native signed transport acknowledges them.";

export function canonicalMobileMissionCommand(command: UnsignedMobileMissionCommand): string {
  return JSON.stringify({
    v: command.v,
    commandId: command.commandId,
    deviceId: command.deviceId,
    sessionId: command.sessionId,
    target: command.target,
    nonce: command.nonce,
    issuedAt: command.issuedAt,
    expiresAt: command.expiresAt,
    scope: {
      capabilities: uniqueSorted(command.scope.capabilities),
      taskIds: uniqueSorted(command.scope.taskIds),
      applicationIds: uniqueSorted(command.scope.applicationIds),
      fileIds: uniqueSorted(command.scope.fileIds),
    },
    body: canonicalBody(command.body),
  });
}

export async function signMobileMissionCommand(
  command: UnsignedMobileMissionCommand,
  input: { keyId: string; privateKey: CryptoKey },
): Promise<SignedMobileMissionCommand> {
  if (!IDENTIFIER.test(input.keyId)) throw new Error("A bounded signing key ID is required.");
  const validation = validateUnsignedCommand(command, new Date(command.issuedAt));
  if (validation) throw new Error(validation);
  const signature = await cryptoApi().subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    input.privateKey,
    new TextEncoder().encode(canonicalMobileMissionCommand(command)),
  );
  return { ...command, keyId: input.keyId, signature: base64Url(new Uint8Array(signature)) };
}

export async function verifyMobileMissionCommand(
  command: SignedMobileMissionCommand,
  trust: MobileMissionTrust,
): Promise<MobileMissionOutcome<SignedMobileMissionCommand>> {
  const now = trust.now ?? new Date();
  const validation = validateUnsignedCommand(command, now);
  if (validation) return { ok: false, reason: validation, evidence: [] };
  if (trust.revoked) {
    return { ok: false, reason: "This mobile session was revoked.", evidence: [] };
  }
  if (
    command.deviceId !== trust.deviceId ||
    command.sessionId !== trust.sessionId ||
    command.keyId !== trust.keyId
  ) {
    return {
      ok: false,
      reason: "The command is not bound to this device session and key.",
      evidence: [],
    };
  }
  if (!IDENTIFIER.test(command.keyId) || !/^[A-Za-z0-9_-]{80,256}$/.test(command.signature)) {
    return { ok: false, reason: "The mobile command signature is malformed.", evidence: [] };
  }

  try {
    const key = await cryptoApi().subtle.importKey(
      "jwk",
      trust.publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const verified = await cryptoApi().subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      arrayBuffer(fromBase64Url(command.signature)),
      new TextEncoder().encode(canonicalMobileMissionCommand(command)),
    );
    return verified
      ? {
          ok: true,
          data: command,
          evidence: [
            `signature:${command.keyId}`,
            `device:${command.deviceId}`,
            `scope:${command.body.kind}`,
          ],
        }
      : { ok: false, reason: "The mobile command signature did not verify.", evidence: [] };
  } catch {
    return {
      ok: false,
      reason: "The mobile command signature could not be verified.",
      evidence: [],
    };
  }
}

export async function executeMobileMissionCommand(
  command: SignedMobileMissionCommand,
  trust: MobileMissionTrust,
  host: MobileMissionHost,
  signal?: AbortSignal,
): Promise<MobileMissionOutcome<MobileMissionReceipt>> {
  if (signal?.aborted) {
    return {
      ok: false,
      reason: "The mobile command was cancelled before verification.",
      evidence: [],
    };
  }
  const verified = await verifyMobileMissionCommand(command, trust);
  if (!verified.ok) return verified;
  if (signal?.aborted) {
    return {
      ok: false,
      reason: "The mobile command was cancelled before execution.",
      evidence: verified.evidence,
    };
  }

  try {
    const receipt = await host.execute(command, signal);
    if (
      receipt.commandId !== command.commandId ||
      !Number.isFinite(Date.parse(receipt.observedAt)) ||
      !Array.isArray(receipt.evidence) ||
      receipt.evidence.length === 0
    ) {
      return {
        ok: false,
        reason: "The PC returned an invalid or uncorrelated command receipt.",
        evidence: verified.evidence,
      };
    }
    if (!receipt.acknowledged || receipt.outcome !== "completed") {
      return {
        ok: false,
        reason: receipt.detail || "The PC did not acknowledge completion.",
        evidence: [...verified.evidence, ...receipt.evidence],
      };
    }
    return {
      ok: true,
      data: receipt,
      evidence: [...verified.evidence, ...receipt.evidence],
    };
  } catch (error) {
    return {
      ok: false,
      reason: `The mobile command transport failed: ${error instanceof Error ? error.message : String(error)}`,
      evidence: verified.evidence,
    };
  }
}

export function sanitizeMobileMissionSnapshot(
  snapshot: MobileMissionSnapshot,
  now: Date = new Date(),
): MobileMissionOutcome<MobileMissionSnapshot> {
  if (
    !Number.isFinite(Date.parse(snapshot.observedAt)) ||
    Date.parse(snapshot.observedAt) > now.getTime() + CLOCK_SKEW_MS
  ) {
    return { ok: false, reason: "The mobile mission snapshot time is invalid.", evidence: [] };
  }
  if (
    !Array.isArray(snapshot.approvals) ||
    !Array.isArray(snapshot.outputs) ||
    !Array.isArray(snapshot.receipts)
  ) {
    return {
      ok: false,
      reason: "The mobile mission snapshot collections are invalid.",
      evidence: [],
    };
  }
  if (snapshot.task) {
    const task = snapshot.task;
    if (
      !IDENTIFIER.test(task.id) ||
      !task.title.trim() ||
      (task.progressPercent !== null &&
        (!Number.isFinite(task.progressPercent) ||
          task.progressPercent < 0 ||
          task.progressPercent > 100))
    ) {
      return { ok: false, reason: "The current mobile task status is invalid.", evidence: [] };
    }
    if (task.preview.dataUrl && (!task.preview.enabled || !task.preview.redacted)) {
      return {
        ok: false,
        reason: "An enabled and independently redacted preview is required before mobile display.",
        evidence: [],
      };
    }
  }
  if (
    snapshot.outputs.some(
      (output) =>
        !IDENTIFIER.test(output.id) ||
        !IDENTIFIER.test(output.taskId) ||
        !output.name.trim() ||
        !Number.isSafeInteger(output.sizeBytes) ||
        output.sizeBytes < 0 ||
        !SHA256.test(output.sha256),
    )
  ) {
    return { ok: false, reason: "A mobile output record is invalid.", evidence: [] };
  }
  if (
    snapshot.approvals.some(
      (approval) =>
        !IDENTIFIER.test(approval.id) ||
        !IDENTIFIER.test(approval.taskId) ||
        !approval.summary.trim() ||
        isProtectedText(approval.summary) ||
        !Number.isFinite(Date.parse(approval.expiresAt)),
    )
  ) {
    return {
      ok: false,
      reason: "An approval contains invalid or protected lock-screen content.",
      evidence: [],
    };
  }

  const sanitized: MobileMissionSnapshot = {
    observedAt: snapshot.observedAt,
    task: snapshot.task
      ? {
          ...snapshot.task,
          title: bounded(snapshot.task.title),
          activeApplication: snapshot.task.activeApplication
            ? bounded(snapshot.task.activeApplication)
            : null,
          currentStep: snapshot.task.currentStep ? bounded(snapshot.task.currentStep) : null,
          error: snapshot.task.error ? bounded(snapshot.task.error) : null,
          blocker: snapshot.task.blocker ? bounded(snapshot.task.blocker) : null,
          preview:
            snapshot.task.preview.enabled && snapshot.task.preview.redacted
              ? { ...snapshot.task.preview }
              : { enabled: false, redacted: false, dataUrl: null },
        }
      : null,
    approvals: snapshot.approvals.map((approval) => ({
      ...approval,
      summary: bounded(approval.summary),
    })),
    outputs: snapshot.outputs.map((output) => ({ ...output, name: bounded(output.name) })),
    receipts: snapshot.receipts.map((receipt) => ({
      ...receipt,
      headline: bounded(receipt.headline),
    })),
  };
  return {
    ok: true,
    data: sanitized,
    evidence: [
      `snapshot:${sanitized.observedAt}`,
      `approvals:${sanitized.approvals.length}`,
      `outputs:${sanitized.outputs.length}`,
      `receipts:${sanitized.receipts.length}`,
    ],
  };
}

function validateUnsignedCommand(command: UnsignedMobileMissionCommand, now: Date): string | null {
  if (command.v !== 1 || command.target !== "pc_task_only") {
    return "Mobile commands may target only the versioned PC-task mission interface.";
  }
  if (
    !IDENTIFIER.test(command.commandId) ||
    !IDENTIFIER.test(command.deviceId) ||
    !IDENTIFIER.test(command.sessionId) ||
    !NONCE.test(command.nonce)
  ) {
    return "The mobile command identity or nonce is invalid.";
  }
  const issuedAt = Date.parse(command.issuedAt);
  const expiresAt = Date.parse(command.expiresAt);
  const current = now.getTime();
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(current) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > COMMAND_TTL_MS ||
    issuedAt > current + CLOCK_SKEW_MS ||
    expiresAt < current
  ) {
    return "The mobile command is expired or outside its short-lived time bounds.";
  }
  if (!MOBILE_MISSION_COMMAND_KINDS.includes(command.body.kind)) {
    return "The mobile command kind is not allowed.";
  }
  if (!command.scope.capabilities.includes(command.body.kind)) {
    return "The short-lived scope does not grant this mobile command.";
  }
  if (command.scope.capabilities.some((kind) => !MOBILE_MISSION_COMMAND_KINDS.includes(kind))) {
    return "The mobile command scope contains an unknown capability.";
  }
  const taskId = "taskId" in command.body ? command.body.taskId : null;
  if (taskId && (!IDENTIFIER.test(taskId) || !command.scope.taskIds.includes(taskId))) {
    return "The mobile command is outside its task scope.";
  }
  if ("text" in command.body) {
    const text = command.body.text.trim();
    if (!text || text.length > MAX_TEXT_LENGTH || isProtectedText(text)) {
      return "Mobile task instructions must be bounded and cannot contain protected input.";
    }
  }
  if (command.body.kind === "instruction.correct" && !IDENTIFIER.test(command.body.instructionId)) {
    return "The corrected instruction ID is invalid.";
  }
  if (command.body.kind === "approval.decide" && !IDENTIFIER.test(command.body.approvalId)) {
    return "The approval ID is invalid.";
  }
  if (
    command.body.kind === "output.download" &&
    (!IDENTIFIER.test(command.body.outputId) ||
      !command.scope.fileIds.includes(command.body.outputId))
  ) {
    return "The output download is outside its file scope.";
  }
  return null;
}

function canonicalBody(body: MobileMissionCommandBody): Record<string, unknown> {
  switch (body.kind) {
    case "task.create":
      return { kind: body.kind, text: body.text };
    case "instruction.add":
      return { kind: body.kind, taskId: body.taskId, text: body.text };
    case "instruction.correct":
      return {
        kind: body.kind,
        taskId: body.taskId,
        instructionId: body.instructionId,
        text: body.text,
      };
    case "approval.decide":
      return {
        kind: body.kind,
        taskId: body.taskId,
        approvalId: body.approvalId,
        decision: body.decision,
      };
    case "run.pause":
    case "run.resume":
    case "run.cancel":
      return { kind: body.kind, taskId: body.taskId };
    case "output.download":
      return { kind: body.kind, taskId: body.taskId, outputId: body.outputId };
    case "emergency.stop":
    case "session.revoke":
      return { kind: body.kind };
  }
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto is required for mobile commands.");
  return globalThis.crypto;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed base64url.");
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function bounded(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 497)}...` : trimmed;
}
