import { describe, it, expect } from "vitest";
import {
  planTransfer,
  planChunks,
  adaptConcurrency,
  retryDelayMs,
  MIN_CONCURRENCY,
  MAX_CONCURRENCY,
  MIN_CHUNK_BYTES,
  MAX_CHUNK_BYTES,
  CONCURRENCY_LADDER,
  MAX_IN_FLIGHT_BYTES,
  concurrencyCeiling,
} from "../download-plan";

const MIB = 1024 * 1024;

describe("the plan adapts to the device instead of using one fixed number", () => {
  it("gives a capable desktop more streams than a phone", () => {
    const desktop = planTransfer({ deviceMemoryGb: 16, cores: 12, downlinkMbps: 50 });
    const phone = planTransfer({ deviceMemoryGb: 2, cores: 4, mobile: true, downlinkMbps: 10 });
    expect(desktop.concurrency).toBeGreaterThan(phone.concurrency);
    expect(desktop.chunkBytes).toBeGreaterThan(phone.chunkBytes);
  });

  it("keeps a phone's peak buffered memory modest", () => {
    const phone = planTransfer({ deviceMemoryGb: 2, cores: 4, mobile: true });
    // Peak in-flight memory is roughly chunk x concurrency; on a 2 GB phone
    // this must stay far away from the allocation that kills the tab.
    expect(phone.chunkBytes * phone.concurrency).toBeLessThanOrEqual(8 * MIB);
  });

  it("never exceeds its own stated bounds, whatever it is told", () => {
    const extremes = [
      { deviceMemoryGb: 128, cores: 256, downlinkMbps: 10_000 },
      { deviceMemoryGb: 0.25, cores: 1, downlinkMbps: 0.1 },
      {},
      { effectiveType: "4g", downlinkMbps: 1000, mobile: false, deviceMemoryGb: 64, cores: 64 },
    ];
    for (const signals of extremes) {
      const plan = planTransfer(signals);
      expect(plan.concurrency).toBeGreaterThanOrEqual(MIN_CONCURRENCY);
      expect(plan.concurrency).toBeLessThanOrEqual(MAX_CONCURRENCY);
      expect(plan.chunkBytes).toBeGreaterThanOrEqual(MIN_CHUNK_BYTES);
      expect(plan.chunkBytes).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it("always produces a chunk size that is a digest checkpoint boundary", () => {
    const signals = [
      { deviceMemoryGb: 16, cores: 8 },
      { mobile: true },
      { saveData: true },
      { effectiveType: "2g" },
      {},
    ];
    for (const s of signals) expect(planTransfer(s).chunkBytes % 64).toBe(0);
  });
});

describe("cellular is allowed — it tunes the transfer, it never postpones it", () => {
  it("still plans a real transfer on a mobile connection", () => {
    const plan = planTransfer({ mobile: true, effectiveType: "4g", downlinkMbps: 8 });
    expect(plan.concurrency).toBeGreaterThanOrEqual(1);
    expect(plan.chunkBytes).toBeGreaterThan(0);
  });

  it("still plans a real transfer when the user asked to save data", () => {
    const plan = planTransfer({ saveData: true, mobile: true });
    // Restraint, not refusal: fewer streams and smaller chunks, but a plan.
    expect(plan.concurrency).toBeGreaterThanOrEqual(1);
    expect(plan.concurrency).toBeLessThanOrEqual(2);
    expect(plan.chunkBytes).toBeLessThanOrEqual(2 * MIB);
  });

  it("still plans a real transfer on 2G, with frequent checkpoints", () => {
    const plan = planTransfer({ effectiveType: "2g" });
    expect(plan.concurrency).toBe(1);
    // Small chunks so an interrupted 2G transfer resumes near where it stopped.
    expect(plan.chunkBytes).toBe(MIN_CHUNK_BYTES);
  });
});

describe("chunk ranges", () => {
  it("covers every byte exactly once with inclusive ends", () => {
    const total = 10 * MIB + 12_345;
    const chunks = planChunks(total, 4 * MIB);
    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1)!.end).toBe(total - 1);
    let expectedStart = 0;
    let covered = 0;
    for (const chunk of chunks) {
      expect(chunk.start).toBe(expectedStart);
      expect(chunk.bytes).toBe(chunk.end - chunk.start + 1);
      covered += chunk.bytes;
      expectedStart = chunk.end + 1;
    }
    expect(covered).toBe(total);
  });

  it("gives a single chunk for a file smaller than one chunk", () => {
    const chunks = planChunks(1000, 4 * MIB);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, start: 0, end: 999, bytes: 1000 });
  });

  it("returns nothing for a size it cannot plan against", () => {
    expect(planChunks(0, 4 * MIB)).toEqual([]);
    expect(planChunks(Number.NaN, 4 * MIB)).toEqual([]);
    expect(planChunks(-5, 4 * MIB)).toEqual([]);
  });

  it("puts every boundary except the last on a 64-byte multiple", () => {
    // Chunk ends are where the running digest is checkpointed, so every
    // boundary but the end of the file must be a SHA-256 block boundary.
    const chunks = planChunks(50 * MIB + 7, 8 * MIB);
    for (const chunk of chunks.slice(0, -1)) expect((chunk.end + 1) % 64).toBe(0);
  });
});

describe("concurrency follows measured throughput, not optimism", () => {
  it("climbs a rung while more streams keep helping", () => {
    const previous = { bytes: 1_000_000, ms: 1000, concurrency: 2 };
    const latest = { bytes: 1_600_000, ms: 1000, concurrency: 4 };
    expect(adaptConcurrency(4, previous, latest)).toBe(8);
  });

  it("steps back a rung when more streams made it worse", () => {
    const previous = { bytes: 2_000_000, ms: 1000, concurrency: 4 };
    const latest = { bytes: 1_200_000, ms: 1000, concurrency: 8 };
    expect(adaptConcurrency(8, previous, latest)).toBe(4);
  });

  it("climbs back when FEWER streams made it worse", () => {
    const previous = { bytes: 2_000_000, ms: 1000, concurrency: 8 };
    const latest = { bytes: 1_000_000, ms: 1000, concurrency: 4 };
    expect(adaptConcurrency(4, previous, latest)).toBe(8);
  });

  it("ignores changes inside the noise floor rather than oscillating", () => {
    /*
     * Five per cent is inside the variation of a single window on any real
     * connection. Chasing it tears down and reopens connections forever.
     */
    const previous = { bytes: 1_000_000, ms: 1000, concurrency: 4 };
    const latest = { bytes: 1_020_000, ms: 1000, concurrency: 8 };
    expect(adaptConcurrency(8, previous, latest)).toBe(8);
  });

  it("only ever stands on a rung, never between two", () => {
    // Every value the transfer can hold is comparable with the next window's,
    // which is what makes a measurement mean anything.
    let concurrency = 4;
    let previous = { bytes: 1_000_000, ms: 1000, concurrency: 2 };
    for (let i = 0; i < 30; i += 1) {
      const latest = { bytes: previous.bytes * (i % 3 === 0 ? 2 : 0.5), ms: 1000, concurrency };
      concurrency = adaptConcurrency(concurrency, previous, latest);
      previous = latest;
      expect(CONCURRENCY_LADDER).toContain(concurrency);
    }
  });

  it("reaches the top of the ladder under a sustained good trend, and stops there", () => {
    let concurrency = 4;
    let previous = { bytes: 1_000_000, ms: 1000, concurrency: 2 };
    for (let i = 0; i < 20; i += 1) {
      const latest = { bytes: previous.bytes * 2, ms: 1000, concurrency };
      concurrency = adaptConcurrency(concurrency, previous, latest);
      previous = latest;
      expect(concurrency).toBeLessThanOrEqual(MAX_CONCURRENCY);
      expect(concurrency).toBeGreaterThanOrEqual(MIN_CONCURRENCY);
    }
    expect(concurrency).toBe(MAX_CONCURRENCY);
  });

  it("holds steady with no previous window to compare against", () => {
    expect(adaptConcurrency(4, null, { bytes: 1_000_000, ms: 1000, concurrency: 4 })).toBe(4);
  });

  it("holds steady on a window that measured nothing", () => {
    const previous = { bytes: 1_000_000, ms: 1000, concurrency: 4 };
    expect(adaptConcurrency(4, previous, { bytes: 0, ms: 0, concurrency: 4 })).toBe(4);
  });
});

describe("streams are bounded by memory, not by enthusiasm", () => {
  it("lets small chunks buy many streams and large chunks buy few", () => {
    /*
     * A chunk is held from the moment it lands until the hasher consumes it, so
     * the product is what matters. Thirty-two streams of sixteen megabytes is
     * half a gigabyte of buffers on a device already allocating for a model.
     */
    expect(concurrencyCeiling(1 * MIB)).toBe(MAX_CONCURRENCY);
    expect(concurrencyCeiling(16 * MIB)).toBe(4);
    expect(concurrencyCeiling(64 * MIB)).toBe(1);
  });

  it("holds every plan under the budget it implies", () => {
    for (const signals of [
      {},
      { mobile: true },
      { cores: 16, deviceMemoryGb: 32, downlinkMbps: 100 },
      { saveData: true },
      { effectiveType: "2g" },
    ]) {
      const plan = planTransfer(signals);
      expect(plan.chunkBytes * plan.concurrency).toBeLessThanOrEqual(MAX_IN_FLIGHT_BYTES);
      expect(CONCURRENCY_LADDER).toContain(plan.concurrency);
    }
  });

  it("never lets adaptation climb past the ceiling it was given", () => {
    const previous = { bytes: 1_000_000, ms: 1000, concurrency: 2 };
    const latest = { bytes: 9_000_000, ms: 1000, concurrency: 4 };
    expect(adaptConcurrency(4, previous, latest, { max: concurrencyCeiling(16 * MIB) })).toBe(4);
  });
});

describe("retry backoff", () => {
  it("grows with each attempt and stops growing at a bound", () => {
    const delays = [1, 2, 3, 4, 5, 8, 12, 20].map((n) => retryDelayMs(n, () => 1));
    for (let i = 1; i < 5; i += 1) expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    expect(delays.at(-1)).toBeLessThanOrEqual(30_000);
  });

  it("jitters, so chunks that failed together do not retry together", () => {
    const low = retryDelayMs(5, () => 0);
    const high = retryDelayMs(5, () => 1);
    expect(low).toBeLessThan(high);
    expect(low).toBeGreaterThan(0);
  });

  it("never returns a negative or zero delay", () => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      expect(retryDelayMs(attempt, () => 0)).toBeGreaterThan(0);
    }
  });
});
