import { describe, it, expect } from "vitest";
import { readVideoMetadata, TRANSCRIPTION_REALITY } from "../media/video-metadata";

/**
 * Real ISO-BMFF bytes, built box by box, so the parser genuinely walks the
 * structure rather than reading a lucky fixed offset.
 */

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const str = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** A box: [size:4][type:4][payload]. */
function box(type: string, payload: number[]): number[] {
  const size = 8 + payload.length;
  return [...be32(size), ...str(type), ...payload];
}

/** mvhd v0 with a given timescale and duration. Padded to the real 100-byte payload. */
function mvhd(timescale: number, duration: number): number[] {
  const payload = [
    0,
    0,
    0,
    0, // version + flags
    ...be32(0), // creation
    ...be32(0), // modification
    ...be32(timescale),
    ...be32(duration),
  ];
  while (payload.length < 100) payload.push(0);
  return box("mvhd", payload);
}

/** tkhd v0 with width/height as the last 8 bytes (16.16 fixed-point). */
function tkhd(width: number, height: number): number[] {
  const payload: number[] = [0, 0, 0, 3]; // version 0, flags = track enabled
  while (payload.length < 76) payload.push(0); // up to the width/height fields
  payload.push(...be32(width * 65536), ...be32(height * 65536));
  return box("tkhd", payload);
}

function ftyp(brand: string): number[] {
  return box("ftyp", [...str(brand), ...be32(0x200), ...str(brand)]);
}

function mp4(opts: {
  brand?: string;
  timescale?: number;
  duration?: number;
  width?: number;
  height?: number;
  withTrack?: boolean;
}): Uint8Array {
  const {
    brand = "isom",
    timescale = 1000,
    duration = 5000,
    width = 1920,
    height = 1080,
    withTrack = true,
  } = opts;
  const moovChildren = [...mvhd(timescale, duration)];
  if (withTrack) moovChildren.push(...box("trak", tkhd(width, height)));
  return Uint8Array.from([...ftyp(brand), ...box("moov", moovChildren)]);
}

describe("reading MP4/MOV metadata from the bytes", () => {
  it("reads duration and dimensions from a real box structure", () => {
    const r = readVideoMetadata(
      mp4({ timescale: 1000, duration: 5000, width: 1920, height: 1080 }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationSeconds).toBeCloseTo(5, 6);
    expect(r.data.width).toBe(1920);
    expect(r.data.height).toBe(1080);
    expect(r.data.container).toBe("mp4");
    expect(r.evidence).toMatch(/0:05, 1920×1080/);
  });

  it("computes duration from an arbitrary timescale", () => {
    // 90000 ticks/sec is common in MP4; 900000 ticks = 10s.
    const r = readVideoMetadata(mp4({ timescale: 90000, duration: 900000 }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationSeconds).toBeCloseTo(10, 6);
  });

  it("recognises a QuickTime brand as MOV", () => {
    const r = readVideoMetadata(mp4({ brand: "qt  " }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.container).toBe("mov");
  });

  it("finds moov even when it isn't the first box after ftyp", () => {
    // Insert a fake mdat before moov, as progressive files often have.
    const withMdat = Uint8Array.from([
      ...ftyp("isom"),
      ...box("mdat", Array(32).fill(0)),
      ...box("moov", mvhd(1000, 3000)),
    ]);
    const r = readVideoMetadata(withMdat);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationSeconds).toBeCloseTo(3, 6);
  });

  it("reports an audio-only file honestly rather than inventing dimensions", () => {
    const r = readVideoMetadata(mp4({ withTrack: false }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.width).toBeNull();
    expect(r.data.height).toBeNull();
    expect(r.evidence).toMatch(/no video track dimensions|audio-only/i);
  });
});

describe("it refuses what it cannot parse rather than guessing", () => {
  it("refuses a non-MP4 file", () => {
    const notMp4 = Uint8Array.from([...str("RIFF"), 0, 0, 0, 0, ...str("WEBP"), 0, 0, 0, 0]);
    const r = readVideoMetadata(notMp4);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess a duration for a format it hasn't parsed/i);
  });

  it("refuses a file with no moov box", () => {
    const noMoov = Uint8Array.from([...ftyp("isom"), ...box("mdat", Array(16).fill(0))]);
    const r = readVideoMetadata(noMoov);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no moov box/i);
  });

  it("refuses a truncated file rather than reading past the end", () => {
    const full = mp4({});
    const r = readVideoMetadata(full.slice(0, full.length - 40));
    // Either the moov or mvhd read fails; both are honest refusals.
    expect(r.ok).toBe(false);
  });

  it("refuses a zero timescale rather than dividing by it", () => {
    const r = readVideoMetadata(mp4({ timescale: 0, duration: 5000 }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/zero timescale/i);
  });

  it("refuses a file too short to be a container", () => {
    expect(readVideoMetadata(Uint8Array.from([0, 0, 0, 8])).ok).toBe(false);
  });

  it("refuses a truncated mvhd payload instead of reading missing fields as zero", () => {
    const malformed = Uint8Array.from([...ftyp("isom"), ...box("moov", box("mvhd", [0, 0, 0, 0]))]);
    const r = readVideoMetadata(malformed);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated/i);
  });

  it("refuses an unsafe 64-bit duration rather than returning a rounded fiction", () => {
    const payload = [
      1,
      0,
      0,
      0,
      ...Array(16).fill(0),
      ...be32(1000),
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
    ];
    const malformed = Uint8Array.from([...ftyp("isom"), ...box("moov", box("mvhd", payload))]);
    const r = readVideoMetadata(malformed);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/safely|too large/i);
  });
});

describe("it never claims to understand the content", () => {
  it("states plainly that it read metadata, not the video", () => {
    expect(TRANSCRIPTION_REALITY).toMatch(/has NOT transcribed the audio/i);
    expect(TRANSCRIPTION_REALITY).toMatch(/won't invent a transcript/i);
  });
});
