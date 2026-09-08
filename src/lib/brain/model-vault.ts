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

const ACTIVE_POINTER_KEY = "ocade.model.active.v1";
const PREVIOUS_POINTER_KEY = "ocade.model.previous.v1";
const VERSION_META_PREFIX = "ocade.model.version.v1.";

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

/** Injected so every branch is reachable from a test with no OPFS anywhere. */
export interface VaultDeps {
  store?: ModelStore;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

function safeLocal(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
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

/**
 * The sidecar's shape, as READ. Every field is optional and unvalidated on
 * purpose: this file survives a browser wiping local storage, so it is the one
 * input to this module that has genuinely been out of its hands, and it is
 * checked field by field rather than trusted to a cast.
 */
interface SidecarPayload {
  active?: unknown;
  previous?: unknown;
  meta?: Record<string, unknown>;
}

export class ModelVault {
  private readonly store: ModelStore;
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

  constructor(deps: VaultDeps = {}) {
    this.store = deps.store ?? modelStore;
    this.storage = deps.storage ?? safeLocal();
  }

  static isSupported(): boolean {
    return ModelStore.isSupported();
  }

  /* --------------------------------------------------------- the pointer -- */

  /** The version currently authorised for use, or null when none is. */
  activeVersion(): string | null {
    return this.readPointer(ACTIVE_POINTER_KEY);
  }

  /** The version that was active before the current one. The rollback target. */
  previousVersion(): string | null {
    return this.readPointer(PREVIOUS_POINTER_KEY);
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
    const meta = this.readMeta(version);
    if (!meta?.verified) return false;

    const current = this.activeVersion();
    if (current === version) return true;
    // The outgoing version is remembered BEFORE the pointer moves, so a
    // rollback target exists even if this process stops immediately after.
    if (current) this.writePointer(PREVIOUS_POINTER_KEY, current);
    this.writePointer(ACTIVE_POINTER_KEY, version);
    // The durable copy follows the pointer, never leads it: the sidecar records
    // what happened, and cannot cause it.
    await this.persistPointers();
    return true;
  }

  /**
   * Go back to the version that was active before.
   *
   * Only possible while the previous version's files are still present, which
   * is why `pruneTo` keeps one generation behind the active one rather than
   * deleting everything that is not current.
   */
  async rollback(): Promise<string | null> {
    const previous = this.previousVersion();
    if (!previous) return null;
    const meta = this.readMeta(previous);
    if (!meta?.verified) return null;
    if ((await this.bytesOf(previous, meta)) <= 0) return null;

    const current = this.activeVersion();
    this.writePointer(ACTIVE_POINTER_KEY, previous);
    if (current) this.writePointer(PREVIOUS_POINTER_KEY, current);
    else this.clearPointer(PREVIOUS_POINTER_KEY);
    await this.persistPointers();
    return previous;
  }

  /* ------------------------------------------------------- durable copy -- */

  /**
   * THE POINTERS AND METADATA, WRITTEN WHERE THE MODEL LIVES.
   *
   * PLAN.md §A: "Do not keep the ONLY authoritative active version in
   * `localStorage`." The word that matters is "only". The pointer stays in
   * `localStorage` because `activeVersion()` is synchronous and dozens of call
   * sites depend on that — an async pointer would ripple through the whole
   * engine surface for no safety gain. What was missing is a durable copy
   * beside the bytes it describes.
   *
   * It matters because the two can be destroyed independently. A cleared
   * `localStorage` — private mode, a browser tidying storage, or the
   * `localStorage.clear()` this repository used to run on "sign out
   * everywhere" — left a verified, complete, unusable model in OPFS: the
   * weights were there and the evidence that they had been checked was not, so
   * preparation started again from nothing and downloaded a gigabyte the
   * machine already had.
   *
   * The sidecar lives in the model's own OPFS namespace, so it is removed by
   * exactly the thing that removes the model and by nothing else.
   */
  private sidecarKey(): string {
    return `${VERSIONS_DIRECTORY}/pointers.json`;
  }

  /**
   * Write the sidecar. Failures are silent by design: a browser that will not
   * give OCADE a file handle should not break an activation that has already
   * been proven and recorded.
   */
  async persistPointers(): Promise<boolean> {
    const active = this.activeVersion();
    const previous = this.previousVersion();
    const versions = new Set([active, previous].filter((v): v is string => Boolean(v)));
    const payload = {
      active,
      previous,
      meta: Object.fromEntries(
        [...versions].map((version) => [version, this.readMeta(version)] as const),
      ),
      writtenAt: new Date().toISOString(),
    };
    const writer = await this.store.openWriter(this.sidecarKey());
    if (!writer) return false;
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      await writer.write(bytes, 0);
      await writer.close();
      return true;
    } catch {
      await writer.close().catch(() => undefined);
      return false;
    }
  }

  /**
   * Put the pointers back when `localStorage` has lost them.
   *
   * ONLY FILLS GAPS. A pointer that is present locally is authoritative for
   * this browser and is never overwritten from the sidecar: a stale sidecar
   * must not be able to roll a working install back to an older version.
   *
   * Returns what it restored, so a caller can say so rather than guess.
   */
  async restorePointers(): Promise<{ active: string | null; previous: string | null }> {
    const restored: { active: string | null; previous: string | null } = {
      active: null,
      previous: null,
    };
    if (!this.storage) return restored;

    const blob = await this.store.readBlob(this.sidecarKey());
    if (!blob) return restored;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await blob.text());
    } catch {
      // A corrupt sidecar is no evidence at all, and must not be treated as if
      // it were an empty one that could clear something.
      return restored;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return restored;
    const payload = parsed as SidecarPayload;

    /*
     * Metadata first, then the pointer. `activate()` refuses a version whose
     * metadata does not say verified, and a pointer restored ahead of its
     * metadata would name a version this browser cannot yet justify using.
     */
    for (const [version, meta] of Object.entries(payload.meta ?? {})) {
      if (!meta || typeof meta !== "object") continue;
      if (this.readMeta(version)) continue;
      const candidate = meta as VersionMeta;
      if (typeof candidate.verified !== "boolean") continue;
      this.writeMeta(version, candidate);
    }

    if (typeof payload.active === "string" && payload.active && !this.activeVersion()) {
      // Restored only when the metadata now justifies it, so a sidecar cannot
      // authorise a version this browser has no verification record for.
      if (this.readMeta(payload.active)?.verified === true) {
        this.writePointer(ACTIVE_POINTER_KEY, payload.active);
        restored.active = payload.active;
      }
    }
    if (typeof payload.previous === "string" && payload.previous && !this.previousVersion()) {
      this.writePointer(PREVIOUS_POINTER_KEY, payload.previous);
      restored.previous = payload.previous;
    }
    return restored;
  }

  /* ------------------------------------------------------------ metadata -- */

  readMeta(version: string): VersionMeta | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(VERSION_META_PREFIX + version);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as VersionMeta;
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  writeMeta(version: string, meta: VersionMeta | null): void {
    if (!this.storage) return;
    try {
      if (meta === null) this.storage.removeItem(VERSION_META_PREFIX + version);
      else
        this.storage.setItem(
          VERSION_META_PREFIX + version,
          JSON.stringify({ ...meta, updatedAt: Date.now() }),
        );
    } catch {
      /* No durable metadata means the next attempt re-verifies. Slower, not wrong. */
    }
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
    const name = artifactName(meta ?? this.readMeta(version), version);
    return this.store.sizeOf(versionPath(version, name));
  }

  /** The stored artifact for a version, as a Blob the runtime can load. */
  async readArtifact(version: string): Promise<Blob | null> {
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
    /*
     * THE RECOVERY POINT, and the reason it is here rather than in a startup
     * hook: this is the first thing anything asks about the install, on every
     * surface that cares — the storage panel, the setup control, the runtime.
     * A recovery that runs somewhere else runs only when that somewhere else
     * does.
     *
     * It costs one OPFS read when the pointer is missing, and nothing at all
     * when it is present: `restorePointers` only fills gaps, so on a browser
     * that still has its pointer this is a read of a small file and no writes.
     */
    if (!this.activeVersion()) await this.restorePointers();

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
    this.writeMeta(version, null);
    if (this.activeVersion() === version) this.clearPointer(ACTIVE_POINTER_KEY);
    if (this.previousVersion() === version) this.clearPointer(PREVIOUS_POINTER_KEY);
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
    const activeMeta = this.readMeta(activeVersion);
    if (!activeMeta?.verified || (await this.bytesOf(activeVersion, activeMeta)) <= 0) return [];

    const previous = this.previousVersion();
    const previousMeta = previous ? this.readMeta(previous) : null;
    const protectedVersions = new Set<string>([activeVersion]);
    if (previous && previousMeta?.verified && (await this.bytesOf(previous, previousMeta)) > 0) {
      protectedVersions.add(previous);
    }

    const protectedPaths = new Set(
      [...protectedVersions].map((version) =>
        versionPath(version, artifactName(this.readMeta(version), version)),
      ),
    );
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
      if (!protectedVersions.has(version)) this.writeMeta(version, null);
    }
    if (previous && !protectedVersions.has(previous)) this.clearPointer(PREVIOUS_POINTER_KEY);
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
  async removeEverything(): Promise<{ versionsRemoved: number; legacyRemoved: number }> {
    const versions = await this.listVersions();
    let versionsRemoved = 0;
    for (const stored of versions) {
      if (await this.removeVersion(stored.version)) versionsRemoved += 1;
      // Metadata is cleared even when the file was already gone, so an
      // uninstall leaves no record claiming an engine that is not there.
      this.writeMeta(stored.version, null);
    }
    this.clearPointer(ACTIVE_POINTER_KEY);
    this.clearPointer(PREVIOUS_POINTER_KEY);

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
    return { versionsRemoved, legacyRemoved };
  }

  /**
   * Adopt a completed pre-versioning install as a version.
   *
   * Somebody who already downloaded the engine under the old flat layout must
   * not be made to download it again because OCADE reorganised its own storage.
   * The bytes are already there and already verified against the same digest,
   * so this records them as the active version.
   *
   * ONLY A VERIFIED LEGACY FILE IS ADOPTED. An unverified or partial one is
   * left where it is and the normal install path runs, because adopting bytes
   * on the strength of their length is exactly the shortcut that ships a
   * corrupt engine.
   */
  async adoptLegacy(
    legacyKey: string,
    version: string,
    expectations: { sha256?: string; expectedBytes?: number | null },
  ): Promise<boolean> {
    if (this.readMeta(version)?.verified) return false;
    const legacyMeta = await this.store.readMeta(legacyKey);
    if (!legacyMeta?.verified) return false;
    if (expectations.sha256 && legacyMeta.sha256 && legacyMeta.sha256 !== expectations.sha256) {
      return false;
    }
    const bytes = await this.store.sizeOf(legacyKey);
    if (bytes <= 0) return false;

    const name = artifactName(null, version);
    const moved = await this.store.movePath(legacyKey, versionPath(version, name));
    if (!moved) return false;

    this.writeMeta(version, {
      verified: true,
      expectedBytes: expectations.expectedBytes ?? bytes,
      sha256: expectations.sha256 ?? legacyMeta.sha256,
    });
    await this.activate(version);
    await this.store.writeMeta(legacyKey, null);
    return true;
  }

  /** Open a continuously-written file for one version's artifact. */
  async openWriter(version: string, name?: string): Promise<ModelFileWriter | null> {
    const meta = this.readMeta(version);
    return this.store.openWriter(versionPath(version, name ?? artifactName(meta, version)));
  }

  /* ------------------------------------------------------------ pointers -- */

  private readPointer(key: string): string | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  private writePointer(key: string, value: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, value);
    } catch {
      /*
       * A browser that will not remember which version is active cannot keep
       * an engine between visits. That is reported by the caller as a storage
       * problem rather than pretended past here.
       */
    }
  }

  private clearPointer(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch {
      /* nothing to clear */
    }
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
