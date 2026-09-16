import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OFFLINE_LABEL, formatSize, offlineRelease } from "@/lib/brain/offline-release";
import { BROWSER_SAMPLER } from "@/lib/brain/sampler-settings";

describe("the committed release record", () => {
  it("is either a valid release or honestly absent", () => {
    /*
     * Null is a real state, not a failure: a deployment whose artifact has not
     * been published says Offline Intelligence is unavailable rather than
     * starting an install that cannot finish. What must never happen is a
     * half-valid record that gets partway.
     */
    const release = offlineRelease();
    if (release === null) return;
    expect(release.releaseId).toMatch(/^ocr-[0-9a-f]{16}$/);
    expect(release.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(release.totalBytes).toBeGreaterThan(0);
    expect(release.contextTokens).toBeGreaterThan(0);
  });

  it("carries the digest its id is derived from", () => {
    // The id IS the first sixteen characters of the digest. That is what makes
    // a different artifact a different URL, and a cached copy impossible to
    // serve stale.
    const release = offlineRelease();
    if (release) expect(release.releaseId).toBe(`ocr-${release.sha256.slice(0, 16)}`);
  });

  it("names nothing about what the artifact is", () => {
    /*
     * The file a browser is handed. It used to carry the publisher's
     * repository, the file name, the quantisation and a public download URL;
     * anyone who opened the network panel learned what OCADE runs.
     */
    const raw = readFileSync("release/OCADE_OFFLINE_RELEASE.json", "utf8");
    const allowed = new Set([
      "schemaVersion",
      "releaseId",
      "totalBytes",
      "sha256",
      "contextTokens",
      "requiredMemoryBytes",
      "thinkingSuitable",
      "note",
    ]);
    for (const key of Object.keys(JSON.parse(raw) as Record<string, unknown>)) {
      expect(allowed.has(key), `${key} is not a fact a customer may be told`).toBe(true);
    }
    expect(raw).not.toMatch(/https?:\/\//);
  });
});

describe("the one name a customer sees", () => {
  it("is OCADE's own", () => {
    expect(OFFLINE_LABEL).toBe("Offline Intelligence");
  });
});

describe("sizes a person can read", () => {
  it("reads megabytes below a gigabyte and gigabytes above", () => {
    expect(formatSize(512 * 1024 * 1024)).toBe("512 MB");
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GB");
    expect(formatSize(1_610_612_736)).toBe("1.50 GB");
  });
});

describe("the proof and the product run the artifact the same way", () => {
  /*
   * A proof that the artifact answers correctly proves nothing if it answered
   * under settings the product does not ship. These values came from getting
   * the proof to work: at the previous 0.2/0.9 this artifact repeats and
   * stalls. If somebody changes one side, this is what says so.
   */
  const proof = readFileSync("scripts/prove-offline-artifact.mjs", "utf8");

  it("samples at the same values", () => {
    expect(proof).toContain(`temperature: ${BROWSER_SAMPLER.temperature}`);
    expect(proof).toContain(`top_p: ${BROWSER_SAMPLER.topP}`);
    expect(proof).toContain(`top_k: ${BROWSER_SAMPLER.topK}`);
    expect(proof).toContain(`min_p: ${BROWSER_SAMPLER.minP}`);
  });

  it("turns deliberation off on both sides", () => {
    // The artifact's chat template emits a reasoning block unless told not to,
    // which on a device this size is minutes nobody sees.
    expect(proof).toContain("enable_thinking: false");
    const adapter = readFileSync("src/lib/brain/adapters/browser-wasm.ts", "utf8");
    expect(adapter).toContain("enable_thinking: false");
  });

  it("uses the artifact's own chat template rather than raw completion", () => {
    const adapter = readFileSync("src/lib/brain/adapters/browser-wasm.ts", "utf8");
    expect(adapter).toContain("jinja: true");
    expect(adapter).toContain("createChatCompletion");
  });

  it("never lets the engine fetch a runtime from somebody else's CDN", () => {
    // A local-first engine that reaches out to a third party to start is not
    // local-first, and it tells that third party when every customer opens it.
    const adapter = readFileSync("src/lib/brain/adapters/browser-wasm.ts", "utf8");
    expect(adapter).toContain("setCompat(null)");
  });
});
