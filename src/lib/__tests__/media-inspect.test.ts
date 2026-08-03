import { describe, it, expect } from "vitest";
import { inspectMedia, describeMedia } from "../media/inspect";

const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
const REAL_PNG = bytes(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
);

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const str = (s: string) => [...s].map((c) => c.charCodeAt(0));
function box(type: string, payload: number[]): number[] {
  return [...be32(8 + payload.length), ...str(type), ...payload];
}
function minimalMp4(): Uint8Array {
  const mvhd = (() => {
    const p = [0, 0, 0, 0, ...be32(0), ...be32(0), ...be32(1000), ...be32(5000)];
    while (p.length < 100) p.push(0);
    return box("mvhd", p);
  })();
  const tkhd = (() => {
    const p: number[] = [0, 0, 0, 3];
    while (p.length < 76) p.push(0);
    p.push(...be32(1920 * 65536), ...be32(1080 * 65536));
    return box("tkhd", p);
  })();
  const ftyp = box("ftyp", [...str("isom"), ...be32(0x200), ...str("isom")]);
  return Uint8Array.from([...ftyp, ...box("moov", [...mvhd, ...box("trak", tkhd)])]);
}

describe("routing a file to the right reader from its bytes", () => {
  it("recognises an image and reports its dimensions", () => {
    const r = inspectMedia(REAL_PNG, "pixel.png");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.kind).toBe("image");
    expect(r.data.image?.format).toBe("png");
    expect(describeMedia(r.data)).toMatch(/Image: PNG 1×1/);
  });

  it("recognises a video and reports its duration", () => {
    const r = inspectMedia(minimalMp4(), "clip.mp4");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.kind).toBe("video");
    expect(r.data.video?.durationSeconds).toBeCloseTo(5, 6);
    expect(describeMedia(r.data)).toMatch(/Video: MP4 1920×1080, 5\.0s/);
  });

  it("decides type from CONTENT, not the extension", () => {
    // A video whose name lies about being a png.
    const r = inspectMedia(minimalMp4(), "fake.png");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.kind).toBe("video");
    expect(r.data.extensionMatches).toBe(false);
    expect(r.data.extensionNote).toMatch(/name as unreliable/i);
  });

  it("confirms a matching extension without a warning", () => {
    const r = inspectMedia(REAL_PNG, "real.png");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.extensionMatches).toBe(true);
    expect(r.data.extensionNote).toBe("");
  });

  it("works without a filename (bytes only)", () => {
    const r = inspectMedia(REAL_PNG);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.extensionMatches).toBeNull();
  });

  it("refuses a file that is neither image nor video", () => {
    const r = inspectMedia(Uint8Array.from(str("%PDF-1.7")));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess a type from the file name/i);
  });

  it("refuses an empty file", () => {
    expect(inspectMedia(new Uint8Array(0)).ok).toBe(false);
  });
});
