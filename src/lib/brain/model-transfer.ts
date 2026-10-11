/**
 * Moving a gigabyte onto a device that keeps changing its mind.
 *
 * WHAT THIS REPLACED. One `fetch`, one `Range` header, one stream appended to
 * one file, and a whole-file `blob.arrayBuffer()` hashed at the end. That works
 * on a desk with fibre and fails on everything else: a single stream leaves
 * most of a fast connection unused, a mid-transfer drop loses everything since
 * the last four-megabyte flush, and the verification step materialises the
 * entire model in memory on the main thread at the exact moment the user has
 * been waiting longest.
 *
 * THE FOUR IDEAS HERE
 *
 * 1. **Chunks, not a stream.** The artifact is cut into ranges. Several are in
 *    flight at once, so a fast link is actually used; each one that lands is a
 *    unit that can be retried on its own, so a failure costs one chunk rather
 *    than the whole transfer.
 *
 * 2. **Hashing is part of the download, not a phase after it.** Chunks are fed
 *    to a running SHA-256 IN ORDER as they become available. When the last byte
 *    arrives the digest is already computed. Nothing is ever re-read, and the
 *    largest allocation is one chunk.
 *
 * 3. **A checkpoint is a place you can actually resume from.** It is taken only
 *    when three things agree: the bytes are durable on disk, the digest state
 *    covers exactly those bytes, and the count of contiguous chunks says so.
 *    Anything past the contiguous frontier is re-fetched, which costs at most
 *    a few chunks and is the reason a resume can never produce a file that
 *    passes its digest with a hole in it.
 *
 * 4. **Sources are a ladder, not a dependency.** A source that fails repeatedly
 *    is rotated away from. Every source is held to the same published digest,
 *    so failover changes where bytes come from and never whether they count.
 *
 * WHAT IT WILL NOT DO. It will not activate anything — it returns a verdict and
 * the caller decides. It will not delete anything. It will not treat a
 * length as evidence. And it will not report `verified` for a digest it could
 * not check: absence of a check is not a passing check.
 */

import {
  adaptConcurrency,
  concurrencyCeiling,
  planChunks,
  retryDelayMs,
  type ChunkRange,
  type DownloadSource,
  type ThroughputSample,
  type TransferPlan,
} from "./download-plan";
import { StreamingSha256, type DigestCheckpoint } from "./streaming-digest";
import type { ModelFileWriter } from "./model-vault";

export type TransferFailure =
  | "cancelled"
  | "network"
  | "storage"
  | "insufficient_storage"
  | "digest_mismatch"
  | "no_source"
  | "size_unknown";

export interface TransferProgress {
  receivedBytes: number;
  totalBytes: number;
  fraction: number;
  /** Bytes already present when this attempt started. */
  resumedFromBytes: number;
  /** Recent throughput in bytes per second, or null before a window closes. */
  bytesPerSecond: number | null;
  /** Estimated seconds remaining, or null when it cannot be measured honestly. */
  etaSeconds: number | null;
}

/** Everything needed to pick a transfer back up exactly where it stopped. */
export interface TransferCheckpoint {
  /** Chunks complete, contiguous from zero. */
  contiguousChunks: number;
  /** The running digest over exactly those chunks. */
  digest: DigestCheckpoint | null;
  /** The chunk size those counts were taken with. */
  chunkBytes: number;
  /** Total size the plan was made against. */
  totalBytes: number;
}

export interface TransferRequest {
  sources: DownloadSource[];
  /** Published size. Discovered from the server when absent. */
  totalBytes?: number | null;
  /** The digest the finished artifact must match. */
  sha256?: string;
  plan: TransferPlan;
  /** Where a previous attempt stopped, if there was one. */
  resume?: TransferCheckpoint | null;
  onProgress?: (progress: TransferProgress) => void;
  /**
   * Called when a resumable point is reached. Awaited, because a checkpoint
   * that is not durable before the next chunk overwrites the frontier is a
   * checkpoint that can lie about what is on disk.
   */
  onCheckpoint?: (checkpoint: TransferCheckpoint) => void | Promise<void>;
  signal?: AbortSignal;
  /** Attempts per chunk before the whole transfer gives up. */
  maxAttemptsPerChunk?: number;
  /**
   * Mint a fresh link when the current one has expired.
   *
   * THE PRICE OF A LINK THAT EXPIRES. Authorised delivery means the URL stops
   * working after a few hours, and a transfer on a slow connection can outlive
   * one. Without this the expiry is indistinguishable from a refusal: five
   * attempts against a dead URL, a failed install, and a person told the
   * download broke when nothing was wrong with it.
   *
   * Returning null means the caller could not mint one — offline, signed out —
   * and the transfer stops with its checkpoint intact rather than spinning.
   */
  refreshSources?: () => Promise<DownloadSource[] | null>;
}

export interface TransferMetrics {
  /** Milliseconds from start to the first byte of the first chunk. */
  firstByteMs: number | null;
  /** Milliseconds spent transferring. */
  totalMs: number;
  /** Chunk-level retries. */
  retries: number;
  /** How many times the transfer fell through to a different source. */
  sourceSwitches: number;
  /** Whether the server honoured Range. */
  ranged: boolean;
  /** Concurrency the transfer settled on. */
  finalConcurrency: number;
  bytesPerSecond: number | null;
}

export type TransferResult =
  | {
      ok: true;
      bytes: number;
      /** True only when a published digest was checked AND matched. */
      verified: boolean;
      /** The computed digest, or null when it could not be computed. */
      digest: string | null;
      resumedFromBytes: number;
      source: DownloadSource;
      metrics: TransferMetrics;
    }
  | {
      ok: false;
      failure: TransferFailure;
      reason: string;
      /** True when trying again is a reasonable thing to do. */
      retriable: boolean;
      /** Progress worth keeping, so the caller can persist it before stopping. */
      checkpoint: TransferCheckpoint | null;
      metrics: TransferMetrics;
    };

export interface TransferDeps {
  fetchImpl: typeof fetch;
  /** Where the bytes go. Opened and closed by the caller. */
  writer: ModelFileWriter;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const DEFAULT_ATTEMPTS = 5;
/** How often throughput is measured and concurrency reconsidered. */
const SAMPLE_WINDOW_MS = 2500;

/**
 * How much newly contiguous data may accumulate before it is written down.
 *
 * A checkpoint costs a flush, so it is not taken per chunk; this bounds what an
 * interruption can cost. Sixteen megabytes is a few seconds on any connection
 * worth planning for, and the failure and cancellation paths take one on the
 * way out regardless, so this only governs the steady state.
 */
const CHECKPOINT_INTERVAL_BYTES = 16 * 1024 * 1024;

export async function transferModel(
  request: TransferRequest,
  deps: TransferDeps,
): Promise<TransferResult> {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const startedAt = now();

  const metrics: TransferMetrics = {
    firstByteMs: null,
    totalMs: 0,
    retries: 0,
    sourceSwitches: 0,
    ranged: false,
    finalConcurrency: request.plan.concurrency,
    bytesPerSecond: null,
  };
  const finish = <T extends TransferResult>(result: T): T => {
    metrics.totalMs = now() - startedAt;
    return result;
  };

  if (request.sources.length === 0) {
    return finish({
      ok: false,
      failure: "no_source",
      reason: "OCADE has nowhere to fetch this from.",
      retriable: false,
      checkpoint: null,
      metrics,
    });
  }

  let sourceIndex = 0;
  let sources = request.sources;
  const source = () => sources[sourceIndex];
  const rotateSource = (): boolean => {
    if (sourceIndex + 1 >= sources.length) return false;
    sourceIndex += 1;
    metrics.sourceSwitches += 1;
    return true;
  };

  /**
   * Replace an expired link with a fresh one and carry on from the checkpoint.
   *
   * Counted as a source switch because that is what it is from the transfer's
   * point of view: the same bytes, reached a different way.
   */
  let refreshing: Promise<boolean> | null = null;
  const refreshSource = async (): Promise<boolean> => {
    // One refresh in flight, however many chunks noticed the expiry at once.
    // Thirty streams discovering a dead link together must not mint thirty
    // links.
    refreshing ??= (async () => {
      const minted = await request.refreshSources?.().catch(() => null);
      if (!minted || minted.length === 0) return false;
      sources = minted;
      sourceIndex = 0;
      metrics.sourceSwitches += 1;
      return true;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  /* ------------------------------------------------------------- sizing -- */

  let totalBytes = request.totalBytes ?? 0;
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    const discovered = await discoverSize(request, deps, () => source().url);
    if (discovered === null) {
      return finish({
        ok: false,
        failure: "size_unknown",
        reason: "The source would not say how large this is, so OCADE cannot plan the transfer.",
        retriable: true,
        checkpoint: null,
        metrics,
      });
    }
    totalBytes = discovered;
  }

  /*
   * A RESUME MUST USE THE PLAN IT WAS CHECKPOINTED WITH.
   *
   * The checkpoint counts CHUNKS, so reading it with a different chunk size
   * would resume at the wrong byte offset and hash a different span than the
   * digest state covers — producing a mismatch on a file that is perfectly
   * good, which then gets deleted. The device's current preferences only
   * govern a transfer that starts fresh.
   */
  const resumable =
    request.resume && request.resume.totalBytes === totalBytes && request.resume.chunkBytes > 0
      ? request.resume
      : null;
  const chunkBytes = resumable ? resumable.chunkBytes : request.plan.chunkBytes;
  const chunks = planChunks(totalBytes, chunkBytes);
  if (chunks.length === 0) {
    return finish({
      ok: false,
      failure: "size_unknown",
      reason: "This artifact reports a size OCADE cannot plan a transfer against.",
      retriable: false,
      checkpoint: null,
      metrics,
    });
  }

  let nextToHash = Math.min(resumable?.contiguousChunks ?? 0, chunks.length);
  let hasher: StreamingSha256;
  try {
    hasher =
      resumable?.digest && nextToHash > 0
        ? StreamingSha256.resume(resumable.digest)
        : new StreamingSha256();
    if (!resumable?.digest) nextToHash = 0;
  } catch {
    /*
     * A checkpoint that will not load is not a reason to fail; it is a reason
     * to start over. Hashing from zero is slow, and shipping a digest computed
     * from a state nobody could parse would be wrong.
     */
    hasher = new StreamingSha256();
    nextToHash = 0;
  }
  // The hasher's own byte count is the truth about how far verification got.
  const resumedFromBytes = nextToHash > 0 ? hasher.length : 0;

  /*
   * The memory ceiling belongs to the chunks actually in use. A resumed
   * transfer keeps its checkpoint's chunk size, which can be larger than the
   * fresh plan's, and budgeting against the plan let buffers grow past it (F-188).
   */
  const ceiling = concurrencyCeiling(chunkBytes);
  const state = {
    received: resumedFromBytes,
    concurrency: Math.max(1, Math.min(request.plan.concurrency, ceiling)),
  };
  metrics.finalConcurrency = state.concurrency;

  const checkpointNow = (): TransferCheckpoint => ({
    contiguousChunks: nextToHash,
    digest: hasher.checkpoint(),
    chunkBytes,
    totalBytes,
  });
  /**
   * The frontier known to be on disk: where this transfer started, then every frontier a
   * successful flush confirmed. A frontier whose flush failed is never published (C13).
   */
  let durable = checkpointNow();
  const flushedFrontier = async (): Promise<TransferCheckpoint> => {
    if (await deps.writer.flush()) {
      durable = checkpointNow();
      await request.onCheckpoint?.(durable);
    }
    return durable;
  };

  if (request.signal?.aborted) {
    return finish({
      ok: false,
      failure: "cancelled",
      reason: "Preparation stopped.",
      retriable: true,
      checkpoint: checkpointNow(),
      metrics,
    });
  }

  /* ---------------------------------------------------------- already in -- */

  if (nextToHash >= chunks.length) {
    // Everything was already fetched and hashed by a previous attempt; only
    // the verdict is left. Nothing is re-read and nothing is re-fetched.
    return finish(verdict());
  }

  /* ------------------------------------------------------------ progress -- */

  let sampleStart = now();
  let sampleBytes = 0;
  let previousSample: ThroughputSample | null = null;
  let bytesPerSecond: number | null = null;

  const report = () => {
    const remaining = totalBytes - state.received;
    request.onProgress?.({
      receivedBytes: state.received,
      totalBytes,
      fraction: totalBytes > 0 ? Math.min(1, state.received / totalBytes) : 0,
      resumedFromBytes,
      bytesPerSecond,
      /*
       * AN ETA IS SHOWN ONLY WHEN IT HAS BEEN MEASURED.
       *
       * Before the first sampling window closes there is no throughput, and
       * dividing by a guess produces the "3 hours remaining" that appears for
       * two seconds at the start of every download and teaches people that the
       * number is fiction. Null means "not yet known" and the screen says
       * nothing rather than something invented.
       */
      etaSeconds:
        bytesPerSecond !== null && bytesPerSecond > 0
          ? Math.round(remaining / bytesPerSecond)
          : null,
    });
  };

  const sample = (bytes: number) => {
    state.received += bytes;
    sampleBytes += bytes;
    const elapsed = now() - sampleStart;
    if (elapsed >= SAMPLE_WINDOW_MS && sampleBytes > 0) {
      bytesPerSecond = (sampleBytes / elapsed) * 1000;
      const latest: ThroughputSample = {
        bytes: sampleBytes,
        ms: elapsed,
        concurrency: state.concurrency,
      };
      /*
       * The ceiling is derived from the chunk size rather than fixed, so the
       * ladder can climb without the buffers climbing with it. A chunk is held
       * from the moment it lands until the hasher consumes it, and the product
       * is what a device actually pays.
       */
      state.concurrency = adaptConcurrency(state.concurrency, previousSample, latest, {
        max: ceiling,
      });
      metrics.finalConcurrency = state.concurrency;
      previousSample = latest;
      sampleStart = now();
      sampleBytes = 0;
    }
    report();
  };

  /* ------------------------------------------------------- the transfer -- */

  /** Chunks fetched but not yet hashed. Bounded by the dispatch window. */
  const landed = new Map<number, Uint8Array>();
  let dispatchAt = nextToHash;
  let failure: { failure: TransferFailure; reason: string; retriable: boolean } | null = null;
  let sequentialFallback = false;

  /*
   * DRAINING RUNS ALONGSIDE FETCHING, AND IT HAS TO.
   *
   * The first version of this loop ran the workers to completion and then
   * drained. That deadlocks: a worker that reaches the dispatch window waits
   * for the frontier to advance, the frontier only advances in the drain, and
   * the drain only runs once every worker has returned. Every worker waits for
   * a thing that is waiting for every worker.
   *
   * So a worker drains as soon as it has parked a chunk. `draining` serialises
   * that — two concurrent drains would both read `nextToHash`, both hash the
   * same chunk, and produce a digest over duplicated bytes. It is a mutex, and
   * the fact that JavaScript is single-threaded does not remove the need for
   * one: every `await` inside the drain is a place another worker can enter.
   */
  let draining = false;

  /**
   * Hash, write and release everything that is now contiguous.
   *
   * The order is deliberate: WRITE, then hash, then checkpoint. A checkpoint
   * claims "these bytes are on disk and the digest covers exactly them". A
   * chunk is hashed only once it is on disk, so a refused write leaves the
   * digest at the durable frontier rather than one chunk past it (F-072).
   */
  const drainOnce = async (): Promise<boolean> => {
    while (landed.has(nextToHash)) {
      const bytes = landed.get(nextToHash)!;
      landed.delete(nextToHash);
      const chunk = chunks[nextToHash];
      if (!(await deps.writer.write(bytes, chunk.start))) {
        failure = {
          failure: "insufficient_storage",
          reason: "The browser stopped accepting data, which usually means storage is full.",
          retriable: false,
        };
        return false;
      }
      hasher.update(bytes);
      nextToHash += 1;
    }
    return true;
  };

  /**
   * Drain, then checkpoint if enough new ground has been covered.
   *
   * A CHECKPOINT COSTS A FLUSH, SO IT IS NOT TAKEN PER CHUNK. Every 32 MB of
   * newly contiguous data, or when the frontier reaches the end. That bounds
   * what an interruption can cost to about the same amount, which on any
   * connection worth planning for is a few seconds of re-fetching.
   */
  let sinceCheckpointBytes = 0;
  const drain = async (): Promise<boolean> => {
    if (draining) return true;
    draining = true;
    try {
      const before = nextToHash;
      if (!(await drainOnce())) return false;
      sinceCheckpointBytes += (nextToHash - before) * chunkBytes;
      if (sinceCheckpointBytes >= CHECKPOINT_INTERVAL_BYTES || nextToHash >= chunks.length) {
        sinceCheckpointBytes = 0;
        if (!(await persist())) return false;
      }
      return true;
    } finally {
      draining = false;
    }
  };

  /** Make the frontier durable and tell the caller it may be remembered. */
  const persist = async (): Promise<boolean> => {
    if (!(await deps.writer.flush())) {
      failure = {
        failure: "storage",
        reason: "OCADE could not save what it has downloaded so far.",
        retriable: true,
      };
      return false;
    }
    durable = checkpointNow();
    await request.onCheckpoint?.(durable);
    return true;
  };

  const fetchChunk = async (chunk: ChunkRange): Promise<Uint8Array | null> => {
    const attempts = request.maxAttemptsPerChunk ?? DEFAULT_ATTEMPTS;
    let lastStatus: number | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (request.signal?.aborted) return null;
      try {
        const response = await deps.fetchImpl(source().url, {
          signal: request.signal,
          headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
        });

        if (response.status === 206) {
          metrics.ranged = true;
          const buffer = new Uint8Array(await response.arrayBuffer());
          if (metrics.firstByteMs === null) metrics.firstByteMs = now() - startedAt;
          if (buffer.length !== chunk.bytes) {
            // A short chunk is a broken transfer, not a smaller file. Retried
            // rather than accepted, because accepting it puts a hole in the
            // artifact that only the final digest would catch — after
            // everything else had already been downloaded.
            metrics.retries += 1;
            await sleep(retryDelayMs(attempt, random));
            continue;
          }
          return buffer;
        }

        /*
         * 200 MEANS THE SERVER IGNORED Range AND IS SENDING THE WHOLE FILE.
         *
         * Not an error and not something to retry — it is a different server
         * capability, and it needs a different strategy. Signalled up so the
         * transfer restarts in sequential mode rather than quietly writing a
         * whole file into a chunk-sized hole.
         */
        if (response.status === 200) {
          try {
            await response.body?.cancel();
          } catch {
            /* Nothing to release. */
          }
          sequentialFallback = true;
          return null;
        }

        /*
         * 416 SAYS THE RANGE IS PAST THE END OF THE FILE.
         *
         * With a published size that means the size is wrong or the artifact
         * changed under us. Rotating source is the only useful response; the
         * digest still decides in the end.
         */
        if (response.status === 416) {
          if (!rotateSource()) {
            failure = {
              failure: "network",
              reason: "The source no longer has the expected file.",
              retriable: false,
            };
            return null;
          }
          continue;
        }

        metrics.retries += 1;
        /*
         * AN EXPIRED LINK IS NOT A REFUSAL. Authorised delivery hands out URLs
         * that stop working after a few hours, and a transfer on a slow
         * connection can outlive one. Minting another and carrying on from the
         * checkpoint is the difference between a pause and a failed install.
         */
        if (response.status === 401 || response.status === 403 || response.status === 410) {
          if (await refreshSource()) continue;
        }
        /*
         * A 5xx is the source having a bad moment; a 4xx is the source not
         * having this file. Only the second is worth moving away from
         * immediately — retrying a 404 at the same URL is a slower way to
         * arrive at the same answer.
         */
        lastStatus = response.status;
        if (response.status >= 400 && response.status < 500) rotateSource();
        else if (attempt >= 2) rotateSource();
        await sleep(retryDelayMs(attempt, random));
      } catch (error) {
        if (request.signal?.aborted) return null;
        lastStatus = null;
        metrics.retries += 1;
        /*
         * A NETWORK ERROR IS THE NORMAL CASE, NOT THE EXCEPTIONAL ONE.
         *
         * Wi-Fi to cellular, a lift, a tunnel, a laptop lid. It is retried with
         * backoff at the same source first, because switching networks does not
         * mean the source is bad, and only then rotated.
         */
        if (attempt >= 2) rotateSource();
        await sleep(retryDelayMs(attempt, random));
      }
    }
    // The source refusing is not the connection dropping, and says so (F-104).
    failure = {
      failure: "network",
      reason:
        lastStatus === null
          ? "The connection kept dropping while OCADE was preparing this device."
          : lastStatus === 401 || lastStatus === 403 || lastStatus === 410
            ? "The download link expired and a new one could not be made. Try again."
            : lastStatus >= 500
              ? "OCADE's download service is unavailable right now. Try again shortly."
              : "OCADE's download service does not have this version right now.",
      retriable: true,
    };
    return null;
  };

  /** How many chunks may be outstanding or waiting to be hashed. */
  // Held chunks are the memory cost, so the window never exceeds the ceiling.
  const dispatchWindow = () => Math.max(2, Math.min(state.concurrency * 2, ceiling));

  /**
   * One worker: take the next chunk, fetch it, park it, drain what it unblocked.
   *
   * THE DISPATCH WINDOW IS WHAT BOUNDS MEMORY. Chunks are held from arrival
   * until their turn to be hashed, so without a window one slow chunk at the
   * frontier — while everything behind it succeeds — would buffer the rest of
   * the model in JavaScript memory. That is the exact allocation this whole
   * design exists to avoid. Twice the concurrency keeps every worker fed and no
   * more.
   *
   * A worker that finds the window full YIELDS RATHER THAN EXITS, because the
   * frontier is advanced by its siblings' drains and will move; a worker that
   * finds the queue empty is finished.
   */
  const worker = async (): Promise<void> => {
    for (;;) {
      if (failure || sequentialFallback || request.signal?.aborted) return;
      if (dispatchAt >= chunks.length) return;
      if (dispatchAt >= nextToHash + dispatchWindow()) {
        await sleep(5);
        continue;
      }
      const chunk = chunks[dispatchAt];
      dispatchAt += 1;

      const bytes = await fetchChunk(chunk);
      if (bytes === null) return;
      landed.set(chunk.index, bytes);
      sample(bytes.length);
      // Draining here — not after the pool finishes — is what keeps the
      // frontier moving while other workers are still fetching, and is what
      // stops the window from becoming a deadlock.
      if (!(await drain())) return;
    }
  };

  /*
   * Run the pool once, sized from the plan.
   *
   * Concurrency adapts during the run and the workers read `state.concurrency`
   * through `dispatchWindow`, so a downward adjustment narrows the window and a
   * worker naturally idles rather than being torn down mid-request. Growing the
   * pool starts extra workers alongside the existing ones.
   */
  const pool = new Set<Promise<void>>();
  const spawn = () => {
    const task = worker().finally(() => pool.delete(task));
    pool.add(task);
  };
  for (let i = 0; i < Math.max(1, Math.min(state.concurrency, chunks.length)); i += 1) spawn();

  while (pool.size > 0) {
    await Promise.race(pool);
    if (failure || sequentialFallback || request.signal?.aborted) break;
    // Top the pool back up to whatever concurrency has adapted to.
    const wanted = Math.max(1, Math.min(state.concurrency, chunks.length - dispatchAt));
    while (pool.size < wanted && dispatchAt < chunks.length) spawn();
  }
  await Promise.allSettled([...pool]);

  // A final drain catches anything parked by the last worker to finish.
  if (!failure && !sequentialFallback && !request.signal?.aborted) {
    await drain();
  }

  if (!failure && !sequentialFallback && !request.signal?.aborted && nextToHash < chunks.length) {
    // Every worker returned and the frontier is short: something did not
    // arrive. Reported rather than spun on.
    failure = {
      failure: "network",
      reason: "The transfer stopped making progress.",
      retriable: true,
    };
  }

  /*
   * THE SEQUENTIAL PATH, for a server that will not do ranges.
   *
   * Kept as a genuinely separate strategy rather than as a degraded version of
   * the chunked one. In order by construction, so hashing and checkpointing
   * work exactly as above with none of the window bookkeeping.
   */
  if (sequentialFallback && !failure) {
    landed.clear();
    nextToHash = 0;
    hasher = new StreamingSha256();
    state.received = 0;
    // The source that just answered (rotated to, or freshly minted), not the
    // request's first one, which may be the source that already failed (F-190).
    const sequential = await transferSequentially({
      request: { ...request, sources: [source()] },
      deps,
      chunks,
      totalBytes,
      hasher,
      onWrote: (chunkIndex) => {
        nextToHash = chunkIndex + 1;
      },
      onBytes: (n) => sample(n),
      persist,
      now,
    });
    if (!sequential.ok) {
      failure = sequential.error;
    }
  }

  if (request.signal?.aborted) {
    // Same reasoning as the failure path below: a durable frontier is recorded
    // rather than left for the periodic checkpoint that will not come.
    // Stopping is not discarding.
    const checkpoint = await flushedFrontier();
    return finish({
      ok: false,
      failure: "cancelled",
      reason: "Preparation stopped.",
      retriable: true,
      checkpoint,
      metrics,
    });
  }

  if (failure) {
    /*
     * PERSIST THE FRONTIER ON THE WAY OUT, NOT ONLY AT THE 32 MB CADENCE.
     *
     * Measured in the production-weight harness: a break partway through left a
     * checkpoint covering fewer chunks than were actually complete on disk,
     * because the last periodic checkpoint had been taken some way back and the
     * work since then was never written down. The bytes were there and the next
     * attempt re-fetched them anyway -- which is precisely the "never silently
     * lose valid downloaded progress" rule, broken in the one situation the
     * rule exists for.
     *
     * Only once the flush says those bytes are durable is the caller told about
     * them; a failed flush leaves the last frontier that was (C13).
     */
    const checkpoint = await flushedFrontier();
    return finish({ ...failure, ok: false, checkpoint, metrics });
  }

  if (!(await persist())) {
    return finish({
      ok: false,
      failure: failure ?? "storage",
      reason: "OCADE could not save what it downloaded.",
      retriable: true,
      checkpoint: durable,
      metrics,
    } as TransferResult & { ok: false });
  }

  return finish(verdict());

  /** Compute the digest and decide. Never activates anything. */
  function verdict(): TransferResult {
    metrics.bytesPerSecond = bytesPerSecondOverall();
    let digest: string | null = null;
    try {
      digest = hasher.digest();
    } catch {
      digest = null;
    }
    if (request.sha256) {
      if (digest === null) {
        // Could not check. Reported as UNVERIFIED — never upgraded to verified
        // because nothing contradicted it.
        return {
          ok: true,
          bytes: totalBytes,
          verified: false,
          digest: null,
          resumedFromBytes,
          source: source(),
          metrics,
        };
      }
      if (digest.toLowerCase() !== request.sha256.toLowerCase()) {
        return {
          ok: false,
          failure: "digest_mismatch",
          reason: "What arrived did not match its published fingerprint, so OCADE will not run it.",
          // Worth another attempt from a different source; the caller decides
          // whether the bytes on disk are salvageable.
          retriable: true,
          checkpoint: null,
          metrics,
        };
      }
    }
    return {
      ok: true,
      bytes: totalBytes,
      verified: Boolean(request.sha256) && digest !== null,
      digest,
      resumedFromBytes,
      source: source(),
      metrics,
    };
  }

  function bytesPerSecondOverall(): number | null {
    const elapsed = now() - startedAt;
    const moved = state.received - resumedFromBytes;
    return elapsed > 0 && moved > 0 ? (moved / elapsed) * 1000 : null;
  }
}

/* ------------------------------------------------------------------------ */

/**
 * The whole file, in order, from a server that will not honour Range.
 *
 * Deliberately restarts from zero. A server that ignores Range answers 200 with
 * the complete artifact; appending that to bytes already on disk produces a
 * file of double length that passes every length check and fails its digest —
 * the failure mode that is hardest to explain and easiest to avoid.
 */
async function transferSequentially(input: {
  request: TransferRequest;
  deps: TransferDeps;
  chunks: ChunkRange[];
  totalBytes: number;
  hasher: StreamingSha256;
  onWrote: (chunkIndex: number) => void;
  onBytes: (bytes: number) => void;
  persist: () => Promise<boolean>;
  now: () => number;
}): Promise<
  | { ok: true }
  | { ok: false; error: { failure: TransferFailure; reason: string; retriable: boolean } }
> {
  const { request, deps, chunks, hasher } = input;
  try {
    const response = await deps.fetchImpl(request.sources[0]!.url, { signal: request.signal });
    if (!response.ok || !response.body) {
      return {
        ok: false,
        error: {
          failure: "network",
          reason: `The source answered ${response.status}.`,
          retriable: true,
        },
      };
    }

    const reader = response.body.getReader();
    /*
     * Bytes are accumulated to a chunk boundary before being hashed and
     * written, so the checkpoints this path produces mean exactly what the
     * chunked path's mean — and a transfer interrupted here can be resumed by
     * the chunked path later, and the other way round.
     */
    let pending: Uint8Array[] = [];
    let pendingBytes = 0;
    let chunkIndex = 0;
    let written = 0;

    const commit = async (bytes: Uint8Array): Promise<boolean> => {
      hasher.update(bytes);
      if (!(await deps.writer.write(bytes, written))) return false;
      written += bytes.length;
      input.onWrote(chunkIndex);
      chunkIndex += 1;
      return true;
    };

    for (;;) {
      if (request.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      pending.push(value);
      pendingBytes += value.length;
      input.onBytes(value.length);

      while (chunkIndex < chunks.length && pendingBytes >= chunks[chunkIndex].bytes) {
        const need = chunks[chunkIndex].bytes;
        const merged = new Uint8Array(new ArrayBuffer(pendingBytes));
        let at = 0;
        for (const part of pending) {
          merged.set(part, at);
          at += part.length;
        }
        if (!(await commit(merged.subarray(0, need)))) {
          return {
            ok: false,
            error: {
              failure: "insufficient_storage",
              reason: "The browser stopped accepting data, which usually means storage is full.",
              retriable: false,
            },
          };
        }
        const rest = merged.subarray(need);
        pending = rest.length > 0 ? [new Uint8Array(rest)] : [];
        pendingBytes = rest.length;
        if (chunkIndex % 8 === 0) await input.persist();
      }
    }

    if (pendingBytes > 0 && chunkIndex < chunks.length) {
      const merged = new Uint8Array(new ArrayBuffer(pendingBytes));
      let at = 0;
      for (const part of pending) {
        merged.set(part, at);
        at += part.length;
      }
      if (!(await commit(merged))) {
        return {
          ok: false,
          error: {
            failure: "insufficient_storage",
            reason: "The browser stopped accepting data, which usually means storage is full.",
            retriable: false,
          },
        };
      }
    }
    return { ok: true };
  } catch (error) {
    if (request.signal?.aborted) {
      return { ok: false, error: { failure: "cancelled", reason: "Stopped.", retriable: true } };
    }
    return {
      ok: false,
      error: {
        failure: "network",
        reason: `The transfer was interrupted: ${
          error instanceof Error ? error.message : String(error)
        }`,
        retriable: true,
      },
    };
  }
}

/**
 * Ask the source how large the artifact is, without downloading it.
 *
 * A one-byte ranged GET rather than a HEAD: some object stores and CDNs answer
 * HEAD differently from GET, or not at all, and `Content-Range` on a 206
 * carries the total in a form that cannot be confused with a chunk length.
 * Falls back to `Content-Length` on a 200, which is only correct because the
 * response is discarded immediately.
 */
async function discoverSize(
  request: TransferRequest,
  deps: TransferDeps,
  url: () => string,
): Promise<number | null> {
  try {
    const response = await deps.fetchImpl(url(), {
      signal: request.signal,
      headers: { Range: "bytes=0-0" },
    });
    try {
      await response.body?.cancel();
    } catch {
      /* Nothing to release. */
    }
    const range = response.headers.get("content-range");
    const match = range ? /\/(\d+)\s*$/.exec(range) : null;
    if (match) {
      const total = Number(match[1]);
      if (Number.isFinite(total) && total > 0) return total;
    }
    const length = Number(response.headers.get("content-length") ?? "");
    if (response.status === 200 && Number.isFinite(length) && length > 0) return length;
    return null;
  } catch {
    return null;
  }
}
