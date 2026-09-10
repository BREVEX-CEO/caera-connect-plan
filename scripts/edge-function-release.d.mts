/** Types for `edge-function-release.mjs`, matching the convention of the other release scripts. */

/** Reads one repository-relative file, or returns null when it is absent. */
export type SourceReader = (file: string) => string | null;

export interface ResolvedSources {
  /** Local files the entrypoint reaches, transitively, sorted. */
  readonly files: string[];
  /** Declared remote specifiers, which are pinned rather than hashed. */
  readonly remote: string[];
}

export interface HashedFile {
  readonly file: string;
  readonly sha256: string;
}

export interface HashedSources {
  readonly sourceHash: string;
  readonly files: HashedFile[];
}

export interface EdgeFunctionRelease {
  readonly version: number;
  readonly recordedAt: string;
  readonly release?: string;
  /** The commit the deployed source came from, or null when unknown. */
  readonly commit: string | null;
  readonly sourceHash: string;
  readonly remoteImports?: string[];
  readonly files: HashedFile[];
  readonly [extra: string]: unknown;
}

export interface EdgeFunctionLedger {
  readonly schemaVersion: number;
  readonly function?: string;
  readonly releases: EdgeFunctionRelease[];
}

export interface WorkingTreeVerdict {
  readonly state: "matches" | "ahead" | "no_release";
  readonly detail: string;
  readonly sourceHash?: string;
}

export interface RollbackProof {
  readonly ok: boolean;
  readonly detail: string;
  readonly version?: number;
  readonly commit?: string;
}

export const LEDGER_PATH: string;
export const ENTRYPOINT: string;

export function edgeFunctionSources(read: SourceReader, entrypoint?: string): ResolvedSources;
export function hashSources(read: SourceReader, files: readonly string[]): HashedSources;
export function workingTreeReader(root?: string): SourceReader;
export function commitReader(commit: string, root?: string): SourceReader;
export function readLedger(root?: string): EdgeFunctionLedger;
export function writeLedger(ledger: EdgeFunctionLedger, root?: string): void;
export function currentRelease(ledger: EdgeFunctionLedger): EdgeFunctionRelease | null;
export function previousRelease(ledger: EdgeFunctionLedger): EdgeFunctionRelease | null;
export function ledgerProblems(ledger: EdgeFunctionLedger): string[];
export function verifyWorkingTree(
  ledger: EdgeFunctionLedger,
  read: SourceReader,
): WorkingTreeVerdict;
export function proveRollback(ledger: EdgeFunctionLedger, root?: string): RollbackProof;
