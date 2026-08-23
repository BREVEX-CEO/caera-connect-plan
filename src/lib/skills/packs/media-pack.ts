/**
 * Media skill pack — a REAL, executed adapter for the graphics/video/audio
 * category.
 *
 * Scope, stated plainly: this pack **inspects** image files — format,
 * dimensions, and whether the contents match the file extension. It does not
 * drive Photoshop, Blender, Premiere or any other creative application, and it
 * does not edit, re-encode or export anything. `coverageNote` says so.
 *
 * It reads bytes, never the file name. A `.png` that is actually a JPEG is
 * common and harmless; a `.png` that is actually an HTML document is how a
 * file-upload becomes a stored XSS. The extension is what someone claimed; the
 * magic bytes are what the file is, and only one of those is evidence.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "media.identify",
    label: "Identify an image from its contents",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "media.dimensions",
    label: "Read an image's real size",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "media.check_extension",
    label: "Check a file is what its name claims",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
];

export const MEDIA_PACK: SkillPack = {
  appId: "ocade.media",
  displayName: "Image files",
  category: "graphics_media",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Inspects image files only — format, size and whether the contents match the name. OCADE cannot operate Photoshop, Illustrator, Blender or any other editor application, and does not edit or export images. Video trimming, cropping and captioning are a separate pack (ocade.video.local) that drives a local encoder.",
};

export type MediaOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "bmp";

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
  /** Megapixels, for spotting a file that will exhaust memory on decode. */
  megapixels: number;
}

const MAGIC: { format: ImageFormat; bytes: number[]; offset: number }[] = [
  { format: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  { format: "jpeg", bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { format: "gif", bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  { format: "bmp", bytes: [0x42, 0x4d], offset: 0 },
  // WebP is "RIFF" then 4 size bytes then "WEBP" — both parts must match.
  { format: "webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

function matches(bytes: Uint8Array, magic: { bytes: number[]; offset: number }): boolean {
  if (bytes.length < magic.offset + magic.bytes.length) return false;
  return magic.bytes.every((b, i) => bytes[magic.offset + i] === b);
}

/** Identify from content alone. Returns null when nothing matches. */
export function identifyFormat(bytes: Uint8Array): ImageFormat | null {
  if (matches(bytes, { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 })) {
    const webp = MAGIC.find((m) => m.format === "webp")!;
    return matches(bytes, webp) ? "webp" : null;
  }
  return MAGIC.find((m) => m.format !== "webp" && matches(bytes, m))?.format ?? null;
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le32 = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/**
 * Walk JPEG segments to the frame header.
 *
 * The dimensions are not at a fixed offset: they sit in an SOF marker that can
 * be preceded by any number of EXIF, comment and quantisation segments. Reading
 * a fixed offset produces a plausible-looking wrong number.
 */
function jpegSize(b: Uint8Array): MediaOutcome<{ width: number; height: number }> {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      return {
        ok: false,
        reason: "This JPEG's segment structure is damaged — OCADE can't read its size.",
      };
    }
    const marker = b[i + 1];
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = be16(b, i + 2);
    if (length < 2) {
      return {
        ok: false,
        reason: "This JPEG has an invalid segment length — the file is corrupt.",
      };
    }
    // SOF0–SOF15, excluding the non-frame markers in that range.
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      return {
        ok: true,
        data: { height: be16(b, i + 5), width: be16(b, i + 7) },
        evidence: "from the frame header",
      };
    }
    if (marker === 0xda) break; // scan data: dimensions come before it
    i += 2 + length;
  }
  return {
    ok: false,
    reason: "This JPEG has no frame header, so it's truncated or not really a JPEG.",
  };
}

function webpSize(b: Uint8Array): MediaOutcome<{ width: number; height: number }> {
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8X" && b.length >= 30) {
    // 24-bit little-endian, stored as (value - 1).
    const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { ok: true, data: { width: w, height: h }, evidence: "from the extended header" };
  }
  if (chunk === "VP8 " && b.length >= 30) {
    return {
      ok: true,
      data: { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff },
      evidence: "from the VP8 header",
    };
  }
  if (chunk === "VP8L" && b.length >= 25) {
    const bits = le32(b, 21);
    return {
      ok: true,
      data: { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 },
      evidence: "from the lossless header",
    };
  }
  return {
    ok: false,
    reason: `This WebP uses a “${chunk.trim()}” chunk OCADE hasn't been tested against, so it won't report a size it isn't sure of.`,
  };
}

/**
 * Read an image's format and true dimensions from its bytes.
 *
 * Every failure path names what was wrong rather than returning zeros: a 0×0
 * image reads as a measurement, and something downstream will divide by it.
 */
export function inspectImage(bytes: Uint8Array): MediaOutcome<ImageInfo> {
  if (bytes.length === 0) return { ok: false, reason: "That file is empty." };

  const format = identifyFormat(bytes);
  if (!format) {
    return {
      ok: false,
      reason:
        "OCADE doesn't recognise this file as an image it has been tested with (PNG, JPEG, GIF, WebP or BMP). It won't guess from the file name.",
    };
  }

  let size: MediaOutcome<{ width: number; height: number }>;
  switch (format) {
    case "png":
      if (bytes.length < 24) {
        size = { ok: false, reason: "This PNG is truncated before its header." };
      } else if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") {
        size = {
          ok: false,
          reason: "This PNG's first chunk isn't IHDR, so the file is malformed.",
        };
      } else {
        size = {
          ok: true,
          data: { width: be32(bytes, 16), height: be32(bytes, 20) },
          evidence: "from IHDR",
        };
      }
      break;
    case "jpeg":
      size = jpegSize(bytes);
      break;
    case "gif":
      size =
        bytes.length < 10
          ? { ok: false, reason: "This GIF is truncated before its header." }
          : {
              ok: true,
              data: { width: le16(bytes, 6), height: le16(bytes, 8) },
              evidence: "from the screen descriptor",
            };
      break;
    case "webp":
      size = bytes.length < 16 ? { ok: false, reason: "This WebP is truncated." } : webpSize(bytes);
      break;
    case "bmp":
      size =
        bytes.length < 26
          ? { ok: false, reason: "This BMP is truncated before its header." }
          : {
              ok: true,
              // Height is signed: a negative value means top-down row order.
              data: { width: le32(bytes, 18), height: Math.abs(le32(bytes, 22) | 0) },
              evidence: "from the DIB header",
            };
      break;
  }

  if (!size.ok) return size;

  const { width, height } = size.data;
  if (width <= 0 || height <= 0) {
    return {
      ok: false,
      reason: `This file reports ${width}×${height}, which isn't a real image size.`,
    };
  }

  const megapixels = (width * height) / 1_000_000;
  return {
    ok: true,
    data: { format, width, height, megapixels },
    evidence: `${format.toUpperCase()}, ${width}×${height} (${megapixels.toFixed(1)} MP), read ${size.evidence}.`,
  };
}

/* ------------------------------------------------------------- extension -- */

export interface ExtensionCheck {
  claimed: string;
  actual: ImageFormat | null;
  matches: boolean;
}

const EXTENSION_ALIASES: Record<string, ImageFormat> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  gif: "gif",
  webp: "webp",
  bmp: "bmp",
  dib: "bmp",
};

/**
 * Does this file's content match the name it was given?
 *
 * A mismatch is reported, never corrected. The safe response to "this .png is
 * actually something else" is to tell the user, not to rename it — the file may
 * be exactly what someone intended it to be.
 */
export function checkExtension(fileName: string, bytes: Uint8Array): MediaOutcome<ExtensionCheck> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ext || ext === fileName.toLowerCase()) {
    return {
      ok: false,
      reason: `“${fileName}” has no extension, so there's nothing to check it against.`,
    };
  }

  const actual = identifyFormat(bytes);
  const expected = EXTENSION_ALIASES[ext];

  if (!expected) {
    return {
      ok: false,
      reason: `OCADE hasn't been tested with “.${ext}” files, so it won't judge whether this one is genuine.`,
    };
  }

  if (actual === null) {
    return {
      ok: true,
      data: { claimed: ext, actual: null, matches: false },
      evidence: `“${fileName}” claims to be a ${ext.toUpperCase()} but its contents aren't any image format OCADE recognises. Treat it as untrusted.`,
    };
  }

  const ok = actual === expected;
  return {
    ok: true,
    data: { claimed: ext, actual, matches: ok },
    evidence: ok
      ? `“${fileName}” really is a ${actual.toUpperCase()}.`
      : `“${fileName}” is named .${ext} but is actually a ${actual.toUpperCase()}. OCADE won't rename it — the name may be deliberate.`,
  };
}
