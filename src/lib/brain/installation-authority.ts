/**
 * THE ONE THING THAT INSTALLS OCADE'S LOCAL INTELLIGENCE.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT PRODUCED THE FAILURES WE SAW.
 *
 * There was no authority. There were five independent paths that could each
 * start a download, and they did not know about each other:
 *
 *   - `use-brain.warm()`, fired from the composer's first keystroke;
 *   - `use-local-chat-engine.send()`, which probes and loads on its own;
 *   - the WebGPU adapter's `preload()`;
 *   - the WebAssembly adapter's `preload()`;
 *   - a second, third and fourth browser tab doing all of the above again.
 *
 * Every observed symptom follows directly from that. "Local engine
 * unavailable" showing at the same time as "Preparing OCADE — 62%" is two
 * paths holding two opinions, because `EngineState.status` and
 * `PreparationState.stage` were separate stores that nothing reconciled.
 * `warm()` and `send()` racing is two paths entering `ensureLoaded` at once. A
 * "retrying" label with no retry behind it is a state written by a `catch` that
 * had nothing left to try. Competing downloads across tabs are four paths with
 * no lock between them.
 *
 * So the fix is not another guard in each path. It is that THERE IS ONE PATH,
 * and every surface joins it:
 *
 *     landing page  ─┐
 *     demo          ─┤
 *     signed-in chat ┼──> install() ──> the current operation, or a new one
 *     composer       │
 *     another tab   ─┘
 *
 * `install()` is idempotent and joins. Called twice it returns the same
 * promise. Called from a second tab it observes the first tab's progress rather
 * than starting a competing transfer. Called when the engine is already
 * installed it returns immediately without touching the network.
 *
 * THREE RULES THIS FILE ENFORCES AND NOTHING ELSE MAY BREAK
 *
 * 1. **One state.** There is a single state machine and one published snapshot.
 *    Two surfaces cannot disagree because there is only one thing to read.
 * 2. **Nothing unverified is ever activated.** The transfer computes a digest;
 *    the vault refuses to point at a version whose metadata does not say it
 *    matched. Corrupt bytes have no path to being loaded.
 * 3. **Progress is never silently discarded.** A failure keeps its checkpoint.
 *    Only a digest mismatch removes bytes, and only because weights that are
 *    almost right load happily and answer nonsense.
 */

import {
  planTransfer,
  readDeviceSignals,
  sourceLadder,
  type DownloadSource,
  type TransferPlan,
} from "./download-plan";
import {
  transferModel,
  type TransferCheckpoint,
  type TransferProgress,
  type TransferResult,
} from "./model-transfer";
import { ModelVault, type ModelFileWriter, type VersionMeta } from "./model-vault";
import { recordInstallEvent, type InstallTelemetry } from "./install-telemetry";

/**
 * Every state the installation can be in.
 *
 * EXPLICIT AND EXHAUSTIVE, because the previous design's states were adjectives
 * scattered across two stores and a screen could show two of them at once. A
 * union with one owner cannot do that.
 */
export type InstallStage =
  /** Nothing has been asked for yet. */
  | "idle"
  /** Working out what this device can run. */
  | "checking_device"
  /** Working out whether there is room. */
  | "checking_storage"
  /** Compiling or starting the runtime, in parallel with the transfer. */
  | "preparing_runtime"
  /** Deciding where the bytes come from. */
  | "waiting_for_source"
  /** Bytes are moving. */
  | "downloading"
  /** Deliberately stopped, resumable. */
  | "paused"
  /** A real retry is in flight — never merely a label. */
  | "retrying"
  /** Checking what arrived against its published fingerprint. */
  | "verifying"
  /** The runtime is loading the weights. */
  | "loading"
  /** The runtime is being warmed so the first answer is not a cold start. */
  | "warming"
  /** An engine is ready to answer. */
  | "ready"
  /** Repairing a partial or damaged install. */
  | "repairing"
  /** There is not enough room, and the user can do something about it. */
  | "insufficient_storage"
  /** Something went wrong and trying again is genuinely reasonable. */
  | "recoverable_error"
  /** Every valid path has been tried and none works on this device. */
  | "fatal_error";

/** What a person may be shown. Product language only — never a model name. */
export interface InstallState {
  stage: InstallStage;
  /** 0–1 when a total is known, null when it genuinely is not. */
  fraction: number | null;
  /** Seconds remaining, only when measured. Never invented. */
  etaSeconds: number | null;
  /** One short line, in product language. */
  detail: string | null;
  /** Present on the error stages. Safe to show. */
  problem: string | null;
  /** What the user could do about it. */
  remedies: InstallRemedy[];
  /** True while another tab owns the transfer and this one is watching. */
  observing: boolean;
  /** How many real retries have happened. A "retrying" stage implies > 0. */
  retries: number;
  /** Which capability path was selected, for diagnostics only. */
  path: CapabilityPath | null;
}

export type InstallRemedy =
  | "retry"
  | "free_storage"
  | "remove_local_intelligence"
  | "use_another_device"
  | "pair_a_device"
  | "continue_without";

/**
 * The ladder of ways this device might run OCADE, strongest first.
 *
 * Never a dead end at the top. A device only reaches a refusal after every rung
 * has been tried and reported why it did not work, because "this browser cannot
 * run OCADE" said on the strength of one conservative capability number is a
 * refusal aimed at a device that would have worked.
 */
export type CapabilityPath =
  | "desktop_bridge"
  | "webgpu"
  | "webgpu_reduced"
  | "wasm_threaded"
  | "wasm_single"
  | "paired_device";

export interface CapabilityRung {
  path: CapabilityPath;
  available: boolean;
  /** Measured, not guessed. Shown only in diagnostics. */
  why: string;
}

/** One installable artifact, as the catalogue describes it. */
export interface InstallTarget {
  /** Immutable identity. Changing the weights MUST change this. */
  version: string;
  /** Published size, for planning and the storage pre-check. */
  totalBytes: number | null;
  /** Published digest. Without one, nothing can be reported verified. */
  sha256?: string;
  sources: DownloadSource[];
  /** The pre-versioning key this artifact used to live under, if any. */
  legacyKey?: string | null;
}

export interface AuthorityDeps {
  vault: ModelVault;
  fetchImpl: typeof fetch;
  /** Decide what this device can run, strongest first. */
  probeCapabilities: () => Promise<CapabilityRung[]>;
  /** What to install for the chosen path. Null when the path needs no download. */
  resolveTarget: (path: CapabilityPath) => Promise<InstallTarget | null>;
  /**
   * Load and warm the runtime once the bytes are verified and active.
   *
   * `report` exists for the one runtime that fetches its own weights. The
   * WebGPU engine's library manages its own shard cache, so OCADE has no file
   * to stream and no digest of its own to check there; what it must NOT have is
   * a second, invisible progress story. The runtime reports through this and
   * the authority publishes it as the same `downloading` stage everything else
   * uses, so there is still exactly one state a screen can read.
   */
  activateRuntime: (
    path: CapabilityPath,
    version: string,
    report: (progress: { stage: "downloading" | "loading"; fraction: number | null }) => void,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Remaining quota in bytes, or null when the browser will not say. */
  storageHeadroom: () => Promise<number | null>;
  /** Ask the browser not to evict the weights. */
  requestPersistence: () => Promise<boolean>;
  /**
   * Digest an artifact already on disk, without materialising it.
   *
   * Injected so the verification cost is measurable and the path is reachable
   * from a test with no Blob streaming; the real one is
   * `sha256OfBlobStreaming`. Returns null when it could not be computed, which
   * is NOT a passing check.
   */
  hashBlob: (blob: Blob, signal?: AbortSignal) => Promise<string | null>;
  /** Cross-tab ownership. Resolves when this tab holds the install lock. */
  acquireLock?: (run: () => Promise<void>) => Promise<boolean>;
  /** Publish state to other tabs and receive theirs. */
  broadcast?: (state: InstallState) => void;
  telemetry?: (event: InstallTelemetry) => void;
  now?: () => number;
  /** Injected so the uninstall cooldown is reachable without a browser. */
  readIntent?: () => number | null;
  writeIntent?: (at: number | null) => void;
  deviceSignals?: () => ReturnType<typeof readDeviceSignals>;
  /** Transfer plan override, for tests and for a forced configuration. */
  plan?: TransferPlan;
}

const INITIAL: InstallState = {
  stage: "idle",
  fraction: null,
  etaSeconds: null,
  detail: null,
  problem: null,
  remedies: [],
  observing: false,
  retries: 0,
  path: null,
};

/**
 * How many times an install will retry itself before asking the user.
 *
 * BOUNDED, because an unbounded automatic retry is indistinguishable from a
 * hang: the screen says "retrying" forever and nobody can tell whether to wait
 * or to act. Three attempts covers the transient cases — a handover, a lift, a
 * source having a bad minute — and anything past that is a condition the user
 * needs to know about.
 */
const MAX_AUTOMATIC_ATTEMPTS = 3;

/** Who asked. It decides whether a recent uninstall is respected. */
export type InstallReason =
  | "app_bootstrap"
  | "warm"
  | "resumed"
  | "user_retry"
  | "reinstall"
  | "repair";

/** Triggers nobody pressed. These defer to a deliberate removal. */
const AUTOMATIC_REASONS = new Set<InstallReason>(["app_bootstrap", "warm", "resumed"]);

const UNINSTALL_INTENT_KEY = "ocade.model.uninstalled.at.v1";

/**
 * How long a deliberate removal suppresses automatic reinstallation.
 *
 * Long enough that the removal is real for the rest of the visit and the one
 * after it; short enough that a device someone cleared months ago is not
 * permanently opted out of a product feature they never disabled. A person who
 * wants it back sooner presses Reinstall, which clears this instantly.
 */
export const UNINSTALL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class ModelInstallationAuthority {
  private state: InstallState = INITIAL;
  private readonly listeners = new Set<(state: InstallState) => void>();
  /** The operation in flight. THE reason two callers cannot compete. */
  private running: Promise<InstallState> | null = null;
  private controller: AbortController | null = null;
  private readonly deps: AuthorityDeps;
  private readonly now: () => number;
  private startedAt: number | null = null;
  private ladder: CapabilityRung[] = [];

  constructor(deps: AuthorityDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
  }

  /* -------------------------------------------------------- observation -- */

  snapshot(): InstallState {
    return this.state;
  }

  subscribe(listener: (state: InstallState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** The measured capability ladder, for the diagnostics surface only. */
  capabilities(): CapabilityRung[] {
    return this.ladder;
  }

  /** True when an engine is installed, verified and loaded. */
  isReady(): boolean {
    return this.state.stage === "ready";
  }

  private publish(patch: Partial<InstallState>): void {
    const next = { ...this.state, ...patch };
    if (
      next.stage === this.state.stage &&
      next.fraction === this.state.fraction &&
      next.etaSeconds === this.state.etaSeconds &&
      next.detail === this.state.detail &&
      next.problem === this.state.problem &&
      next.observing === this.state.observing &&
      next.retries === this.state.retries &&
      next.path === this.state.path &&
      next.remedies.length === this.state.remedies.length
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) listener(next);
    this.deps.broadcast?.(next);
  }

  /**
   * Adopt another tab's state.
   *
   * A follower shows what the owner is doing rather than running its own
   * transfer. `observing` is set so a screen can be honest that the work is
   * happening elsewhere — and so the follower never offers a Retry button that
   * would start a second download.
   */
  observe(state: InstallState): void {
    if (this.running) return; // This tab is the owner; its own state wins.
    this.publish({ ...state, observing: true, remedies: [] });
  }

  /* ------------------------------------------------------------- install -- */

  /**
   * Get the local intelligence ready. Safe to call from anywhere, any number
   * of times, from any number of tabs.
   *
   * THE JOIN IS THE WHOLE POINT. Returning the in-flight promise means a
   * keystroke, a route change, a second tab and a background warm-up all wait
   * on the SAME operation. There is no path by which a second download starts.
   */
  install(options?: { reason?: InstallReason }): Promise<InstallState> {
    if (this.state.stage === "ready") return Promise.resolve(this.state);
    if (this.running) return this.running;

    /*
     * AN UNINSTALL THE USER JUST ASKED FOR MUST MEAN SOMETHING.
     *
     * Preparation starts automatically on every visit, which is right — and it
     * would also mean that pressing "Remove OCADE Intelligence" freed a
     * gigabyte and then immediately began downloading it again, behind the
     * user's back, on the same screen. That is not a product removing
     * something; that is a product arguing.
     *
     * So a deliberate removal records an intent, and the AUTOMATIC triggers
     * respect it for a while. Anything the user explicitly asks for — Reinstall,
     * Try again, Repair — clears it immediately, because their asking is the
     * whole point.
     */
    if (AUTOMATIC_REASONS.has(options?.reason ?? "app_bootstrap")) {
      if (this.uninstallIntentActive()) {
        this.publish({
          stage: "idle",
          detail: "OCADE Intelligence is not installed on this device.",
          problem: null,
          remedies: [],
          fraction: null,
        });
        return Promise.resolve(this.state);
      }
    } else {
      this.clearUninstallIntent();
    }

    this.controller = new AbortController();
    this.startedAt = this.now();
    const run = this.runInstall(this.controller.signal).finally(() => {
      this.running = null;
      this.controller = null;
    });
    this.running = run;
    return run;
  }

  /**
   * Stop, keeping everything already downloaded.
   *
   * Explicitly not "cancel and clean up". The bytes on disk and the digest
   * checkpoint beside them are exactly what makes the next attempt cheap, and
   * throwing them away because somebody navigated is how a user pays for the
   * same gigabyte twice.
   */
  pause(): void {
    this.controller?.abort();
    if (this.state.stage !== "ready") {
      this.publish({
        stage: "paused",
        detail: "Preparation paused. OCADE will carry on from here.",
      });
    }
  }

  /** A real retry: a new attempt, not a change of label. */
  async retry(): Promise<InstallState> {
    if (this.running) return this.running;
    this.publish({ stage: "retrying", problem: null, remedies: [], retries: this.state.retries + 1 });
    return this.install({ reason: "user_retry" });
  }

  /* ----------------------------------------------------------- the machine */

  private async runInstall(signal: AbortSignal): Promise<InstallState> {
    /*
     * CROSS-TAB OWNERSHIP FIRST.
     *
     * Whichever tab wins the lock does the work; the others watch. Without
     * this, three open tabs meant three transfers of the same gigabyte
     * competing for the same connection and the same disk — each one slower
     * than a single transfer would have been.
     */
    if (this.deps.acquireLock) {
      let outcome: InstallState = this.state;
      const won = await this.deps.acquireLock(async () => {
        outcome = await this.runOwnedInstall(signal);
      });
      if (!won) {
        this.publish({
          stage: this.state.stage === "idle" ? "checking_device" : this.state.stage,
          observing: true,
          detail: "OCADE is already preparing this device in another window.",
        });
        return this.state;
      }
      return outcome;
    }
    return this.runOwnedInstall(signal);
  }

  private async runOwnedInstall(signal: AbortSignal): Promise<InstallState> {
    const t0 = this.now();

    /* 1. What can this device actually run? */
    this.publish({ stage: "checking_device", observing: false, problem: null, remedies: [] });
    this.ladder = await this.deps.probeCapabilities();
    const usable = this.ladder.filter((rung) => rung.available);
    this.emit({ kind: "device_checked", ms: this.now() - t0, paths: usable.length });

    if (usable.length === 0) {
      /*
       * A REFUSAL ONLY AFTER EVERY RUNG WAS TRIED.
       *
       * The ladder carries a measured reason per rung, so this is a statement
       * about what was attempted rather than a guess from one capability flag.
       * The remedies are the ones that could actually change the outcome.
       */
      return this.fail("fatal_error", this.refusalMessage(), [
        "pair_a_device",
        "use_another_device",
      ]);
    }

    /* 2. Walk the ladder. Each rung gets a real attempt before the next. */
    let lastProblem = "OCADE could not prepare this device.";
    for (const rung of usable) {
      if (signal.aborted) return this.paused();
      const outcome = await this.attemptPath(rung.path, signal);
      if (outcome.ok) return this.state;
      lastProblem = outcome.reason;
      if (outcome.stop) {
        return this.fail(outcome.stage ?? "recoverable_error", outcome.reason, outcome.remedies);
      }
      // A rung that failed for a device reason is not the end; the next rung
      // is a genuinely different way to run, not a retry of the same one.
    }

    return this.fail("recoverable_error", lastProblem, ["retry", "use_another_device"]);
  }

  /** One rung of the ladder, from storage check to a warm engine. */
  private async attemptPath(
    path: CapabilityPath,
    signal: AbortSignal,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: string; stop: boolean; stage?: InstallStage; remedies: InstallRemedy[] }
  > {
    this.publish({ path });
    const target = await this.deps.resolveTarget(path);

    /*
     * A PATH WITH NOTHING TO DOWNLOAD IS STILL A PATH.
     *
     * The desktop bridge and a paired computer already hold the weights. They
     * go straight to activation, which is why "install" is the right verb for
     * all of them and "download" would not be.
     */
    if (target === null) {
      return this.activate(path, "local", signal);
    }

    /* Already installed and verified? Then this is not a download at all. */
    const existing = this.deps.vault.readMeta(target.version);
    const onDisk = await this.deps.vault.bytesOf(target.version);
    if (existing?.verified && onDisk > 0) {
      await this.deps.vault.activate(target.version);
      return this.activate(path, target.version, signal);
    }

    /*
     * A COMPLETE FILE WITH NO PROOF BESIDE IT: HASH IT, DO NOT RE-FETCH IT.
     *
     * Three real situations produce exactly this, and the naive response to all
     * three is to download a gigabyte the device already has:
     *
     *  - the browser was closed after the last byte landed but before the
     *    digest was recorded;
     *  - metadata was lost while the file survived — private mode, a cleared
     *    localStorage, a storage partition reset;
     *  - the SERVICE WORKER fetched it in the background. Background Fetch
     *    writes bytes and deliberately proves nothing about them, because
     *    verification belongs in one place and this is that place.
     *
     * Streaming, so a gigabyte is never materialised. A mismatch removes the
     * file for the reason it always does: weights that are almost right load
     * happily and answer nonsense.
     */
    if (target.totalBytes !== null && onDisk === target.totalBytes && target.sha256) {
      this.publish({ stage: "verifying", fraction: 1 });
      const blob = await this.deps.vault.readArtifact(target.version);
      const digest = blob ? await this.deps.hashBlob(blob, signal) : null;
      if (digest !== null && digest.toLowerCase() === target.sha256.toLowerCase()) {
        this.deps.vault.writeMeta(target.version, {
          verified: true,
          expectedBytes: onDisk,
          sha256: target.sha256,
        });
        await this.deps.vault.activate(target.version);
        this.emit({ kind: "adopted_existing", version: target.version });
        return this.activate(path, target.version, signal);
      }
      if (digest !== null) {
        await this.deps.vault.removeVersion(target.version);
        this.emit({ kind: "digest_mismatch", version: target.version });
      }
      // A digest that could not be computed leaves the bytes alone and falls
      // through to a normal transfer, which will resume over them.
    }

    /*
     * ADOPT A PRE-VERSIONING INSTALL RATHER THAN RE-DOWNLOADING IT.
     *
     * Somebody who already has the engine must not pay for it again because
     * OCADE reorganised its own storage. Only a VERIFIED legacy file is
     * adopted; a partial one falls through to the normal path.
     */
    if (target.legacyKey) {
      const adopted = await this.deps.vault.adoptLegacy(target.legacyKey, target.version, {
        sha256: target.sha256,
        expectedBytes: target.totalBytes,
      });
      if (adopted) {
        this.emit({ kind: "adopted_existing", version: target.version });
        return this.activate(path, target.version, signal);
      }
    }

    /* 3. Room. Checked BEFORE starting, not after failing. */
    this.publish({ stage: "checking_storage" });
    const headroom = await this.deps.storageHeadroom();
    const needed = target.totalBytes === null ? null : Math.ceil(target.totalBytes * 1.1);
    if (headroom !== null && needed !== null && headroom < needed) {
      /*
       * NOT "unsupported". This device is fine; it is full. Those need
       * different words and completely different buttons, and conflating them
       * is how a solvable problem gets presented as a dead end.
       */
      return {
        ok: false,
        reason: "OCADE needs more local storage on this device.",
        stop: true,
        stage: "insufficient_storage",
        remedies: ["free_storage", "remove_local_intelligence", "retry", "use_another_device"],
      };
    }

    /*
     * PERSISTENCE IS ASKED FOR BEFORE THE BYTES ARRIVE, and it does not block.
     *
     * Without it the browser may evict several hundred megabytes under disk
     * pressure and the user re-downloads over whatever connection they are on.
     * Asking first costs one permission check; asking afterwards is asking
     * about something already at risk. It runs alongside the transfer because
     * a browser that is slow to answer must not delay the start.
     */
    const persistence = this.deps.requestPersistence().catch(() => false);

    /* 4. Transfer, with real retries. */
    this.publish({ stage: "waiting_for_source", fraction: null });
    const plan = this.deps.plan ?? planTransfer((this.deps.deviceSignals ?? readDeviceSignals)());
    const sources = target.sources;
    if (sources.length === 0) {
      return {
        ok: false,
        reason: "OCADE has nowhere to fetch this device's intelligence from.",
        stop: true,
        stage: "recoverable_error",
        remedies: ["retry"],
      };
    }

    let writer: ModelFileWriter | null = null;
    let result: TransferResult | null = null;
    const downloadStartedAt = this.now();

    for (let attempt = 1; attempt <= MAX_AUTOMATIC_ATTEMPTS; attempt += 1) {
      if (signal.aborted) return { ok: false, reason: "Paused.", stop: true, remedies: [] };

      writer = await this.deps.vault.openWriter(target.version);
      if (!writer) {
        return {
          ok: false,
          reason:
            "This browser will not let OCADE keep an engine between visits, so it cannot prepare one here.",
          stop: true,
          stage: "fatal_error",
          remedies: ["use_another_device", "pair_a_device"],
        };
      }

      /*
       * A "retrying" STAGE MEANS A RETRY IS ACTUALLY HAPPENING.
       *
       * The old code wrote this label from a catch block that then did nothing,
       * so the screen said "retrying" while the transfer was over. Here it is
       * published on the way INTO attempt 2 and later, which is a real one.
       */
      if (attempt > 1) {
        this.publish({ stage: "retrying", retries: this.state.retries + 1 });
      } else {
        this.publish({ stage: "downloading" });
      }

      const meta = this.deps.vault.readMeta(target.version);
      result = await transferModel(
        {
          sources,
          totalBytes: target.totalBytes,
          sha256: target.sha256,
          plan,
          resume: checkpointFrom(meta, target.totalBytes),
          signal,
          onProgress: (progress) => this.reportProgress(progress),
          onCheckpoint: (checkpoint) => {
            /*
             * Bookkeeping only. `verified` is untouched, so a checkpoint can
             * never promote unproven bytes — it can only make the next attempt
             * cheaper.
             */
            this.deps.vault.patchMeta(target.version, {
              expectedBytes: target.totalBytes,
              sha256: target.sha256,
              digest: checkpoint.digest ?? undefined,
              contiguousChunks: checkpoint.contiguousChunks,
              chunkBytes: checkpoint.chunkBytes,
            });
          },
        },
        { fetchImpl: this.deps.fetchImpl, writer },
      );
      await writer.close();

      if (result.ok) break;

      if (result.failure === "cancelled") return { ok: false, reason: "Paused.", stop: true, remedies: [] };

      if (result.failure === "insufficient_storage") {
        return {
          ok: false,
          reason: "OCADE needs more local storage on this device.",
          stop: true,
          stage: "insufficient_storage",
          remedies: ["free_storage", "remove_local_intelligence", "retry"],
        };
      }

      if (result.failure === "digest_mismatch") {
        /*
         * WHAT ARRIVED IS NOT WHAT WAS PUBLISHED, SO IT IS DELETED.
         *
         * Keeping it so the next attempt can "resume" produces a model that
         * loads and answers nonsense, which is far worse than downloading
         * again. The version's metadata goes with it, including the digest
         * checkpoint — resuming a hash over bytes that are gone would be a
         * mismatch reported against a file that no longer exists.
         *
         * THE ACTIVE ENGINE IS UNTOUCHED. This is a candidate version in its
         * own directory; a failed upgrade cannot take the working install with
         * it, which is the entire reason the layout is versioned.
         */
        await this.deps.vault.removeVersion(target.version);
        this.emit({ kind: "digest_mismatch", version: target.version });
        if (attempt >= MAX_AUTOMATIC_ATTEMPTS) {
          return {
            ok: false,
            reason:
              "What arrived did not match its published fingerprint, so OCADE removed it rather than run it.",
            stop: true,
            stage: "recoverable_error",
            remedies: ["retry"],
          };
        }
        continue;
      }

      if (!result.retriable || attempt >= MAX_AUTOMATIC_ATTEMPTS) {
        return {
          ok: false,
          reason: result.reason,
          stop: true,
          stage: "recoverable_error",
          remedies: ["retry"],
        };
      }
    }

    if (!result?.ok) {
      return { ok: false, reason: "Preparation did not complete.", stop: true, remedies: ["retry"] };
    }

    /* 5. Verify, then activate. In that order, always. */
    this.publish({ stage: "verifying", fraction: 1 });
    if (target.sha256 && !result.verified) {
      /*
       * A DIGEST THAT COULD NOT BE CHECKED IS NOT A PASSING CHECK.
       *
       * `transferModel` returns ok with `verified: false` when it computed
       * nothing — a platform without the primitives, an unreadable stream. That
       * is not permission to activate. The bytes stay on disk so a repair can
       * check them later; nothing points at them in the meantime.
       */
      return {
        ok: false,
        reason: "OCADE could not confirm this device's intelligence, so it will not run it.",
        stop: true,
        stage: "recoverable_error",
        remedies: ["retry"],
      };
    }

    this.deps.vault.writeMeta(target.version, {
      verified: true,
      expectedBytes: result.bytes,
      sha256: target.sha256,
    });
    await this.deps.vault.activate(target.version);
    void persistence;

    this.emit({
      kind: "downloaded",
      version: target.version,
      ms: this.now() - downloadStartedAt,
      bytes: result.bytes,
      resumedBytes: result.resumedFromBytes,
      retries: result.metrics.retries,
      sourceKind: result.source.kind,
      ranged: result.metrics.ranged,
      concurrency: result.metrics.finalConcurrency,
      bytesPerSecond: result.metrics.bytesPerSecond,
    });

    /*
     * The generation before this one is kept, and everything older is not.
     * Two copies of an engine is real disk; having nothing to fall back to when
     * an upgrade turns out to be bad is worse.
     */
    await this.deps.vault.pruneTo([target.version]);

    return this.activate(path, target.version, signal);
  }

  /** Load the runtime and prove it answers, then and only then say ready. */
  private async activate(
    path: CapabilityPath,
    version: string,
    signal: AbortSignal,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: string; stop: boolean; stage?: InstallStage; remedies: InstallRemedy[] }
  > {
    if (signal.aborted) return { ok: false, reason: "Paused.", stop: true, remedies: [] };

    this.publish({ stage: "loading", fraction: 1, etaSeconds: null });
    const loadStartedAt = this.now();
    const loaded = await this.deps.activateRuntime(path, version, (progress) => {
      // Published as the same stages everything else uses, so a runtime that
      // fetches its own weights cannot open a second progress story beside
      // this one.
      this.publish({
        stage: progress.stage,
        fraction: progress.fraction,
        etaSeconds: null,
      });
    });
    if (!loaded.ok) {
      /*
       * THE BYTES ARE FINE; THIS RUNG IS NOT.
       *
       * A runtime that will not start on this device is a reason to try the
       * next rung of the ladder, not a reason to delete a verified engine. So
       * this returns `stop: false` and the caller moves down — reduced-context
       * WebGPU, then threaded WebAssembly, then single-threaded.
       */
      this.emit({ kind: "path_failed", path, reason: loaded.reason });
      return { ok: false, reason: loaded.reason, stop: false, remedies: [] };
    }

    this.publish({ stage: "warming" });
    this.emit({ kind: "loaded", path, ms: this.now() - loadStartedAt });

    this.publish({
      stage: "ready",
      fraction: 1,
      etaSeconds: null,
      detail: "OCADE is ready.",
      problem: null,
      remedies: [],
      observing: false,
    });
    this.emit({
      kind: "ready",
      path,
      msFromStart: this.startedAt === null ? null : this.now() - this.startedAt,
    });
    return { ok: true };
  }

  /* ------------------------------------------------------------- removal -- */

  /**
   * Remove OCADE's local intelligence from this device.
   *
   * WHAT IT TOUCHES AND WHAT IT MUST NOT. Model artifacts, staging leftovers,
   * version metadata and the active pointer. NOT conversations, NOT the
   * account, NOT unrelated site preferences, NOT another origin's storage. A
   * control that quietly did more than it said would be the last one anybody
   * trusted, and "remove the engine" and "delete my account" are different
   * requests that happen to sit near each other on a settings page.
   */
  async uninstall(): Promise<{ ok: boolean; removed: number }> {
    this.controller?.abort();
    this.running = null;
    const result = await this.deps.vault.removeEverything();
    this.ladder = [];
    // Recorded BEFORE the state is published, so nothing observing the change
    // can race ahead and start an automatic install between the two.
    this.recordUninstallIntent();
    this.publish({
      ...INITIAL,
      detail: "OCADE Intelligence has been removed from this device.",
    });
    this.emit({ kind: "uninstalled", removed: result.versionsRemoved + result.legacyRemoved });
    return { ok: true, removed: result.versionsRemoved + result.legacyRemoved };
  }

  /** Put it back, now, because the user asked for it. */
  reinstall(): Promise<InstallState> {
    this.clearUninstallIntent();
    return this.install({ reason: "reinstall" });
  }

  /** True while a deliberate removal is still being honoured. */
  uninstallIntentActive(now: number = this.now()): boolean {
    const at = this.deps.readIntent?.() ?? readIntentFromLocalStorage();
    return at !== null && now - at < UNINSTALL_COOLDOWN_MS;
  }

  private recordUninstallIntent(): void {
    const at = this.now();
    if (this.deps.writeIntent) this.deps.writeIntent(at);
    else writeIntentToLocalStorage(at);
  }

  private clearUninstallIntent(): void {
    if (this.deps.writeIntent) this.deps.writeIntent(null);
    else writeIntentToLocalStorage(null);
  }

  /**
   * Check what is on disk and put it back into a usable state.
   *
   * The case this exists for: a browser closed mid-write, or metadata lost
   * while the file survived. Both leave bytes that are neither trustworthy nor
   * worthless. Repair re-verifies rather than assuming either.
   */
  async repair(): Promise<InstallState> {
    if (this.running) return this.running;
    this.publish({ stage: "repairing", problem: null, remedies: [] });
    for (const stored of await this.deps.vault.listVersions()) {
      const meta = stored.meta;
      // A version with no digest recorded can never be proven, so its bytes are
      // dead weight taking up the user's disk.
      if (!meta?.sha256 && !meta?.verified) await this.deps.vault.removeVersion(stored.version);
    }
    return this.install({ reason: "repair" });
  }

  /* ------------------------------------------------------------ plumbing -- */

  private reportProgress(progress: TransferProgress): void {
    this.publish({
      stage: this.state.stage === "retrying" ? "downloading" : this.state.stage,
      fraction: progress.fraction,
      etaSeconds: progress.etaSeconds,
      detail: null,
    });
  }

  private paused(): InstallState {
    this.publish({ stage: "paused", detail: "Preparation paused." });
    return this.state;
  }

  private fail(stage: InstallStage, problem: string, remedies: InstallRemedy[]): InstallState {
    this.publish({ stage, problem, remedies, detail: null, etaSeconds: null });
    this.emit({ kind: "failed", stage, reason: problem });
    return this.state;
  }

  /**
   * What to say when nothing worked.
   *
   * Names the concrete limitation from the ladder rather than "unsupported
   * device", because a person whose browser blocks storage and a person on a
   * ten-year-old phone need different things, and neither is helped by a
   * sentence that could apply to either.
   */
  private refusalMessage(): string {
    const reasons = this.ladder.map((rung) => rung.why).filter(Boolean);
    if (reasons.length === 0) {
      return "OCADE could not find a way to run its intelligence on this device.";
    }
    return `OCADE tried every way it can run here and none of them worked: ${reasons[0]}`;
  }

  private emit(event: InstallTelemetry): void {
    (this.deps.telemetry ?? recordInstallEvent)(event);
  }
}

/**
 * The uninstall intent, in ordinary browser storage.
 *
 * localStorage rather than the vault, deliberately: it has to survive the vault
 * being emptied, which is the exact event it records.
 */
function readIntentFromLocalStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UNINSTALL_INTENT_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeIntentToLocalStorage(at: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (at === null) window.localStorage.removeItem(UNINSTALL_INTENT_KEY);
    else window.localStorage.setItem(UNINSTALL_INTENT_KEY, String(at));
  } catch {
    /*
     * Without durable storage the removal cannot be remembered across a
     * reload. That is a browser limitation rather than a reason to fail the
     * uninstall itself -- the bytes are still gone.
     */
  }
}

/**
 * Turn stored metadata back into something the transfer can resume from.
 *
 * Returns null unless every part agrees — the chunk count, the chunk size and
 * the total. A partial checkpoint is not a cheaper resume, it is a wrong offset,
 * and a wrong offset produces a digest mismatch on a file that was fine.
 */
export function checkpointFrom(
  meta: VersionMeta | null,
  totalBytes: number | null,
): TransferCheckpoint | null {
  if (!meta || meta.verified) return null;
  if (!meta.contiguousChunks || !meta.chunkBytes) return null;
  if (totalBytes === null || meta.expectedBytes !== totalBytes) return null;
  return {
    contiguousChunks: meta.contiguousChunks,
    digest: meta.digest ?? null,
    chunkBytes: meta.chunkBytes,
    totalBytes,
  };
}

/**
 * One short sentence for a person, derived from the state.
 *
 * PRODUCT LANGUAGE ONLY. Never a model name, a vendor, a file name, a
 * quantisation, a parameter count, a download size, or the words WebGPU or
 * WebAssembly. Somebody meeting OCADE for the first time is not debugging a
 * runtime, and a first-run screen that names a third party's model is telling
 * the user something about OCADE that OCADE does not want to say.
 */
export function describeInstall(state: InstallState): string {
  if (state.problem && isErrorStage(state.stage)) return state.problem;
  switch (state.stage) {
    case "idle":
      return "Starting OCADE…";
    case "checking_device":
      return "Preparing this device…";
    case "checking_storage":
      return "Preparing this device…";
    case "preparing_runtime":
      return "Optimising for this device…";
    case "waiting_for_source":
      return "Preparing OCADE…";
    case "downloading": {
      const pct = state.fraction === null ? null : Math.round(state.fraction * 100);
      return pct === null ? "Preparing OCADE…" : `Preparing OCADE — ${pct}%`;
    }
    case "paused":
      return state.detail ?? "Preparation paused.";
    case "retrying":
      return "Reconnecting — OCADE will carry on from where it stopped…";
    case "verifying":
      return "Securing local intelligence…";
    case "loading":
      return "Starting OCADE…";
    case "warming":
      return "Almost ready…";
    case "ready":
      return "OCADE is ready.";
    case "repairing":
      return "Checking this device…";
    case "insufficient_storage":
      return "OCADE needs more local storage on this device.";
    case "recoverable_error":
      return state.problem ?? "OCADE could not finish preparing this device.";
    case "fatal_error":
      return state.problem ?? "OCADE cannot run its intelligence on this device.";
  }
}

export function isErrorStage(stage: InstallStage): boolean {
  return stage === "insufficient_storage" || stage === "recoverable_error" || stage === "fatal_error";
}

/** True while setup is genuinely in progress — the setup screen's condition. */
export function isPreparing(stage: InstallStage): boolean {
  return (
    stage === "checking_device" ||
    stage === "checking_storage" ||
    stage === "preparing_runtime" ||
    stage === "waiting_for_source" ||
    stage === "downloading" ||
    stage === "retrying" ||
    stage === "verifying" ||
    stage === "loading" ||
    stage === "warming" ||
    stage === "repairing"
  );
}
