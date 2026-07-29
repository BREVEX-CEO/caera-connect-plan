/**
 * OCADE video metadata (master plan §4.2 "video metadata", §16).
 *
 * Reads the container header of an MP4/MOV file to report its duration and
 * dimensions — from the real box structure, never guessed. This is the honest,
 * buildable half of "video understanding": the metadata is in the bytes and can
 * be read exactly; transcription and scene analysis need audio/vision models
 * that aren't present here, and `TRANSCRIPTION_REALITY` says so rather than
 * pretending.
 *
 * ISO Base Media File Format (MP4/MOV/M4V) only. The design mirrors the image
 * media pack: identify from the bytes, and REFUSE a format that hasn't been
 * tested rather than emit a plausible wrong number. A duration invented for a
 * file OCADE couldn't actually parse is exactly the fabrication the truthfulness
 * contract forbids.
 */

export type VideoOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface VideoMetadata {
  container: "mp4" | "mov";
  durationSeconds: number;
  /** Display dimensions from the track header, when a video track exists. */
  width: number | null;
  height: number | null;
  /** Major brand from ftyp, e.g. "isom", "qt  ". */
  brand: string;
}

const be32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const be64 = (b: Uint8Array, i: number) => be32(b, i) * 2 ** 32 + be32(b, i + 4);
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

interface Box {
  type: string;
  start: number;
  /** Offset of the box's payload (after the header). */
  contentStart: number;
  /** End offset (exclusive). */
  end: number;
}

/**
 * Read the box at `offset`. Returns null when there isn't a complete box header
 * there — which is how truncation is detected rather than read past.
 */
function readBox(b: Uint8Array, offset: number, limit: number): Box | null {
  if (offset + 8 > limit) return null;
  let size = be32(b, offset);
  let headerSize = 8;
  if (size === 1) {
    // 64-bit largesize follows the type.
    if (offset + 16 > limit) return null;
    size = be64(b, offset + 8);
    headerSize = 16;
  } else if (size === 0) {
    // Box extends to end of file.
    size = limit - offset;
  }
  const end = offset + size;
  if (
    !Number.isSafeInteger(size) ||
    !Number.isSafeInteger(end) ||
    size < headerSize ||
    end > limit
  ) {
    return null;
  }
  return { type: fourcc(b, offset + 4), start: offset, contentStart: offset + headerSize, end };
}

/** Find a direct child box by type within [start, end). */
function findChild(b: Uint8Array, start: number, end: number, type: string): Box | null {
  let off = start;
  while (off < end) {
    const box = readBox(b, off, end);
    if (!box) return null;
    if (box.type === type) return box;
    off = box.end;
  }
  return null;
}

/**
 * Extract metadata from an MP4/MOV file's header.
 *
 * Walks ftyp → moov → mvhd (duration) and moov → trak → tkhd (dimensions),
 * exactly. A file that isn't ISO-BMFF, or whose boxes don't parse, is refused.
 */
export function readVideoMetadata(bytes: Uint8Array): VideoOutcome<VideoMetadata> {
  if (bytes.length < 16)
    return { ok: false, reason: "That file is too short to be a video container." };

  const ftyp = readBox(bytes, 0, bytes.length);
  if (!ftyp || ftyp.type !== "ftyp") {
    return {
      ok: false,
      reason:
        "This isn't an MP4/MOV file — it doesn't start with an ftyp box. OCADE reads ISO-BMFF video only, and won't guess a duration for a format it hasn't parsed.",
    };
  }
  if (ftyp.end - ftyp.contentStart < 4) {
    return { ok: false, reason: "This file's ftyp box is truncated before its major brand." };
  }
  const brand = fourcc(bytes, ftyp.contentStart);
  const container: "mp4" | "mov" = brand.startsWith("qt") ? "mov" : "mp4";

  // moov can appear after mdat, so scan the whole file for it.
  const moov = findChild(bytes, 0, bytes.length, "moov");
  if (!moov) {
    return {
      ok: false,
      reason:
        "This MP4 has no moov box in the part OCADE can see. It may be truncated, or the metadata may be at the end (not progressive) — either way the duration can't be read.",
    };
  }

  const mvhd = findChild(bytes, moov.contentStart, moov.end, "mvhd");
  if (!mvhd)
    return {
      ok: false,
      reason: "This file's movie header (mvhd) is missing, so its duration can't be read.",
    };

  // mvhd: version(1) flags(3), then times. v0 uses 32-bit, v1 64-bit.
  const version = bytes[mvhd.contentStart];
  if (version !== 0 && version !== 1) {
    return { ok: false, reason: `This file uses unsupported mvhd version ${version}.` };
  }
  const minimumMvhdBytes = version === 1 ? 32 : 20;
  if (mvhd.end - mvhd.contentStart < minimumMvhdBytes) {
    return { ok: false, reason: "This file's movie header (mvhd) is truncated." };
  }
  let timescale: number;
  let duration: number;
  if (version === 1) {
    timescale = be32(bytes, mvhd.contentStart + 20);
    duration = be64(bytes, mvhd.contentStart + 24);
  } else {
    timescale = be32(bytes, mvhd.contentStart + 12);
    duration = be32(bytes, mvhd.contentStart + 16);
  }
  if (!timescale)
    return {
      ok: false,
      reason: "This file declares a zero timescale, so its duration is unreadable.",
    };
  if (!Number.isSafeInteger(duration)) {
    return {
      ok: false,
      reason: "This file's duration is too large to read safely without losing precision.",
    };
  }

  const durationSeconds = duration / timescale;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return { ok: false, reason: "This file declares an invalid duration." };
  }

  // Dimensions: first trak with a tkhd that has non-zero width/height.
  let width: number | null = null;
  let height: number | null = null;
  let trakOff = moov.contentStart;
  while (trakOff < moov.end) {
    const trak = readBox(bytes, trakOff, moov.end);
    if (!trak) break;
    if (trak.type === "trak") {
      const tkhd = findChild(bytes, trak.contentStart, trak.end, "tkhd");
      if (tkhd) {
        const tver = bytes[tkhd.contentStart];
        const minimumTkhdBytes = tver === 1 ? 96 : tver === 0 ? 84 : Infinity;
        if (tkhd.end - tkhd.contentStart < minimumTkhdBytes) {
          trakOff = trak.end;
          continue;
        }
        // width/height are the last 8 bytes of tkhd, as 16.16 fixed-point.
        const dimsAt = tkhd.end - 8;
        const w = be32(bytes, dimsAt) / 65536;
        const h = be32(bytes, dimsAt + 4) / 65536;
        if (w > 0 && h > 0) {
          width = Math.round(w);
          height = Math.round(h);
          break;
        }
      }
    }
    trakOff = trak.end;
  }

  return {
    ok: true,
    data: { container, durationSeconds, width, height, brand },
    evidence:
      width && height
        ? `${container.toUpperCase()} (${brand.trim()}), ${formatDuration(durationSeconds)}, ${width}×${height}.`
        : `${container.toUpperCase()} (${brand.trim()}), ${formatDuration(durationSeconds)}, no video track dimensions found (may be audio-only).`,
  };
}

function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "unknown length";
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * What OCADE may and may not say about a video's CONTENT.
 *
 * Metadata is read from the bytes; a transcript or scene description is not,
 * because that needs models not present here. Stated so a caller never presents
 * "read the header" as "understood the video".
 */
export const TRANSCRIPTION_REALITY =
  "OCADE has read this video's container metadata — duration and dimensions — directly from the file. It has NOT transcribed the audio or analysed the picture: that needs speech and vision models that aren't available here. OCADE won't invent a transcript or a description it didn't produce.";
