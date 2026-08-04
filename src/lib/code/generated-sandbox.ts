/**
 * Generated-code sandbox control contract.
 *
 * Browser code owns admission, evidence validation and acceptance. A host owns
 * the disposable process. Success is impossible unless the host proves that
 * isolation, limits, termination and cleanup all completed.
 */
import type { EvidenceReceipt } from "../skills/skill-pack";

export type SandboxLanguage = "javascript" | "python";

export interface SandboxInput {
  path: string;
  content: string;
  sha256?: string;
}

export interface SandboxOutputRule {
  path: string;
  mediaType: string;
  maxBytes: number;
  existingContent?: string;
}

export interface SandboxLimits {
  wallTimeMs: number;
  cpuTimeMs: number;
  memoryMb: number;
  storageBytes: number;
  outputBytes: number;
}

export interface GeneratedSandboxRequest {
  taskId: string;
  language: SandboxLanguage;
  script: string;
  inputs: SandboxInput[];
  outputs: SandboxOutputRule[];
  allowedImports: string[];
  network: "disabled" | "approved";
  approvalId?: string;
  limits: SandboxLimits;
  sensitiveValues?: string[];
}

export interface SandboxFileObservation {
  path: string;
  content: string;
  sha256: string;
  bytes: number;
  mediaType: string;
}

export interface SandboxHostObservation {
  hostId: string;
  isolation: "node-permission-vm" | "os-sandbox";
  language: SandboxLanguage;
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  cancelled: boolean;
  timedOut: boolean;
  limitExceeded?: "cpu" | "memory" | "storage" | "output";
  stdout: string;
  stderr: string;
  outputs: SandboxFileObservation[];
  inputHashesAfter: Array<{ path: string; sha256: string }>;
  networkDenied: boolean;
  childProcessesDenied: boolean;
  readScopeEnforced: boolean;
  writeScopeEnforced: boolean;
  processExitObserved: boolean;
  processTreeTerminated: boolean;
  temporaryRootRemoved: boolean;
}

export interface GeneratedSandboxHost {
  id: string;
  kind: "node-permission-vm" | "os-sandbox" | "unavailable";
  supportedLanguages: SandboxLanguage[];
  unavailableReason?: string;
  run(request: GeneratedSandboxRequest, signal?: AbortSignal): Promise<SandboxHostObservation>;
}

export interface SandboxDiffPreview {
  path: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface GeneratedSandboxResult {
  status: "verified" | "failed" | "cancelled";
  observation: SandboxHostObservation;
  diffs: SandboxDiffPreview[];
  receipt: EvidenceReceipt;
}

export interface AcceptedSandboxArtifact {
  name: string;
  mediaType: string;
  content: string;
}

export interface SandboxOutcome<T> {
  ok: boolean;
  data?: T;
  reason?: string;
}

const HARD_LIMITS: SandboxLimits = {
  wallTimeMs: 120_000,
  cpuTimeMs: 120_000,
  memoryMb: 512,
  storageBytes: 50_000_000,
  outputBytes: 2_000_000,
};
const SECRET_LABEL = "[REDACTED]";

function normalizeRelativePath(value: string): string | null {
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
  const parts = path.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return null;
  return parts.join("/");
}

function redact(value: string, sensitiveValues: string[] = []): string {
  return sensitiveValues
    .filter((secret) => secret.length >= 4)
    .sort((left, right) => right.length - left.length)
    .reduce((text, secret) => text.split(secret).join(SECRET_LABEL), value);
}

function importedModules(language: SandboxLanguage, script: string): string[] {
  const modules = new Set<string>();
  const patterns =
    language === "python"
      ? [/^\s*import\s+([A-Za-z0-9_., ]+)/gm, /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm]
      : [
          /\bimport\s+(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']/g,
          /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
          /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
        ];
  for (const pattern of patterns) {
    for (const match of script.matchAll(pattern)) {
      for (const value of match[1].split(",").map((item) => item.trim().split(/[ .]/)[0])) {
        if (value) modules.add(value);
      }
    }
  }
  return [...modules].sort();
}

export function validateGeneratedSandboxRequest(
  request: GeneratedSandboxRequest,
): SandboxOutcome<GeneratedSandboxRequest> {
  if (!request.taskId.trim()) return { ok: false, reason: "A sandbox run needs a task id." };
  if (!request.script.trim()) return { ok: false, reason: "A sandbox run needs source code." };
  if (request.script.length > 1_000_000) {
    return { ok: false, reason: "Generated source exceeds the 1,000,000-character limit." };
  }
  if (request.network === "approved" && !request.approvalId?.trim()) {
    return { ok: false, reason: "Network access needs an explicit approval id." };
  }
  if (request.network !== "disabled" && request.network !== "approved") {
    return { ok: false, reason: "The network policy is invalid." };
  }

  for (const key of Object.keys(HARD_LIMITS) as Array<keyof SandboxLimits>) {
    const value = request.limits[key];
    if (!Number.isInteger(value) || value <= 0 || value > HARD_LIMITS[key]) {
      return {
        ok: false,
        reason: `${key} must be a positive integer no greater than ${HARD_LIMITS[key]}.`,
      };
    }
  }
  if (request.limits.cpuTimeMs > request.limits.wallTimeMs) {
    return { ok: false, reason: "CPU time cannot exceed the wall-time budget." };
  }
  if (request.limits.outputBytes > request.limits.storageBytes) {
    return { ok: false, reason: "Output bytes cannot exceed sandbox storage." };
  }

  const seen = new Set<string>();
  for (const entry of [...request.inputs, ...request.outputs]) {
    const path = normalizeRelativePath(entry.path);
    if (!path)
      return { ok: false, reason: `Sandbox path ${JSON.stringify(entry.path)} escapes its scope.` };
    if (seen.has(path)) {
      return { ok: false, reason: `Sandbox path ${path} is declared more than once.` };
    }
    seen.add(path);
  }
  for (const output of request.outputs) {
    if (
      !Number.isInteger(output.maxBytes) ||
      output.maxBytes <= 0 ||
      output.maxBytes > request.limits.outputBytes
    ) {
      return { ok: false, reason: `${output.path} has an invalid output size limit.` };
    }
    if (!output.mediaType.trim()) {
      return { ok: false, reason: `${output.path} needs an expected media type.` };
    }
  }

  const allowed = new Set(request.allowedImports.map((item) => item.trim()).filter(Boolean));
  const denied = importedModules(request.language, request.script).filter(
    (item) => !allowed.has(item),
  );
  if (denied.length > 0) {
    return {
      ok: false,
      reason: `Generated code imports modules outside its allowlist: ${denied.join(", ")}.`,
    };
  }
  return { ok: true, data: request };
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validObservationShape(observation: SandboxHostObservation): boolean {
  return (
    Number.isInteger(observation.exitCode) &&
    Number.isFinite(Date.parse(observation.startedAt)) &&
    Number.isFinite(Date.parse(observation.finishedAt)) &&
    Date.parse(observation.finishedAt) >= Date.parse(observation.startedAt) &&
    Array.isArray(observation.outputs) &&
    Array.isArray(observation.inputHashesAfter)
  );
}

export async function runGeneratedSandbox(
  request: GeneratedSandboxRequest,
  host: GeneratedSandboxHost,
  signal?: AbortSignal,
): Promise<SandboxOutcome<GeneratedSandboxResult>> {
  const admitted = validateGeneratedSandboxRequest(request);
  if (!admitted.ok) return { ok: false, reason: admitted.reason };
  if (host.kind === "unavailable") {
    return {
      ok: false,
      reason: host.unavailableReason || "No generated-code sandbox host is connected.",
    };
  }
  if (!host.supportedLanguages.includes(request.language)) {
    return {
      ok: false,
      reason: `${host.id} does not provide a secure ${request.language} isolation boundary.`,
    };
  }
  if (signal?.aborted) return { ok: false, reason: "Sandbox run was cancelled before dispatch." };

  let observation: SandboxHostObservation;
  try {
    observation = await host.run(request, signal);
  } catch (cause) {
    return {
      ok: false,
      reason: `Sandbox host failed without complete cleanup evidence: ${
        cause instanceof Error ? cause.message : "unknown host error"
      }.`,
    };
  }
  if (!validObservationShape(observation)) {
    return { ok: false, reason: "Sandbox host returned malformed evidence." };
  }
  const isolationVerified =
    observation.hostId === host.id &&
    observation.language === request.language &&
    observation.networkDenied &&
    observation.childProcessesDenied &&
    observation.readScopeEnforced &&
    observation.writeScopeEnforced &&
    observation.processExitObserved &&
    observation.processTreeTerminated &&
    observation.temporaryRootRemoved;
  if (!isolationVerified) {
    return {
      ok: false,
      reason:
        "Sandbox isolation, process termination, or temporary-directory cleanup was not proven. No result was accepted.",
    };
  }

  const inputHashes = new Map(
    observation.inputHashesAfter.map((entry) => [entry.path, entry.sha256]),
  );
  for (const input of request.inputs) {
    const before = input.sha256 ?? (await sha256(input.content));
    if (inputHashes.get(normalizeRelativePath(input.path)!) !== before) {
      return { ok: false, reason: `Read-only input ${input.path} changed during execution.` };
    }
  }

  const rules = new Map(
    request.outputs.map((rule) => [normalizeRelativePath(rule.path)!, rule] as const),
  );
  const diffs: SandboxDiffPreview[] = [];
  let observedBytes = 0;
  for (const output of observation.outputs) {
    const rule = rules.get(output.path);
    if (!rule) return { ok: false, reason: `Sandbox produced undeclared output ${output.path}.` };
    const actualBytes = new TextEncoder().encode(output.content).byteLength;
    const actualHash = await sha256(output.content);
    if (
      output.bytes !== actualBytes ||
      output.sha256 !== actualHash ||
      output.mediaType !== rule.mediaType ||
      output.bytes > rule.maxBytes
    ) {
      return { ok: false, reason: `Sandbox output ${output.path} failed validation.` };
    }
    observedBytes += output.bytes;
    diffs.push({
      path: output.path,
      before: rule.existingContent ?? "",
      after: output.content,
      changed: (rule.existingContent ?? "") !== output.content,
    });
  }
  if (observedBytes > request.limits.outputBytes) {
    return { ok: false, reason: "Sandbox outputs exceed the aggregate output limit." };
  }

  const status: GeneratedSandboxResult["status"] = observation.cancelled
    ? "cancelled"
    : observation.exitCode === 0 && !observation.timedOut && !observation.limitExceeded
      ? "verified"
      : "failed";
  const sensitive = request.sensitiveValues ?? [];
  const safeObservation = {
    ...observation,
    stdout: redact(observation.stdout, sensitive),
    stderr: redact(observation.stderr, sensitive),
    outputs: observation.outputs.map((output) => ({
      ...output,
      content: redact(output.content, sensitive),
    })),
  };
  const receipt: EvidenceReceipt = {
    appId: `ocade.generated-sandbox:${host.id}`,
    capabilityId: `code.generated.${request.language}`,
    method: "cli",
    at: observation.finishedAt,
    verified: status === "verified",
    evidence:
      status === "verified"
        ? `${request.language} exited 0 in an isolated disposable host; scopes, termination, outputs and cleanup were independently validated.`
        : `NOT CONFIRMED: ${request.language} ${status}; exit ${observation.exitCode}, cleanup and termination were observed.`,
  };
  return {
    ok: true,
    data: { status, observation: safeObservation, diffs, receipt },
  };
}

export function acceptGeneratedSandboxResult(
  request: GeneratedSandboxRequest,
  result: GeneratedSandboxResult,
): SandboxOutcome<AcceptedSandboxArtifact[]> {
  if (result.status !== "verified" || !result.receipt.verified) {
    return { ok: false, reason: "Only a verified sandbox run can be accepted." };
  }
  const safeScript = redact(request.script, request.sensitiveValues);
  const receipt = redact(JSON.stringify(result.receipt, null, 2), request.sensitiveValues);
  return {
    ok: true,
    data: [
      {
        name: `generated-${request.taskId}.${request.language === "python" ? "py" : "mjs"}`,
        mediaType: "text/plain",
        content: safeScript,
      },
      {
        name: `generated-${request.taskId}-receipt.json`,
        mediaType: "application/json",
        content: receipt,
      },
      ...result.observation.outputs.map((output) => ({
        name: output.path,
        mediaType: output.mediaType,
        content: output.content,
      })),
    ],
  };
}
