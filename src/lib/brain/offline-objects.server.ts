/**
 * WHERE THE OFFLINE RELEASE'S TWO PRIVATE OBJECTS ARE, AND HOW ONE BYTE RANGE
 * OF THE WHOLE ARTIFACT IS READ FROM THEM. Server-only.
 */
export interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

export interface R2Object {
  body: ReadableStream | null;
  size: number;
  writeHttpMetadata?: (headers: Headers) => void;
}

interface R2Listed {
  key: string;
  size: number;
  checksums?: { sha256?: ArrayBuffer };
}

export interface R2Bucket {
  get(
    key: string,
    options?: { range?: R2Range; onlyIf?: unknown },
  ): Promise<(R2Object & { range?: R2Range }) | null>;
  list(options: {
    prefix: string;
    include?: ("httpMetadata" | "customMetadata")[];
  }): Promise<{ objects: R2Listed[]; truncated: boolean }>;
}

/**
 * Where the release's two objects live in the private bucket. Server-only:
 * this module never reaches a browser bundle.
 */
export const OFFLINE_OBJECT_PREFIX = "models/lfm25-vl-450m-q5/";

export interface PartObject {
  key: string;
  size: number;
}

/**
 * The object holding each part, matched by exact size under the prefix.
 *
 * Exactly one object of each size, or null: two candidates for one part is a
 * bucket nobody can serve from safely. When R2 recorded a SHA-256 at upload it
 * must equal the manifest's; when it did not, the device's whole-artifact
 * digest is what proves the bytes.
 */
export function matchParts(
  listed: R2Listed[],
  parts: { bytes: number; sha256: string }[],
): PartObject[] | null {
  const chosen: PartObject[] = [];
  for (const part of parts) {
    const candidates = listed.filter((object) => object.size === part.bytes);
    if (candidates.length !== 1) return null;
    const recorded = candidates[0]!.checksums?.sha256;
    if (recorded && hex(recorded) !== part.sha256) return null;
    chosen.push({ key: candidates[0]!.key, size: part.bytes });
  }
  return chosen;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The pieces of each part that cover `[start, start + length)` of the whole.
 */
export function slices(
  parts: PartObject[],
  start: number,
  length: number,
): { key: string; offset: number; length: number }[] {
  const out: { key: string; offset: number; length: number }[] = [];
  let base = 0;
  const end = start + length;
  for (const part of parts) {
    const from = Math.max(start, base);
    const to = Math.min(end, base + part.size);
    if (from < to) out.push({ key: part.key, offset: from - base, length: to - from });
    base += part.size;
  }
  return out;
}

/** The slices' bodies, one after another, as one stream. */
export function concatenated(
  store: R2Bucket,
  pieces: { key: string; offset: number; length: number }[],
): ReadableStream<Uint8Array> {
  let index = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        if (!reader) {
          const piece = pieces[index];
          if (!piece) {
            controller.close();
            return;
          }
          const object = await store.get(piece.key, {
            range: { offset: piece.offset, length: piece.length },
          });
          if (!object?.body) {
            controller.error(new Error("part missing"));
            return;
          }
          reader = (object.body as ReadableStream<Uint8Array>).getReader();
        }
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        reader = null;
        index += 1;
      }
    },
    async cancel(reason) {
      await reader?.cancel(reason);
    },
  });
}
