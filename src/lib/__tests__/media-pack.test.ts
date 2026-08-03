import { describe, it, expect } from "vitest";
import {
  MEDIA_PACK,
  inspectImage,
  identifyFormat,
  checkExtension,
} from "../skills/packs/media-pack";

/**
 * Real bytes throughout.
 *
 * The PNG and GIF fixtures are genuine, complete 1×1 files (the ones every
 * browser ships as a transparent pixel), decoded from base64 — not synthetic
 * headers. The JPEG is assembled segment by segment so the segment walk is
 * genuinely exercised rather than reading a lucky fixed offset.
 */

const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

/** A real 1×1 transparent PNG. */
const REAL_PNG = bytes(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
);

/** A real 1×1 GIF. */
const REAL_GIF = bytes("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

/** Build a PNG header with chosen dimensions (IHDR is big-endian). */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

/**
 * Build a JPEG with `padding` bytes of EXIF-like segments BEFORE the frame
 * header, so a parser reading a fixed offset gets the wrong answer.
 */
function jpeg(width: number, height: number, paddingSegments = 0): number[] {
  const out: number[] = [0xff, 0xd8]; // SOI
  for (let i = 0; i < paddingSegments; i++) {
    const len = 20;
    out.push(0xff, 0xe1, 0x00, len);
    for (let k = 0; k < len - 2; k++) out.push(0x00);
  }
  out.push(0xff, 0xc0, 0x00, 0x11, 0x08); // SOF0, length 17, 8-bit
  out.push((height >> 8) & 0xff, height & 0xff);
  out.push((width >> 8) & 0xff, width & 0xff);
  for (let k = 0; k < 6; k++) out.push(0x00);
  out.push(0xff, 0xda); // SOS
  return out;
}

describe("the pack states its own limits", () => {
  it("says plainly that it cannot drive creative applications", () => {
    expect(MEDIA_PACK.coverageNote).toMatch(/cannot operate Photoshop/i);
    expect(MEDIA_PACK.coverageNote).toMatch(/does not edit or export/i);
  });
});

describe("identifying an image from its contents", () => {
  it("identifies a real PNG and reads its true size", () => {
    const r = inspectImage(REAL_PNG);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.format).toBe("png");
    expect(r.data.width).toBe(1);
    expect(r.data.height).toBe(1);
    expect(r.evidence).toMatch(/read from IHDR/);
  });

  it("identifies a real GIF and reads its true size", () => {
    const r = inspectImage(REAL_GIF);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.format).toBe("gif");
    expect(r.data.width).toBe(1);
    expect(r.data.height).toBe(1);
  });

  it("reads large PNG dimensions correctly, not truncated to 16 bits", () => {
    const r = inspectImage(png(70000, 40000));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.width).toBe(70000);
    expect(r.data.height).toBe(40000);
    expect(r.data.megapixels).toBeCloseTo(2800, 0);
  });

  /**
   * The test a fixed-offset JPEG reader fails. The dimensions move as EXIF and
   * comment segments are added ahead of them; only walking the segments finds
   * the right ones.
   */
  it("walks JPEG segments to the frame header", () => {
    for (const padding of [0, 1, 5, 20]) {
      const r = inspectImage(Uint8Array.from(jpeg(1920, 1080, padding)));
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(`unreachable at padding ${padding}`);
      expect(r.data.width).toBe(1920);
      expect(r.data.height).toBe(1080);
    }
  });

  it("skips standalone markers that carry no length", () => {
    const withRestart = [0xff, 0xd8, 0xff, 0xd0, ...jpeg(800, 600).slice(2)];
    const r = inspectImage(Uint8Array.from(withRestart));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.width).toBe(800);
  });

  it("reads a BMP, including the signed top-down height", () => {
    const b = new Uint8Array(30);
    b.set([0x42, 0x4d], 0);
    const view = new DataView(b.buffer);
    view.setUint32(18, 640, true);
    view.setInt32(22, -480, true); // negative = top-down row order
    const r = inspectImage(b);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.width).toBe(640);
    expect(r.data.height).toBe(480);
  });

  it("reads a lossy WebP", () => {
    const b = new Uint8Array(32);
    b.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
    b.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
    b.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
    new DataView(b.buffer).setUint16(26, 640, true);
    new DataView(b.buffer).setUint16(28, 480, true);
    const r = inspectImage(b);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.format).toBe("webp");
    expect(r.data.width).toBe(640);
    expect(r.data.height).toBe(480);
  });
});

describe("it refuses rather than returning a plausible wrong answer", () => {
  it("refuses an empty file", () => {
    expect(inspectImage(new Uint8Array(0)).ok).toBe(false);
  });

  it("refuses a format it hasn't been tested with", () => {
    const r = inspectImage(Uint8Array.from([0x25, 0x50, 0x44, 0x46])); // "%PDF"
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess from the file name/i);
  });

  it("refuses a truncated PNG instead of reading past the end", () => {
    const r = inspectImage(REAL_PNG.slice(0, 20));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated/i);
  });

  it("refuses a PNG whose first chunk isn't IHDR", () => {
    const b = png(10, 10);
    b.set([0x69, 0x54, 0x58, 0x74], 12); // "iTXt"
    const r = inspectImage(b);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/isn't IHDR/);
  });

  it("refuses a JPEG with no frame header rather than guessing", () => {
    const r = inspectImage(
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(20).fill(0)]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated or not really a JPEG/i);
  });

  it("refuses a zero-sized image rather than reporting 0×0 as a measurement", () => {
    const r = inspectImage(png(0, 100));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/isn't a real image size/i);
  });

  /** RIFF alone is not WebP — it's also WAV and AVI. */
  it("does not accept a bare RIFF container as WebP", () => {
    const b = new Uint8Array(20);
    b.set([0x52, 0x49, 0x46, 0x46], 0);
    b.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(identifyFormat(b)).toBeNull();
  });

  it("refuses a WebP chunk type it hasn't been tested against", () => {
    const b = new Uint8Array(32);
    b.set([0x52, 0x49, 0x46, 0x46], 0);
    b.set([0x57, 0x45, 0x42, 0x50], 8);
    b.set([0x41, 0x4e, 0x49, 0x4d], 12); // "ANIM"
    const r = inspectImage(b);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/hasn't been tested against/i);
  });
});

/**
 * The check that matters for safety: a file's name is a claim, its bytes are
 * the evidence.
 */
describe("checking a file is what its name claims", () => {
  it("confirms a genuine match", () => {
    const r = checkExtension("pixel.png", REAL_PNG);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.matches).toBe(true);
    expect(r.evidence).toMatch(/really is a PNG/);
  });

  it("treats .jpg and .jpeg as the same format", () => {
    const j = Uint8Array.from(jpeg(10, 10));
    for (const name of ["a.jpg", "a.jpeg", "a.JPG"]) {
      const r = checkExtension(name, j);
      if (!r.ok) throw new Error("unreachable");
      expect(r.data.matches).toBe(true);
    }
  });

  it("reports a mismatch without renaming the file", () => {
    const r = checkExtension("photo.png", Uint8Array.from(jpeg(10, 10)));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.matches).toBe(false);
    expect(r.data.actual).toBe("jpeg");
    expect(r.evidence).toMatch(/won't rename it/i);
  });

  /**
   * The dangerous case: an "image" that is actually markup. This is how a file
   * upload becomes stored XSS, so it must be called out as untrusted rather
   * than reported as a mere format mismatch.
   */
  it("flags a file that is not an image at all as untrusted", () => {
    const html = Uint8Array.from(Buffer.from("<html><script>alert(1)</script>", "utf8"));
    const r = checkExtension("avatar.png", html);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.matches).toBe(false);
    expect(r.data.actual).toBeNull();
    expect(r.evidence).toMatch(/Treat it as untrusted/i);
  });

  it("declines to judge a file type it hasn't been tested with", () => {
    const r = checkExtension("model.step", REAL_PNG);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't judge/i);
  });

  it("declines when there's no extension to check", () => {
    expect(checkExtension("README", REAL_PNG).ok).toBe(false);
  });
});
