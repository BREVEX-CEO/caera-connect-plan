/**
 * THE ONLY DOOR TO THE ARTIFACT.
 *
 * The bucket is private: no public access, no custom domain, nothing listable.
 * The bytes leave Cloudflare through this handler and nowhere else, and this
 * handler serves them only against a signature OCADE minted for a signed-in
 * person, only for the release that signature names, and only until it expires.
 *
 * IT SPEAKS RANGE, because everything upstream depends on it. The installer
 * pulls the artifact in adaptive parallel pieces and resumes an interrupted one
 * from a checkpoint; a handler that ignored `Range` would turn every
 * interruption into a restart and every install into a single stream.
 *
 * NOTHING HERE NAMES THE ARTIFACT. The object key is derived from the release
 * id, which is derived from the artifact's own digest. There is no file name to
 * leak, and the response carries none.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyDelivery } from "@/lib/brain/delivery-signature";

interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

interface R2Object {
  body: ReadableStream | null;
  size: number;
  writeHttpMetadata?: (headers: Headers) => void;
}

interface R2Bucket {
  get(
    key: string,
    options?: { range?: R2Range; onlyIf?: unknown },
  ): Promise<(R2Object & { range?: R2Range }) | null>;
  head(key: string): Promise<{ size: number } | null>;
}

/**
 * The bucket binding, read from the Cloudflare environment the entry point
 * stashed. Absent outside Cloudflare — in a local build or a test server — and
 * the handler answers 503 rather than pretending.
 */
function bucket(): R2Bucket | null {
  const environment = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const binding = environment?.["OCADE_MODELS"];
  return binding && typeof binding === "object" ? (binding as R2Bucket) : null;
}

/** `bytes=start-end`, `bytes=start-` and `bytes=-suffix`. Anything else is 416. */
function parseRange(header: string | null, size: number): R2Range | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "unsatisfiable";
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return "unsatisfiable";
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    return suffix > 0 ? { suffix: Math.min(suffix, size) } : "unsatisfiable";
  }
  const start = Number(rawStart);
  if (start >= size) return "unsatisfiable";
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return "unsatisfiable";
  return { offset: start, length: end - start + 1 };
}

export const Route = createFileRoute("/api/offline/bytes/$release")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const releaseId = String((params as { release?: string }).release ?? "");
        // Validated before it is used to build a key, so a crafted id cannot
        // reach for another object.
        if (!/^ocr-[0-9a-f]{16}$/.test(releaseId)) return new Response(null, { status: 404 });

        const url = new URL(request.url);
        const verdict = await verifyDelivery({
          releaseId,
          expiresAt: url.searchParams.get("e"),
          signature: url.searchParams.get("s"),
          now: Date.now(),
        }).catch(() => ({ ok: false as const, status: 403 as const }));
        if (!verdict.ok) return new Response(null, { status: verdict.status });

        const store = bucket();
        // Said as what it is, so the installer stops at once instead of retrying a store that
        // this server (a local build, a test server) will never have.
        if (!store) {
          return new Response(null, {
            status: 503,
            headers: { "x-ocade-delivery": "unconfigured" },
          });
        }

        const key = `r/${releaseId}/a`;
        const head = await store.head(key);
        if (!head) return new Response(null, { status: 404 });

        const range = parseRange(request.headers.get("range"), head.size);
        if (range === "unsatisfiable") {
          return new Response(null, {
            status: 416,
            headers: { "content-range": `bytes */${head.size}` },
          });
        }

        const object = await store.get(key, range ? { range } : undefined);
        if (!object?.body) return new Response(null, { status: 404 });

        const headers = new Headers({
          "content-type": "application/octet-stream",
          "accept-ranges": "bytes",
          /*
           * Cacheable forever by the browser, because it CANNOT go stale: the
           * id is the digest, so different bytes are a different URL. Private
           * because the link is minted per person; a shared cache holding it
           * would serve it to somebody who never got a link.
           */
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        });

        if (range) {
          const start = range.suffix !== undefined ? head.size - range.suffix : (range.offset ?? 0);
          const length = range.suffix ?? range.length ?? head.size - start;
          headers.set("content-range", `bytes ${start}-${start + length - 1}/${head.size}`);
          headers.set("content-length", String(length));
          return new Response(object.body, { status: 206, headers });
        }

        headers.set("content-length", String(head.size));
        return new Response(object.body, { status: 200, headers });
      },
    },
  },
});
