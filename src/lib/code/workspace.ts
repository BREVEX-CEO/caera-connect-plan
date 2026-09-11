/**
 * OCADE Code workspace.
 *
 * This module owns the state transition contract for repository work. It does
 * not read arbitrary host files or spawn a shell. A browser can supply files
 * the user explicitly selected, while a desktop companion can later implement
 * `CodeCommandHost`. Both use the same exact-patch, checkpoint, observation,
 * and receipt rules.
 *
 * The workspace is immutable. A refused patch, stale undo, unavailable host,
 * thrown command, or malformed observation returns without a replacement
 * workspace, which makes "nothing changed" inspectable instead of aspirational.
 */
import {
  buildPatchReceipt,
  applyPatch,
  applyReversibly,
  parseUnifiedDiff,
  type Patch,
  type PatchReceipt,
} from "./patch";
import {
  buildRepoMap,
  findSymbol,
  type RepoMap,
  type SourceFile,
  type SymbolHit,
} from "./repo-map";
import { diagnose, type Diagnostics } from "./dependency-graph";
import { findReferences, type ReferenceReport } from "./references";
import type { EvidenceReceipt } from "../skills/skill-pack";
import { formatNumber } from "@/lib/locale/format";

export type WorkspaceOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type CodeCommand = "test" | "typecheck" | "lint" | "build" | "runtime";

export interface CodeChange {
  id: string;
  path: string;
  /** Exact reviewed patch bytes; later editor changes cannot replace its artifact. */
  patchText: string;
  beforeSha256: string;
  afterSha256: string;
  /** The inverse was executed in memory and restored the original exactly. */
  undoVerified: boolean;
  inverse: Patch;
  receipt: PatchReceipt;
  createdAt: string;
  status: "applied" | "undone";
  undoneAt?: string;
}

export interface CodeHistoryEntry {
  id: string;
  at: string;
  kind: "repository" | "patch" | "undo" | "command";
  label: string;
  status: "verified" | "unverified" | "failed";
  evidence: string;
  path?: string;
  command?: CodeCommand;
}

export interface CodeWorkspace {
  id: string;
  name: string;
  createdAt: string;
  revision: number;
  files: SourceFile[];
  /**
   * The repository exactly as it was taken in, kept for the life of the session.
   *
   * WITHOUT IT THERE IS NO "WHAT HAS CHANGED". Every patch rewrites `files`,
   * so after two edits the workspace can say what the second one did and
   * nothing at all about the session as a whole — which is the question a
   * person asks before they commit. Git answers it by diffing the working tree
   * against a recorded state, and this is that state: captured once at intake,
   * never written to afterwards, so a status is a comparison of two observed
   * things rather than a story assembled from the change log.
   */
  baseline: SourceFile[];
  changes: CodeChange[];
  history: CodeHistoryEntry[];
}

export interface RepositoryInstruction {
  path: string;
  content: string;
}

export interface WorkspaceAnalysis {
  map: RepoMap;
  diagnostics: Diagnostics;
  symbols: SymbolHit[];
  references: ReferenceReport;
}

export interface TextSearchHit {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface PatchPreview {
  path: string;
  before: string;
  after: string;
  inverse: Patch;
  receipt: PatchReceipt;
}

export interface CodeCommandRequest {
  command: CodeCommand;
  workspaceId: string;
  workspaceName: string;
  revision: number;
  files: SourceFile[];
  signal?: AbortSignal;
}

export interface CodeCommandObservation {
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  /**
   * True only when the host actually observed the process exit and captured
   * its output. An acknowledgement or dispatch result is not observation.
   */
  observed: boolean;
}

export interface CodeCommandHost {
  id: string;
  kind: "temporary" | "desktop" | "unavailable";
  unavailableReason?: string;
  run(request: CodeCommandRequest): Promise<CodeCommandObservation>;
}

const MAX_FILES = 500;
const MAX_FILE_CHARACTERS = 2_000_000;
const MAX_TOTAL_CHARACTERS = 10_000_000;
const MAX_SEARCH_RESULTS = 200;

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function generatedId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePath(input: string): WorkspaceOutcome<string> {
  const raw = input.trim().replace(/\\/g, "/");
  if (!raw) return { ok: false, reason: "A repository file has no path." };
  if (raw.includes("\0")) {
    return { ok: false, reason: `The path ${JSON.stringify(input)} contains a null byte.` };
  }
  if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw) || raw.startsWith("//")) {
    return {
      ok: false,
      reason: `The path ${JSON.stringify(input)} is absolute. Repository intake accepts relative paths only.`,
    };
  }
  const parts = raw.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) {
    return {
      ok: false,
      reason: `The path ${JSON.stringify(input)} escapes or does not identify a repository file.`,
    };
  }
  return { ok: true, data: parts.join("/"), evidence: "Relative path validated." };
}

async function sha256(content: string): Promise<WorkspaceOutcome<string>> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return {
      ok: false,
      reason: "Web Crypto is unavailable, so OCADE cannot checkpoint repository content safely.",
    };
  }
  const bytes = new TextEncoder().encode(content);
  const digest = await subtle.digest("SHA-256", bytes);
  return {
    ok: true,
    data: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    evidence: "SHA-256 calculated.",
  };
}

export function createCodeWorkspace(input: {
  name: string;
  files: SourceFile[];
  id?: string;
  now?: Date;
}): WorkspaceOutcome<CodeWorkspace> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "A repository workspace needs a name." };
  if (input.files.length === 0) {
    return { ok: false, reason: "No repository files were supplied." };
  }
  if (input.files.length > MAX_FILES) {
    return {
      ok: false,
      reason: `This repository selection contains ${input.files.length} files; the on-device review limit is ${MAX_FILES}. Narrow the selection or use the desktop companion.`,
    };
  }

  const seen = new Set<string>();
  const files: SourceFile[] = [];
  let totalCharacters = 0;
  for (const file of input.files) {
    const path = normalizePath(file.path);
    if (!path.ok) return path;
    if (seen.has(path.data)) {
      return {
        ok: false,
        reason: `The repository supplied ${path.data} more than once. Nothing was loaded.`,
      };
    }
    if (file.content.includes("\0")) {
      return {
        ok: false,
        reason: `${path.data} contains binary null bytes. OCADE will not reinterpret binary data as source text.`,
      };
    }
    if (file.content.length > MAX_FILE_CHARACTERS) {
      return {
        ok: false,
        reason: `${path.data} exceeds the ${formatNumber(MAX_FILE_CHARACTERS)}-character on-device file limit.`,
      };
    }
    totalCharacters += file.content.length;
    if (totalCharacters > MAX_TOTAL_CHARACTERS) {
      return {
        ok: false,
        reason: `The selected files exceed the ${formatNumber(MAX_TOTAL_CHARACTERS)}-character on-device repository limit.`,
      };
    }
    seen.add(path.data);
    files.push({ path: path.data, content: file.content });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));

  const at = nowIso(input.now);
  const workspace: CodeWorkspace = {
    id: input.id ?? generatedId("repo"),
    name,
    createdAt: at,
    revision: 0,
    files,
    // Frozen copies. The baseline must not alias the array the caller can go
    // on to edit, and must not alias `files`, which every patch replaces.
    baseline: files.map((file) => ({ ...file })),
    changes: [],
    history: [
      {
        id: generatedId("history"),
        at,
        kind: "repository",
        label: `Loaded ${name}`,
        status: "verified",
        evidence: `${files.length} user-selected text files loaded into session memory; no host file was changed.`,
      },
    ],
  };
  return {
    ok: true,
    data: workspace,
    evidence: `${files.length} files loaded into an on-device session workspace.`,
  };
}

export function applicableInstructions(
  workspace: CodeWorkspace,
  targetPath: string,
): RepositoryInstruction[] {
  const normalized = normalizePath(targetPath);
  if (!normalized.ok) return [];
  const targetDirectory = normalized.data.includes("/")
    ? normalized.data.slice(0, normalized.data.lastIndexOf("/"))
    : "";

  return workspace.files
    .filter((file) => file.path === "AGENTS.md" || file.path.endsWith("/AGENTS.md"))
    .filter((file) => {
      const instructionDirectory =
        file.path === "AGENTS.md" ? "" : file.path.slice(0, -"/AGENTS.md".length);
      return (
        instructionDirectory === "" ||
        targetDirectory === instructionDirectory ||
        targetDirectory.startsWith(`${instructionDirectory}/`)
      );
    })
    .sort((left, right) => {
      const leftDepth = left.path.split("/").length;
      const rightDepth = right.path.split("/").length;
      return leftDepth - rightDepth || left.path.localeCompare(right.path);
    })
    .map((file) => ({ path: file.path, content: file.content }));
}

export function searchWorkspaceText(
  workspace: CodeWorkspace,
  query: string,
  options: { caseSensitive?: boolean; limit?: number } = {},
): WorkspaceOutcome<TextSearchHit[]> {
  const needle = query.trim();
  if (!needle) return { ok: false, reason: "Enter text to search for." };
  if (needle.length > 200)
    return { ok: false, reason: "Search text is limited to 200 characters." };
  const requestedLimit = options.limit ?? MAX_SEARCH_RESULTS;
  const limit = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Math.floor(requestedLimit)));
  const comparisonNeedle = options.caseSensitive ? needle : needle.toLowerCase();
  const hits: TextSearchHit[] = [];

  for (const file of workspace.files) {
    const lines = file.content.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const comparisonLine = options.caseSensitive ? lines[index] : lines[index].toLowerCase();
      const column = comparisonLine.indexOf(comparisonNeedle);
      if (column < 0) continue;
      hits.push({
        path: file.path,
        line: index + 1,
        column: column + 1,
        text: lines[index].trim().slice(0, 500),
      });
      if (hits.length >= limit) {
        return {
          ok: true,
          data: hits,
          evidence: `${hits.length} matches returned; results were capped at ${limit}.`,
        };
      }
    }
  }
  return {
    ok: true,
    data: hits,
    evidence: `${hits.length} text match${hits.length === 1 ? "" : "es"} for ${JSON.stringify(needle)}.`,
  };
}

export function analyseWorkspace(workspace: CodeWorkspace): WorkspaceOutcome<WorkspaceAnalysis> {
  const map = buildRepoMap(workspace.files);
  if (!map.ok) return map;
  const diagnostics = diagnose(map.data);
  if (!diagnostics.ok) return diagnostics;
  const symbols = map.data.files.flatMap((file) =>
    file.exports.map((symbol) => ({ path: file.path, symbol })),
  );
  const primarySymbol =
    symbols.find((hit) => hit.symbol.kind === "function")?.symbol.name ?? symbols[0]?.symbol.name;
  const references = primarySymbol
    ? findReferences(workspace.files, primarySymbol)
    : {
        ok: true as const,
        data: {
          symbol: "",
          references: [],
          definitions: [],
          skipped: map.data.unparsed,
        },
        evidence: "No exported symbol was available for reference analysis.",
      };
  if (!references.ok) return references;

  return {
    ok: true,
    data: {
      map: map.data,
      diagnostics: diagnostics.data,
      symbols,
      references: references.data,
    },
    evidence: `${map.evidence} ${diagnostics.evidence}`,
  };
}

function locatePatchTarget(
  workspace: CodeWorkspace,
  diff: string,
): WorkspaceOutcome<{
  path: string;
  file: SourceFile;
  patch: Patch;
}> {
  const parsed = parseUnifiedDiff(diff);
  if (!parsed.ok) return parsed;
  const path = normalizePath(parsed.data.path);
  if (!path.ok) return path;
  const file = workspace.files.find((candidate) => candidate.path === path.data);
  if (!file) {
    return {
      ok: false,
      reason: `${path.data} is not in this repository snapshot. OCADE will not create or guess a target from an update-only patch.`,
    };
  }
  return {
    ok: true,
    data: { path: path.data, file, patch: { ...parsed.data, path: path.data } },
    evidence: parsed.evidence,
  };
}

export async function previewCodePatch(
  workspace: CodeWorkspace,
  diff: string,
): Promise<WorkspaceOutcome<PatchPreview>> {
  const target = locatePatchTarget(workspace, diff);
  if (!target.ok) return target;
  const applied = applyReversibly(target.data.file.content, target.data.patch);
  if (!applied.ok) return applied;
  return {
    ok: true,
    data: {
      path: target.data.path,
      before: target.data.file.content,
      after: applied.data.content,
      inverse: applied.data.inverse,
      receipt: buildPatchReceipt(target.data.patch, applied.data, true),
    },
    evidence: `${applied.evidence} Preview only; workspace revision ${workspace.revision} is unchanged.`,
  };
}

export async function applyCodePatch(
  workspace: CodeWorkspace,
  diff: string,
  options: { id?: string; now?: Date } = {},
): Promise<WorkspaceOutcome<{ workspace: CodeWorkspace; change: CodeChange }>> {
  const preview = await previewCodePatch(workspace, diff);
  if (!preview.ok) return preview;
  const beforeHash = await sha256(preview.data.before);
  if (!beforeHash.ok) return beforeHash;
  const afterHash = await sha256(preview.data.after);
  if (!afterHash.ok) return afterHash;
  const at = nowIso(options.now);
  const change: CodeChange = {
    id: options.id ?? generatedId("change"),
    path: preview.data.path,
    patchText: diff,
    beforeSha256: beforeHash.data,
    afterSha256: afterHash.data,
    undoVerified: preview.data.receipt.undoVerified,
    inverse: preview.data.inverse,
    receipt: preview.data.receipt,
    createdAt: at,
    status: "applied",
  };
  const next: CodeWorkspace = {
    ...workspace,
    revision: workspace.revision + 1,
    files: workspace.files.map((file) =>
      file.path === preview.data.path ? { ...file, content: preview.data.after } : file,
    ),
    changes: [...workspace.changes, change],
    history: [
      ...workspace.history,
      {
        id: generatedId("history"),
        at,
        kind: "patch",
        label: `Applied ${preview.data.path}`,
        status: "verified",
        evidence: preview.data.receipt.evidence,
        path: preview.data.path,
      },
    ],
  };
  return {
    ok: true,
    data: { workspace: next, change },
    evidence: `${preview.data.receipt.evidence} Before and after SHA-256 checkpoints recorded.`,
  };
}

export async function undoCodeChange(
  workspace: CodeWorkspace,
  changeId: string,
  options: { now?: Date } = {},
): Promise<WorkspaceOutcome<{ workspace: CodeWorkspace; change: CodeChange }>> {
  const index = workspace.changes.findIndex((change) => change.id === changeId);
  if (index < 0) return { ok: false, reason: "That code change is not in this workspace." };
  const change = workspace.changes[index];
  if (change.status !== "applied") {
    return { ok: false, reason: "That code change was already undone." };
  }
  const file = workspace.files.find((candidate) => candidate.path === change.path);
  if (!file) return { ok: false, reason: `${change.path} is no longer in the workspace.` };
  const currentHash = await sha256(file.content);
  if (!currentHash.ok) return currentHash;
  if (currentHash.data !== change.afterSha256) {
    return {
      ok: false,
      reason: `${change.path} changed after this checkpoint. Undo was refused so newer work is not overwritten.`,
    };
  }
  const undone = applyPatch(file.content, change.inverse);
  if (!undone.ok) return undone;
  const restoredHash = await sha256(undone.data.content);
  if (!restoredHash.ok) return restoredHash;
  if (restoredHash.data !== change.beforeSha256) {
    return {
      ok: false,
      reason: `Undo did not reproduce the recorded before hash for ${change.path}. Nothing was changed.`,
    };
  }

  const at = nowIso(options.now);
  const updated: CodeChange = { ...change, status: "undone", undoneAt: at };
  const changes = [...workspace.changes];
  changes[index] = updated;
  const next: CodeWorkspace = {
    ...workspace,
    revision: workspace.revision + 1,
    files: workspace.files.map((candidate) =>
      candidate.path === change.path ? { ...candidate, content: undone.data.content } : candidate,
    ),
    changes,
    history: [
      ...workspace.history,
      {
        id: generatedId("history"),
        at,
        kind: "undo",
        label: `Restored ${change.path}`,
        status: "verified",
        evidence: `${change.path} restored byte-for-byte to SHA-256 ${change.beforeSha256.slice(0, 12)}….`,
        path: change.path,
      },
    ],
  };
  return {
    ok: true,
    data: { workspace: next, change: updated },
    evidence: `${change.path} restored to its recorded before hash.`,
  };
}

function validateObservation(
  observation: CodeCommandObservation,
): WorkspaceOutcome<CodeCommandObservation> {
  if (!Number.isInteger(observation.exitCode)) {
    return { ok: false, reason: "The command host returned an invalid exit code." };
  }
  const started = Date.parse(observation.startedAt);
  const finished = Date.parse(observation.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return { ok: false, reason: "The command host returned invalid observation timestamps." };
  }
  if (typeof observation.observed !== "boolean") {
    return {
      ok: false,
      reason: "The command host did not state whether process exit was observed.",
    };
  }
  return { ok: true, data: observation, evidence: "Command observation validated." };
}

export async function runWorkspaceCommand(
  workspace: CodeWorkspace,
  command: CodeCommand,
  host: CodeCommandHost,
  signal?: AbortSignal,
): Promise<
  WorkspaceOutcome<{
    workspace: CodeWorkspace;
    observation: CodeCommandObservation;
    receipt: EvidenceReceipt;
  }>
> {
  if (host.kind === "unavailable") {
    return {
      ok: false,
      reason:
        host.unavailableReason?.trim() ||
        "No command host is connected. OCADE will not simulate terminal output.",
    };
  }
  if (signal?.aborted) {
    return { ok: false, reason: `${command} was cancelled before the command host started.` };
  }

  let raw: CodeCommandObservation;
  try {
    raw = await host.run({
      command,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      revision: workspace.revision,
      files: workspace.files.map((file) => ({ ...file })),
      signal,
    });
  } catch (error) {
    return {
      ok: false,
      reason: `The ${command} host failed before it returned an observable result: ${
        error instanceof Error ? error.message : "unknown host error"
      }. No success receipt was recorded.`,
    };
  }
  if (signal?.aborted) {
    return {
      ok: false,
      reason: `${command} was cancelled while the host was running. Its completion is unknown, so no success receipt was recorded.`,
    };
  }
  const observation = validateObservation(raw);
  if (!observation.ok) return observation;

  const verified = observation.data.observed && observation.data.exitCode === 0;
  const status: CodeHistoryEntry["status"] =
    observation.data.exitCode !== 0 ? "failed" : verified ? "verified" : "unverified";
  const outputEvidence =
    observation.data.exitCode === 0
      ? `${command} exited 0${observation.data.observed ? " and the host observed process completion" : ", but process completion was not independently observed"}.`
      : `${command} exited ${observation.data.exitCode}: ${
          observation.data.stderr.trim().slice(0, 500) || "no stderr was captured"
        }`;
  const receipt: EvidenceReceipt = {
    appId: `ocade.code-host:${host.id}`,
    capabilityId: `code.${command}`,
    method: "cli",
    at: observation.data.finishedAt,
    verified,
    evidence: verified ? outputEvidence : `NOT CONFIRMED: ${outputEvidence}`,
  };
  const next: CodeWorkspace = {
    ...workspace,
    history: [
      ...workspace.history,
      {
        id: generatedId("history"),
        at: observation.data.finishedAt,
        kind: "command",
        command,
        label: `Ran ${command}`,
        status,
        evidence: receipt.evidence,
      },
    ],
  };
  return {
    ok: true,
    data: { workspace: next, observation: observation.data, receipt },
    evidence: receipt.evidence,
  };
}

/** Exact symbol lookup for the UI without exposing the map's internal shape. */
export function searchWorkspaceSymbol(
  workspace: CodeWorkspace,
  symbol: string,
  fuzzy = false,
): WorkspaceOutcome<SymbolHit[]> {
  const map = buildRepoMap(workspace.files);
  if (!map.ok) return map;
  return findSymbol(map.data, symbol, { fuzzy });
}

/** Textual reference candidates remain explicitly labelled as textual. */
export function searchWorkspaceReferences(
  workspace: CodeWorkspace,
  symbol: string,
): WorkspaceOutcome<ReferenceReport> {
  return findReferences(workspace.files, symbol);
}
