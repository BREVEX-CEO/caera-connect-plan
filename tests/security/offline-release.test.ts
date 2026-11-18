/**
 * Offline release delivery: the artifact is two private objects (language weights, then the
 * vision projector) served as one byte range space. A part is chosen only by an exact, unique
 * size under the prefix, a recorded checksum must agree, and any range across the boundary reads
 * exactly the bytes of the concatenation.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import manifest from "../../release/OCADE_OFFLINE_RELEASE.json" with { type: "json" };
import {
  concatenated,
  matchParts,
  slices,
  type R2Bucket,
} from "../../src/lib/brain/offline-objects.server.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("the committed manifest describes exactly two parts that make up the whole", () => {
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.parts.length, 2);
  assert.equal(manifest.parts[0]!.bytes + manifest.parts[1]!.bytes, manifest.totalBytes);
  assert.equal(manifest.releaseId, `ocr-${manifest.sha256.slice(0, 16)}`);
  for (const part of manifest.parts) assert.match(part.sha256, /^[0-9a-f]{64}$/);
  // Opaque: nothing in the browser-bound manifest names a model, file or vendor.
  assert.doesNotMatch(JSON.stringify(manifest), /gguf|lfm|qwen|liquid|mmproj|models\//i);
});

test("a part is chosen only by a unique exact size, and a recorded checksum must agree", () => {
  const parts = [
    { bytes: 10, sha256: "a".repeat(64) },
    { bytes: 4, sha256: "b".repeat(64) },
  ];
  const checksum = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex")).buffer;
  assert.deepEqual(
    matchParts(
      [
        { key: "p/x", size: 10 },
        { key: "p/y", size: 4, checksums: { sha256: checksum("b".repeat(64)) } },
        { key: "p/z", size: 7 },
      ],
      parts,
    ),
    [
      { key: "p/x", size: 10 },
      { key: "p/y", size: 4 },
    ],
  );
  // Two objects of one part's size: nobody can tell which to serve.
  assert.equal(
    matchParts(
      [
        { key: "p/x", size: 10 },
        { key: "p/x2", size: 10 },
        { key: "p/y", size: 4 },
      ],
      parts,
    ),
    null,
  );
  // Missing part.
  assert.equal(matchParts([{ key: "p/x", size: 10 }], parts), null);
  // Recorded digest disagrees with the manifest.
  assert.equal(
    matchParts(
      [
        { key: "p/x", size: 10, checksums: { sha256: checksum("c".repeat(64)) } },
        { key: "p/y", size: 4 },
      ],
      parts,
    ),
    null,
  );
});

test("any range of the whole reads exactly the concatenated bytes", async () => {
  const first = Uint8Array.from({ length: 10 }, (_, i) => i);
  const second = Uint8Array.from({ length: 4 }, (_, i) => 100 + i);
  const objects: Record<string, Uint8Array> = { "p/a": first, "p/b": second };
  const store = {
    async get(key: string, options?: { range?: { offset?: number; length?: number } }) {
      const bytes = objects[key];
      if (!bytes) return null;
      const offset = options?.range?.offset ?? 0;
      const length = options?.range?.length ?? bytes.length - offset;
      const piece = bytes.slice(offset, offset + length);
      // Delivered in two chunks so the reader's chunk loop is exercised.
      const half = Math.ceil(piece.length / 2);
      return {
        size: bytes.length,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(piece.slice(0, half));
            if (piece.length > half) controller.enqueue(piece.slice(half));
            controller.close();
          },
        }),
      };
    },
    async list() {
      return { objects: [], truncated: false };
    },
  } as R2Bucket;
  const parts = [
    { key: "p/a", size: 10 },
    { key: "p/b", size: 4 },
  ];
  const whole = Uint8Array.from([...first, ...second]);

  for (const [start, length] of [
    [0, 14],
    [0, 10],
    [10, 4],
    [8, 4],
    [3, 2],
    [13, 1],
  ] as const) {
    const pieces = slices(parts, start, length);
    const read = new Uint8Array(await new Response(concatenated(store, pieces)).arrayBuffer());
    assert.deepEqual(read, whole.slice(start, start + length), `range ${start}+${length}`);
  }
  assert.equal(
    digest(
      new Uint8Array(await new Response(concatenated(store, slices(parts, 0, 14))).arrayBuffer()),
    ),
    digest(whole),
  );
});

test("a part that disappears mid-read fails the stream instead of ending it short", async () => {
  const store = {
    async get() {
      return null;
    },
    async list() {
      return { objects: [], truncated: false };
    },
  } as unknown as R2Bucket;
  await assert.rejects(
    new Response(concatenated(store, [{ key: "gone", offset: 0, length: 3 }])).arrayBuffer(),
  );
});
