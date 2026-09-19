import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imageMediaType, isMediaType } from "@/lib/media-type";

/**
 * TWO THINGS `addLibraryItem` TOOK ON TRUST FROM WHOEVER CALLED IT.
 *
 * The bytes' SIZE was checked after they were decoded, and the base64 that
 * carried them had no ceiling at all — so the only thing between one request and
 * an arbitrary amount of memory in the isolate was the decode itself, which is
 * the part that spends the memory. Half a gigabyte of base64 was materialised
 * twice over before anything said it was too large.
 *
 * And the stored object's CONTENT TYPE was whatever the caller declared. The
 * Library opens an object by minting a signed URL and handing it to a new tab,
 * and storage serves what it was told, so a file stored as `text/html` was an
 * attacker-chosen document served from the project's own storage domain and
 * reached through OCADE's own screen.
 *
 * The signature logic is real code and is tested as code. The two orderings in
 * the server function are shapes — a bound that must sit in the validator rather
 * than the handler, and a content type that must not come from the request — so
 * they are checked where they are stated.
 */
const SOURCE = readFileSync("src/lib/library/library.functions.ts", "utf8");

const bytesOf = (...values: number[]) => new Uint8Array(values);

describe("what the bytes actually are", () => {
  it("recognises the four image formats OCADE accepts", () => {
    expect(imageMediaType(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe("image/png");
    expect(imageMediaType(bytesOf(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(imageMediaType(bytesOf(0x47, 0x49, 0x46, 0x38, 0x39))).toBe("image/gif");
    expect(
      imageMediaType(bytesOf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)),
    ).toBe("image/webp");
  });

  it("is not fooled by a name, a declared type, or a near miss", () => {
    // An HTML document, an SVG and a RIFF container that is not WEBP.
    expect(imageMediaType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(imageMediaType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(
      imageMediaType(bytesOf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull();
    expect(imageMediaType(new Uint8Array(0))).toBeNull();
  });

  it("accepts a media type and refuses a free-form string", () => {
    expect(isMediaType("image/png")).toBe(true);
    expect(
      isMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(true);
    expect(isMediaType("text/plain; charset=utf-8")).toBe(false);
    expect(isMediaType("not a type")).toBe(false);
    expect(isMediaType("/png")).toBe(false);
    expect(isMediaType("")).toBe(false);
  });
});

describe("an upload cannot spend what it likes", () => {
  it("bounds the encoded payload in the validator, before anything decodes it", () => {
    expect(SOURCE).toContain("contentBase64: z.string().min(1).max(MAX_BASE64_LENGTH)");
    // The ceiling has to be stated in terms of the real one rather than a
    // number somebody has to keep in step.
    expect(SOURCE).toContain("Math.ceil(LIBRARY_MAX_BYTES / 3) * 4");
    expect(SOURCE.indexOf("MAX_BASE64_LENGTH)")).toBeLessThan(SOURCE.indexOf("atob("));
  });

  it("turns a malformed payload into a sentence rather than an exception", () => {
    const decode = SOURCE.slice(SOURCE.indexOf("atob("));
    expect(decode.slice(0, 400)).toContain("That file could not be read.");
  });
});

describe("what a signed link will serve", () => {
  it("is never the content type the caller asked for", () => {
    expect(SOURCE).toContain("contentType: storedType");
    expect(SOURCE).not.toContain("contentType: data.mime");
  });

  it("is the format the bytes are, or bytes to download", () => {
    expect(SOURCE).toContain("imageMediaType(bytes.subarray(0, 12))");
    expect(SOURCE).toContain('"application/octet-stream"');
    // A file the caller called an image but whose bytes are not one is stored
    // and listed as a file, rather than refused and lost.
    expect(SOURCE).toContain('data.kind === "image" && signature ? "image" : "file"');
  });
});
