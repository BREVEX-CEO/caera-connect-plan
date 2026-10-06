/**
 * Versioned model storage: staging, activation, rollback and removal.
 *
 * WHAT WAS WRONG WITH ONE FILE PER MODEL.
 *
 * `model-store.ts` stores each engine under a single stable key. That is fine
 * while there is exactly one version of one model and it never changes, and it
 * fails at every interesting moment:
 *
 *  - An UPGRADE writes over the working engine. If the new one turns out to be
 *    corrupt, the user is left with nothing — the failure destroyed the thing
 *    that was working.
 *  - A HALF-WRITTEN file is indistinguishable from a resumable one, because
 *    "partial download" and "in-progress replacement" share a path.
 *  - There is nothing to ROLL BACK TO, because the previous bytes are gone.
 *
 * THE FIX IS A POINTER, NOT A MOVE. Every version owns a directory named after
 * its immutable identity, and ONE small pointer says which version is active.
 * So:
 *
 *   activation  = write the pointer                     (one atomic write)
 *   rollback    = write the pointer back                (one atomic write)
 *   staging     = any version the pointer does not name (no special state)
 *
 * Nothing is ever copied or moved to promote a candidate, which is what makes
 * promotion genuinely atomic rather than "atomic if the copy finishes". A
 * candidate that fails verification is simply never pointed at, and the version
 * that was working keeps working throughout — including while its replacement
 * is downloading, and including if the browser is closed mid-upgrade.
 *
 * THE POINTER IS NEVER SET BY THE DOWNLOADER. Only `activate()` sets it, and
 * only after the caller has proven the digest. That separation is the whole
 * safety property: bytes on disk are inert until something with evidence says
 * otherwise.
 */

import { ModelStore, modelStore } from "./model-store";
import type { DigestCheckpoint } from "./streaming-digest";

/** Root directory inside OPFS. Sibling of the legacy flat layout. */
const VERSIONS_DIRECTORY = "versions";

/**
 * THE ONE RECORD OF WHAT IS INSTALLED, IN OPFS BESIDE THE BYTES.
 *
 * Pointers and verification metadata used to live in localStorage with this
 * file as a backup copy, so clearing site storage could strand a verified
 * model and the two could disagree. Now this manifest is the authority, held
 * in memory after `load()` and written through on every change.
 */
const MANIFEST = `${VERSIONS_DIRECTORY}/pointers.json`;

/** Keys an older release kept in localStorage; moved into the manifest once. */
const LEGACY_ACTIVE_KEY = "ocade.model.active.v1";
const LEGACY_PREVIOUS_KEY = "ocade.model.previous.v1";
const LEGACY_PREFIXES = ["ocade.model.version.v1.", "ocade.model.meta."];

/**
 * What is known about one stored version.
 *
 * `verified` is the only field that may authorise use, and it is set in exactly
 * one place — after a digest match. Everything else is bookkeeping that makes a
 * resume cheap; none of it is evidence.
 */
export interface VersionMeta {
  /** The digest matched. Nothing else may set this. */
  verified: boolean;
  /** Bytes the complete artifact should have, when known. */
  expectedBytes: number | null;
  /** The published digest this version is held to. */
  sha256?: string;
  /**
   * The running digest, saved at a chunk boundary.
   *
   * This is what makes an interrupted install resume hashing where it stopped
   * instead of re-reading everything already on disk. It is bookkeeping and not
   * evidence: a checkpoint can only ever make verification FASTER, and the
   * final digest still has to match before anything is activated.
   */
  digest?: DigestCheckpoint;
  /** Chunks confirmed written and hashed, as an inclusive count from zero. */
  contiguousChunks?: number;
  /** Chunk size this version's checkpoints were taken with. */
  chunkBytes?: number;
  /** When this version was last written to. */
  updatedAt?: number;
}

export interface StoredVersion {
  version: string;
  bytes: number;
  meta: VersionMeta | null;
  active: boolean;
}

/** Product-safe truth from the canonical installation authority. */
export interface InstallationView {
  ready: boolean;
  stored: boolean;
}

/**
 * A file being written continuously, with durability at chosen moments.
 *
 * WHY THIS INTERFACE EXISTS AT ALL. The previous storage path opened a
 * writable, wrote one buffer, and closed it — for every four-megabyte flush.
 * On OPFS `createWritable()` opens a swap file and `close()` commits it, so
 * that pattern paid a full open/commit cycle hundreds of times across one
 * install, and did it on the main thread.
 *
 * A writer is opened ONCE and closed once. `flush()` is the durability
 * checkpoint, called when the caller has something worth being able to resume
 * from, which is a decision the caller is in a position to make and the store
 * is not.
 */
export interface ModelFileWriter {
  /** Write bytes at an absolute offset. */
  write(chunk: Uint8Array, at: number): Promise<boolean>;
  /** Make everything written so far durable. */
  flush(): Promise<boolean>;
  /** Flush and release the handle. */
  close(): Promise<void>;
}

type LegacyStorage = Pick<Storage, "getItem" | "removeItem" | "key" | "length">;

/** Injected so every branch is reachable from a test with no OPFS anywhere. */
export interface VaultDeps {
  store?: ModelStore;
  /** Where an older release left pointers; read once, then cleared. */
  legacy?: LegacyStorage | null;
}

interface Manifest {
  active: string | null;
  previous: string | null;
  meta: Record<string, VersionMeta>;
}

function safeLocal(): LegacyStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The file path for one version's artifact.
 *
 * `version` is the tier's immutable identity — change the model, the
 * quantisation or the publisher's file and it changes — so two versions can
 * never share a directory and an upgrade cannot collide with a cached copy of
 * what it replaces.
 */
export function versionPath(version: string, name: string): string {
  return `${VERSIONS_DIRECTORY}/${sanitiseSegment(version)}/${sanitiseSegment(name)}`;
}

/**
 * One segment of a storage path, with nothing in it that can escape.
 *
 * Version strings come from the committed catalogue and artifact names from a
 * publisher URL. Neither is attacker-controlled today, and both are sanitised
 * anyway: a path traversal in a storage key is not a bug anybody notices until
 * it has already deleted something.
 */
function sanitiseSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^\.+/, "");
  return cleaned.length > 0 ? cleaned.slice(0, 128) : "unnamed";
}

/** A stored meta entry, checked field by field rather than trusted to a cast. */
function validMeta(value: unknown): VersionMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const meta = value as VersionMeta;
  return typeof meta.verified === "boolean" ? meta : null;
}

export class ModelVault {
  private readonly store: ModelStore;
  private readonly legacy: LegacyStorage | null;
  private state: Manifest = { active: null, previous: null, meta: {} };
  private loading: Promise<void> | null = null;
  private saving: Promise<unknown> = Promise.resolve();

  constructor(deps: VaultDeps = {}) {
    this.store = deps.store ?? modelStore;
    this.legacy = deps.legacy === undefined ? safeLocal() : deps.legacy;
  }

  static isSupported(): boolean {
    return ModelStore.isSupported();
  }

  /**
   * Read the manifest before anything is decided. Memoised; `fresh` re-reads
   * it, after this tab's own pending writes land, so another tab's install is
   * seen.
   */
  load(options?: { fresh?: boolean }): Promise<void> {
    if (options?.fresh || !this.loading) {
      this.loading = this.saving.then(() => this.readManifest());
    }
    return this.loading;
  }

  private async readManifest(): Promise<void> {
    const next: Manifest = { active: null, previous: null, meta: {} };
    const blob = await this.store.readBlob(MANIFEST);
    try {
      const parsed = blob ? (JSON.parse(await blob.text()) as Record<string, unknown>) : null;
      if (parsed && typeof parsed === "object") {
        for (const [version, meta] of Object.entries((parsed.meta as object) ?? {})) {
          const valid = validMeta(meta);
          if (valid) next.meta[version] = valid;
        }
        if (typeof parsed.active === "string") next.active = parsed.active;
        if (typeof parsed.previous === "string") next.previous = parsed.previous;
      }
    } catch {
      // A corrupt manifest is no evidence; the files are re-verified instead.
    }
    this.state = next;
    await this.adoptLegacyStorage();
    // A pointer is only as good as the verification record behind it.
    if (this.state.active && !this.state.meta[this.state.active]?.verified) {
      this.state.active = null;
    }
  }

  /** Move an older release's localStorage pointers into the manifest, once. */
  private async adoptLegacyStorage(): Promise<void> {
    const legacy = this.legacy;
    if (!legacy) return;
    const keys: string[] = [];
    try {
      for (let index = 0; index < legacy.length; index += 1) {
        const key = legacy.key(index);
        if (
          key &&
          (key === LEGACY_ACTIVE_KEY ||
            key === LEGACY_PREVIOUS_KEY ||
            LEGACY_PREFIXES.some((p) => key.startsWith(p)))
        ) {
          keys.push(key);
        }
      }
    } catch {
      return;
    }
    if (keys.length === 0) return;

    const prefix = LEGACY_PREFIXES[0]!;
    for (const key of keys.filter((k) => k.startsWith(prefix))) {
      const version = key.slice(prefix.length);
      if (this.state.meta[version]) continue;
      try {
        const meta = validMeta(JSON.parse(legacy.getItem(key) ?? "null"));
        if (meta) this.state.meta[version] = meta;
      } catch {
        /* unreadable legacy metadata is simply not carried over */
      }
    }
    this.state.active ??= legacy.getItem(LEGACY_ACTIVE_KEY) || null;
    this.state.previous ??= legacy.getItem(LEGACY_PREVIOUS_KEY) || null;

    // The old copy goes only once the manifest holds it.
    if (await this.save()) {
      for (const key of keys) {
        try {
          legacy.removeItem(key);
        } catch {
          /* left behind; harmless now that the manifest is the authority */
        }
      }
    }
  }

  /** Write the manifest, one write at a time, replacing the file whole. */
  private save(): Promise<boolean> {
    const run = this.saving.then(() =>
      this.store.writeFile(
        MANIFEST,
        new TextEncoder().encode(
          JSON.stringify({ ...this.state, writtenAt: new Date().toISOString() }),
        ),
      ),
    );
    this.saving = run.catch(() => false);
    return run.catch(() => false);
  }

  /* --------------------------------------------------------- the pointer -- */

  /** The version currently authorised for use, or null when none is. */
  activeVersion(): string | null {
    return this.state.active;
  }

  /** The version that was active before the current one. The rollback target. */
  previousVersion(): string | null {
    return this.state.previous;
  }

  /**
   * Make a version the active one.
   *
   * REFUSES ANYTHING UNVERIFIED, and that refusal is the point of this whole
   * module. A caller that has not proven the digest cannot activate, no matter
   * how complete the file looks, so a truncated or substituted artifact has no
   * path to being loaded — it can only sit in storage until it is repaired or
   * removed.
   */
  async activate(version: string): Promise<boolean> {
    await this.load();
    const meta = this.readMeta(version);
    if (!meta?.verified) return false;

    const current = this.state.active;
    if (current === version) return true;
    // The outgoing version is remembered BEFORE the pointer moves, so a
    // rollback target exists even if this process stops immediately after.
    const before = { active: this.state.active, previous: this.state.previous };
    if (current) this.state.previous = current;
    this.state.active = version;
    // Not durable is not active: the next start would read the old pointer.
    if (await this.save()) return true;
    Object.assign(this.state, before);
    return false;
  }

  /**
   * Go back to the version that was active before.
   *
   * Only possible while the previous version's files are still present, which
   * is why `pruneTo` keeps one generation behind the active one rather than
   * deleting everything that is not current.
   */
  async rollback(): Promise<string | null> {
    await this.load();
    const previous = this.state.previous;
    if (!previous) return null;
    const meta = this.readMeta(previous);
    if (!meta?.verified) return null;
    if ((await this.bytesOf(previous, meta)) <= 0) return null;

    const current = this.state.active;
    this.state.active = previous;
    this.state.previous = current;
    if (await this.save()) return previous;
    this.state.active = current;
    this.state.previous = previous;
    return null;
  }

  /* ------------------------------------------------------------ metadata -- */

  readMeta(version: string): VersionMeta | null {
    return this.state.meta[version] ?? null;
  }

  /** Record metadata; durable once the returned write lands. */
  writeMeta(version: string, meta: VersionMeta | null): Promise<boolean> {
    if (meta === null) delete this.state.meta[version];
    else this.state.meta[version] = { ...meta, updatedAt: Date.now() };
    return this.save();
  }

  /** Merge a patch into a version's metadata without restating the rest. */
  patchMeta(version: string, patch: Partial<VersionMeta>): VersionMeta {
    const current = this.readMeta(version) ?? { verified: false, expectedBytes: null };
    // `verified` is never raised by a patch that does not say so explicitly:
    // bookkeeping updates must not be able to promote an unproven file.
    const next: VersionMeta = { ...current, ...patch };
    this.writeMeta(version, next);
    return next;
  }

  /* --------------------------------------------------------------- files -- */

  async bytesOf(version: string, meta?: VersionMeta | null): Promise<number> {
    await this.load();
    const name = artifactName(meta ?? this.readMeta(version), version);
    return this.store.sizeOf(versionPath(version, name));
  }

  /** The stored artifact for a version, as a Blob the runtime can load. */
  async readArtifact(version: string): Promise<Blob | null> {
    await this.load();
    const meta = this.readMeta(version);
    return this.store.readBlob(versionPath(version, artifactName(meta, version)));
  }

  /**
   * The one answer Settings and first-run presentation may use.
   *
   * A raw OPFS listing cannot say whether an artifact is active, and
   * ModelStore's sidecar metadata predates the versioned authority. Combining
   * either with UI produced the observed contradiction: the active engine was
   * verified in ModelVault while Settings labelled its file "not verified".
   */
  async installationView(): Promise<InstallationView> {
    // Fresh, so an install finished in another tab is seen here.
    await this.load({ fresh: true });
    const active = this.activeVersion();
    if (!active) return { ready: false, stored: false };
    const bytes = await this.bytesOf(active);
    return {
      stored: bytes > 0,
      ready: bytes > 0 && this.readMeta(active)?.verified === true,
    };
  }

  /** Delete one version's files and its metadata. */
  async removeVersion(version: string): Promise<boolean> {
    const meta = this.readMeta(version);
    const removed = await this.store.remove(versionPath(version, artifactName(meta, version)));
    /*
     * THE RECORD GOES ONLY WHEN THE BYTES DO.
     *
     * This cleared the metadata unconditionally, so a deletion the file system
     * refused left hundreds of megabytes on the device with nothing describing
     * them: `listVersions` walks the store and would still find the directory,
     * but the verified digest, the expected length and the fact that this used
     * to be an engine were all discarded — and the uninstall reported success.
     * Asking the store what is actually there is the only honest test.
     */
    if (await this.bytesOf(version, meta)) {
      // Still on disk. The pointers stay too, because they describe something
      // that exists.
      return false;
    }
    delete this.state.meta[version];
    if (this.state.active === version) this.state.active = null;
    if (this.state.previous === version) this.state.previous = null;
    await this.save();
    return removed;
  }

  /**
   * Everything stored under the versioned layout.
   *
   * Walks the real directory rather than the metadata index, so a version whose
   * metadata was lost — private mode, a cleared localStorage, a browser that
   * refuses storage — is still found and can still be repaired or removed. A
   * gigabyte the product cannot see is a gigabyte it cannot be honest about.
   */
  async listVersions(): Promise<StoredVersion[]> {
    await this.load();
    const active = this.activeVersion();
    const files = await this.store.list();
    const byVersion = new Map<string, number>();
    for (const file of files) {
      const parts = file.key.split("/");
      if (parts[0] !== VERSIONS_DIRECTORY || parts.length < 3) continue;
      byVersion.set(parts[1], (byVersion.get(parts[1]) ?? 0) + file.bytes);
    }
    return [...byVersion.entries()]
      .map(([version, bytes]) => ({
        version,
        bytes,
        meta: this.readMeta(version),
        active: version === active,
      }))
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Delete versions that are neither active nor the rollback target.
   *
   * Called after a successful activation. Keeping exactly one generation behind
   * is the trade: two copies of an engine is real disk, and having nothing to
   * fall back to when an upgrade turns out to be bad is worse.
   */
  async pruneTo(keep: string[]): Promise<string[]> {
    const protectedVersions = new Set(
      [...keep, this.activeVersion(), this.previousVersion()].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    );
    const removed: string[] = [];
    for (const stored of await this.listVersions()) {
      if (protectedVersions.has(stored.version)) continue;
      if (await this.removeVersion(stored.version)) removed.push(stored.version);
    }
    return removed;
  }

  /**
   * Leave exactly the active artifact and one verified rollback generation.
   *
   * Successful activation used to prune only version directories. A complete
   * active file could therefore sit beside a legacy flat artifact or an extra
   * staging filename forever, and the raw Settings list showed both. This
   * cleanup walks the real store, protects canonical active/rollback paths, and
   * removes everything else only after an active version is verified.
   */
  async cleanupAfterActivation(activeVersion: string): Promise<string[]> {
    await this.load();
    const activeMeta = this.readMeta(activeVersion);
    if (!activeMeta?.verified || (await this.bytesOf(activeVersion, activeMeta)) <= 0) return [];

    const previous = this.previousVersion();
    const previousMeta = previous ? this.readMeta(previous) : null;
    const protectedVersions = new Set<string>([activeVersion]);
    if (previous && previousMeta?.verified && (await this.bytesOf(previous, previousMeta)) > 0) {
      protectedVersions.add(previous);
    }

    const protectedPaths = new Set([
      MANIFEST,
      ...[...protectedVersions].map((version) =>
        versionPath(version, artifactName(this.readMeta(version), version)),
      ),
    ]);
    const removed: string[] = [];
    const touchedVersions = new Set<string>();

    for (const file of await this.store.list()) {
      const parts = file.key.split("/");
      if (protectedPaths.has(file.key)) continue;

      // Any flat pre-versioning artifact is obsolete once the canonical active
      // artifact exists. Within versioned storage, non-canonical filenames and
      // unprotected versions are staging leftovers, not rollback material.
      if (parts[0] === VERSIONS_DIRECTORY && parts[1]) touchedVersions.add(parts[1]);
      if (await this.store.remove(file.key)) removed.push(file.key);
    }

    for (const version of touchedVersions) {
      if (!protectedVersions.has(version)) delete this.state.meta[version];
    }
    if (previous && !protectedVersions.has(previous)) this.state.previous = null;
    await this.save();
    return removed;
  }

  /**
   * Remove everything OCADE stores as local intelligence.
   *
   * Model artifacts, staging leftovers, version metadata and the pointers —
   * and NOTHING ELSE. Conversations, account data, site preferences and every
   * other origin's storage are untouched, because "remove the engine" and
   * "delete my account" are different requests and a control that quietly did
   * both would be the last one anybody trusted.
   */
  async removeEverything(): Promise<{
    versionsRemoved: number;
    legacyRemoved: number;
    /** Files still on this device afterwards. Zero, or the removal did not happen. */
    remainingFiles: number;
    /** What those files still occupy. */
    remainingBytes: number;
  }> {
    const versions = await this.listVersions();
    let versionsRemoved = 0;
    for (const stored of versions) {
      // `removeVersion` clears the metadata itself, and only for a version
      // whose bytes it can prove are gone.
      if (await this.removeVersion(stored.version)) versionsRemoved += 1;
    }
    // Metadata survives only for files that refused to go.
    this.state.active = null;
    this.state.previous = null;
    if (Object.keys(this.state.meta).length > 0) await this.save();
    else {
      await this.saving;
      await this.store.remove(MANIFEST);
    }

    /*
     * The flat pre-versioning layout is removed too. A user who installed
     * before this existed has hundreds of megabytes under the old keys, and an
     * uninstall that left them would report "removed" over a full disk.
     */
    let legacyRemoved = 0;
    for (const file of await this.store.list()) {
      if (file.key.split("/")[0] === VERSIONS_DIRECTORY) continue;
      if (await this.store.remove(file.key)) legacyRemoved += 1;
    }

    /*
     * WHAT IS ACTUALLY LEFT, ASKED OF THE STORE RATHER THAN INFERRED FROM THE
     * COUNTS. A `remove` that returns false is the case this exists for, and so
     * is one that returns true without the file going anywhere.
     */
    const left = (await this.store.list()).filter((file) => file.key !== MANIFEST);
    return {
      versionsRemoved,
      legacyRemoved,
      remainingFiles: left.length,
      remainingBytes: left.reduce((total, file) => total + file.bytes, 0),
    };
  }

  /** Open a continuously-written file for one version's artifact. */
  async openWriter(version: string, name?: string): Promise<ModelFileWriter | null> {
    await this.load();
    const meta = this.readMeta(version);
    return this.store.openWriter(versionPath(version, name ?? artifactName(meta, version)));
  }
}

/**
 * The filename inside a version's directory.
 *
 * One artifact per version today, named for the version itself, so the
 * directory is self-describing on a storage inspector and two versions can
 * never produce the same path.
 */
function artifactName(meta: VersionMeta | null, version: string): string {
  void meta;
  return `${sanitiseSegment(version)}.bin`;
}

export const modelVault = new ModelVault();
