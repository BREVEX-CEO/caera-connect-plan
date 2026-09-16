/**
 * How fast to pull, in how many pieces, and from where.
 *
 * SEPARATED FROM THE TRANSFER ITSELF ON PURPOSE. Everything here is a pure
 * decision over measured facts, so the numbers that decide a first-run
 * experience can be argued with in a test instead of discovered on somebody's
 * phone. `model-download.ts` moves bytes; this file decides how.
 *
 * THE RULE THAT SHAPES ALL OF IT: cellular is allowed. OCADE's local engine is
 * the product, not an optional extra, so a mobile connection tunes the transfer
 * and never postpones it. `saveData` is treated the same way — it lowers
 * concurrency because the user has asked for restraint, and it does not cancel
 * the install they came here for.
 *
 * WHY CONCURRENCY IS NOT ONE NUMBER. The bottleneck moves. On a fibre desktop
 * it is the round trip, and more streams help. On a phone it is the radio, the
 * CPU doing the hashing, and the storage writes — and past a handful of streams
 * more connections make it slower while using more battery. So a starting
 * value is chosen from what the device says about itself, and then it is
 * ADJUSTED FROM MEASURED THROUGHPUT, because a device's self-description is a
 * guess and the achieved bytes-per-second is evidence.
 */

/** Everything the plan is allowed to look at. All optional; all may lie. */
export interface DeviceSignals {
  /** `navigator.deviceMemory`, in GB. Coarse and often absent. */
  deviceMemoryGb?: number | null;
  /** `navigator.hardwareConcurrency`. */
  cores?: number | null;
  /** `navigator.connection.effectiveType`: "slow-2g" | "2g" | "3g" | "4g". */
  effectiveType?: string | null;
  /** `navigator.connection.downlink`, in Mbps. */
  downlinkMbps?: number | null;
  /** `navigator.connection.saveData`. */
  saveData?: boolean | null;
  /** True when this looks like a phone or tablet. */
  mobile?: boolean | null;
}

const KIB = 1024;
const MIB = 1024 * KIB;

export interface TransferPlan {
  /** Bytes per ranged request. Always a multiple of 64. */
  chunkBytes: number;
  /** How many ranged requests may be in flight at once. */
  concurrency: number;
  /** Why these numbers, for the diagnostic surface only. */
  because: string;
}

/**
 * Bounds on concurrency, and the reasoning for both ends.
 *
 * ONE is the floor because a single stream must always be a valid plan: it is
 * what a server that ignores `Range` forces, and it is what a 2G connection
 * should get. EIGHT is the ceiling because browsers cap per-origin HTTP/1.1
 * connections around six, and on HTTP/2 more streams past this point stop
 * buying throughput and start competing with the hashing and the disk writes
 * for the same CPU.
 */
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 32;

/**
 * The rungs concurrency is allowed to stand on.
 *
 * A LADDER RATHER THAN A ±1 WALK, because the interesting range is wide and the
 * measurement window is not free. Climbing from four to thirty-two one stream at
 * a time costs twenty-eight windows — minutes — and spends most of them within
 * the noise floor of the step below. The rungs widen as they rise for the same
 * reason: the difference between one and two streams is large, and the
 * difference between twenty-four and twenty-five is not measurable.
 *
 * It is a ladder to climb, NOT a target. Every step up has to be paid for by a
 * measured improvement, and a step that makes things worse is undone on the
 * next window. Thirty-two streams is what a fast link on a capable machine can
 * reach, not what anything starts at.
 */
export const CONCURRENCY_LADDER = [1, 2, 4, 8, 12, 16, 24, 32] as const;

/**
 * How many bytes may be in flight at once, across every stream.
 *
 * A chunk is held in memory from the moment it finishes until the hasher has
 * consumed it, so peak memory is roughly `chunkBytes × concurrency`. Without a
 * bound on the product, the ladder's top rung at the largest chunk size is half
 * a gigabyte of buffers on a device that is already allocating for a model —
 * which is a killed tab, not a fast download.
 *
 * So the ceiling on streams is derived from the chunk size rather than fixed:
 * small chunks buy many streams, large chunks buy few, and either way the
 * transfer holds the same modest amount of memory.
 */
export const MAX_IN_FLIGHT_BYTES = 64 * MIB;

/** The highest rung this chunk size may climb to without exceeding the budget. */
export function concurrencyCeiling(chunkBytes: number): number {
  const affordable = Math.floor(MAX_IN_FLIGHT_BYTES / Math.max(1, chunkBytes));
  return clamp(affordable, MIN_CONCURRENCY, MAX_CONCURRENCY);
}

/** The nearest rung at or below `value`. */
function rungAtOrBelow(value: number): number {
  let chosen: number = CONCURRENCY_LADDER[0];
  for (const rung of CONCURRENCY_LADDER) if (rung <= value) chosen = rung;
  return chosen;
}

/**
 * Chunk size bounds.
 *
 * A chunk is held in memory from the moment it finishes until the hasher has
 * consumed it, so peak memory is roughly `chunkBytes × concurrency`. At the
 * maximum of both that is 128 MB, which is survivable on a desktop and is why
 * mobile gets a smaller chunk AND fewer of them.
 *
 * The floor is 1 MiB: smaller chunks mean more requests, more per-request
 * overhead, and more checkpoint writes than the transfer is worth.
 *
 * Both are multiples of 64 so a completed chunk always lands on a SHA-256
 * block boundary and the digest can be checkpointed there. That is not a
 * detail — it is what makes a resume free instead of a re-read.
 */
export const MIN_CHUNK_BYTES = 1 * MIB;
export const MAX_CHUNK_BYTES = 16 * MIB;

/**
 * Choose a starting plan from what the device will admit about itself.
 *
 * Deliberately conservative when nothing is known. A browser that reports no
 * memory, no cores and no connection is most likely Safari, and Safari runs on
 * phones; guessing high there costs a killed tab, and guessing low costs a few
 * seconds that the adaptation below will win back within one measurement
 * window.
 */
export function planTransfer(signals: DeviceSignals): TransferPlan {
  const cores = clamp(signals.cores ?? 4, 1, 32);
  const memoryGb = signals.deviceMemoryGb ?? (signals.mobile ? 2 : 4);
  const effective = signals.effectiveType ?? null;
  const mobile = signals.mobile === true;

  /*
   * A REALLY slow link gets one stream and small chunks.
   *
   * Not as a punishment and not as a delay: on 2G the link is saturated by a
   * single connection, so extra streams only add handshakes and lengthen the
   * time before the first chunk can be checkpointed. Small chunks there mean
   * progress is recorded often, which is what makes an interrupted 2G transfer
   * resumable rather than a repeated first attempt.
   */
  if (effective === "slow-2g" || effective === "2g") {
    return {
      chunkBytes: MIN_CHUNK_BYTES,
      concurrency: 1,
      because: "a very slow connection, so progress is saved often",
    };
  }

  let concurrency: number;
  let chunkBytes: number;
  let because: string;

  if (mobile || memoryGb <= 2) {
    concurrency = 2;
    chunkBytes = 2 * MIB;
    because = "a mobile or low-memory device, kept within a small memory budget";
  } else if (memoryGb <= 4 || cores <= 4) {
    concurrency = 3;
    chunkBytes = 4 * MIB;
    because = "a modest device";
  } else {
    concurrency = 4;
    chunkBytes = 8 * MIB;
    because = "a capable device";
  }

  /*
   * A KNOWN-FAST LINK EARNS MORE STREAMS, A KNOWN-SLOW ONE FEWER.
   *
   * `downlink` is the browser's own estimate and it is rounded hard, so it is
   * used as a coarse signal rather than a target. Above ~25 Mbps the round
   * trip dominates and parallelism genuinely helps; below ~2 Mbps the pipe is
   * already full.
   */
  if ((signals.downlinkMbps ?? 0) >= 25 && !mobile) {
    concurrency += 2;
    because += " on a fast connection";
  } else if ((signals.downlinkMbps ?? Infinity) < 2) {
    concurrency = Math.max(MIN_CONCURRENCY, concurrency - 1);
    because += " on a slow connection";
  }

  /*
   * SAVE-DATA IS RESPECTED, NOT OBEYED INTO INACTION.
   *
   * The user asked their browser to be frugal, so OCADE uses fewer connections
   * and smaller chunks. It does not cancel the install: the whole point of the
   * on-device engine is that it works later with no network at all, and
   * refusing to prepare it would spend the user's data on nothing.
   */
  if (signals.saveData === true) {
    concurrency = Math.min(concurrency, 2);
    chunkBytes = Math.min(chunkBytes, 2 * MIB);
    because += ", with data saving respected";
  }

  const aligned = alignChunk(chunkBytes);
  return {
    chunkBytes: aligned,
    // Snapped to a rung so the first window is comparable with the next one,
    // and held under the memory budget the chunk size implies.
    concurrency: rungAtOrBelow(clamp(concurrency, MIN_CONCURRENCY, concurrencyCeiling(aligned))),
    because,
  };
}

/** One measurement window: bytes moved in a stretch of wall-clock time. */
export interface ThroughputSample {
  bytes: number;
  ms: number;
  concurrency: number;
}

/**
 * Adjust concurrency from what was actually achieved.
 *
 * The device's self-description is a guess; bytes per second is evidence. The
 * rule is deliberately simple and deliberately slow to move:
 *
 *  - Throughput improved meaningfully after the last change → keep going in
 *    that direction, one step.
 *  - Throughput got meaningfully worse → step back, and stay there. More
 *    connections than the bottleneck can use makes things worse, so having
 *    found the edge, this does not immediately try the same edge again.
 *  - Neither → leave it alone. Oscillating between two values costs
 *    connection setup and buys nothing.
 *
 * FIVE PERCENT IS THE NOISE FLOOR. Below that a change is measurement jitter,
 * and reacting to jitter is how a transfer ends up reconnecting continually on
 * a train.
 */
export function adaptConcurrency(
  current: number,
  previous: ThroughputSample | null,
  latest: ThroughputSample,
  bounds?: { min?: number; max?: number },
): number {
  const min = bounds?.min ?? MIN_CONCURRENCY;
  const max = bounds?.max ?? MAX_CONCURRENCY;
  const settle = (value: number) => rungAtOrBelow(clamp(value, min, max));

  if (latest.ms <= 0 || latest.bytes <= 0) return settle(current);
  if (!previous || previous.ms <= 0) return settle(current);

  const now = latest.bytes / latest.ms;
  const before = previous.bytes / previous.ms;
  if (before <= 0) return settle(current);

  const change = (now - before) / before;
  const direction = Math.sign(latest.concurrency - previous.concurrency);

  /*
   * A CHANGE THIS SMALL IS NOISE, AND CHASING IT COSTS MORE THAN IT WINS.
   *
   * Five per cent is inside the variation of a single window on any real
   * connection. Treating it as evidence makes the transfer oscillate between
   * two rungs forever, tearing down and reopening connections at every step.
   */
  if (Math.abs(change) < 0.05) return settle(current);

  const at = Math.max(0, (CONCURRENCY_LADDER as readonly number[]).indexOf(settle(current)));

  if (change > 0) {
    /*
     * Faster. Keep going the way that made it faster — up a rung if the last
     * step was up, back down if the last step DOWN is what helped, and up one
     * on the very first window because that is the direction worth testing.
     */
    const step = direction === 0 ? 1 : direction;
    return settle(CONCURRENCY_LADDER[clamp(at + step, 0, CONCURRENCY_LADDER.length - 1)]);
  }

  /*
   * Slower. Undo the last step rather than persisting: more streams past the
   * point where they help is not neutral, it is connections competing with the
   * hashing and the disk writes for the same processor.
   */
  const step = direction === 0 ? -1 : -direction;
  return settle(CONCURRENCY_LADDER[clamp(at + step, 0, CONCURRENCY_LADDER.length - 1)]);
}

/** The byte ranges one artifact is fetched in. */
export interface ChunkRange {
  index: number;
  /** Inclusive. */
  start: number;
  /** INCLUSIVE, matching the HTTP Range header this becomes. */
  end: number;
  bytes: number;
}

/**
 * Cut an artifact into ranges.
 *
 * `end` is inclusive because that is what `Range: bytes=start-end` means, and
 * converting between the two conventions at the call site is how an off-by-one
 * gets into a file that then fails its digest for no visible reason.
 *
 * IT HONOURS THE SIZE IT IS GIVEN. `planTransfer` owns the policy about what a
 * sensible chunk is for a real device; this is arithmetic. Clamping here as
 * well made the two disagree — a resume checkpointed at one size would be
 * replanned at another, which is the one thing a resume must never do — and it
 * made the module untestable at any scale below a megabyte. The only rule kept
 * is 64-byte alignment, because a chunk boundary is where the running digest is
 * checkpointed and a checkpoint off a SHA-256 block boundary is not a
 * checkpoint at all.
 */
export function planChunks(totalBytes: number, chunkBytes: number): ChunkRange[] {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return [];
  if (!Number.isFinite(chunkBytes) || chunkBytes < 64) return [];
  const size = Math.floor(chunkBytes) - (Math.floor(chunkBytes) % 64);
  const out: ChunkRange[] = [];
  for (let start = 0, index = 0; start < totalBytes; start += size, index += 1) {
    const end = Math.min(start + size, totalBytes) - 1;
    out.push({ index, start, end, bytes: end - start + 1 });
  }
  return out;
}

/**
 * Where the same bytes may be fetched from, best first.
 *
 * WHY A LADDER AND NOT ONE URL. The previous design had a single publisher URL
 * with an optional same-origin probe in front of it, which made an ordinary
 * first run depend on one third-party host being reachable and fast. A
 * corporate egress policy, a regional outage or a rate limit at that host was
 * therefore an OCADE outage.

 * There is ONE source, and it is OCADE's own authorised link. This described a
 * ladder — a configurable CDN, then a same-origin copy, then the publisher's
 * public host — which is how a customer's browser came to fetch the weights
 * from a public model host. What survives is the shape the transfer engine
 * wants: a list it walks, so an expired link replaced mid-install is a list
 * with a different entry rather than a different code path.
 */
export interface DownloadSource {
  url: string;
  /** For telemetry and diagnostics. Never shown in ordinary UI. */
  kind: "ocade";
}

/**
 * How long to wait before attempt number `attempt`, with jitter.
 *
 * Exponential and BOUNDED. An unbounded backoff on a phone that has walked out
 * of signal becomes a transfer that never resumes when signal returns, and a
 * fixed delay from every tab at once is a stampede at the origin. The jitter
 * is full-range on purpose: it is what stops several chunks that failed
 * together from retrying together forever.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 500 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base / 2 + random() * (base / 2));
}

/** Read what the browser will say about this device. Never throws. */
export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
  };
  let mobile: boolean | null = null;
  try {
    mobile =
      typeof nav.userAgent === "string"
        ? /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(nav.userAgent)
        : null;
  } catch {
    mobile = null;
  }
  return {
    deviceMemoryGb: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? null,
    effectiveType: nav.connection?.effectiveType ?? null,
    downlinkMbps: nav.connection?.downlink ?? null,
    saveData: nav.connection?.saveData ?? null,
    mobile,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Round down to a 64-byte multiple so chunk ends are digest checkpoints. */
function alignChunk(bytes: number): number {
  const clamped = Math.max(MIN_CHUNK_BYTES, Math.min(MAX_CHUNK_BYTES, Math.floor(bytes)));
  return clamped - (clamped % 64);
}
