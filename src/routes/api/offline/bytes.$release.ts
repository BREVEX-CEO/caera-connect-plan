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
 * ONE ARTIFACT, TWO OBJECTS. The release is the language weights followed by
 * the vision projector (`release/OCADE_OFFLINE_RELEASE.json` `parts`). They are
 * stored as two private objects and served as one byte range space, so the
 * installer keeps its single resumable, digest-checked transfer. The response
 * names neither object.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyDelivery } from "@/lib/brain/delivery-signature";
import { offlineRelease } from "@/lib/brain/offline-release";
import {
  OFFLINE_OBJECT_PREFIX,
  concatenated,
  matchParts,
  slices,
  type PartObject,
  type R2Bucket,
  type R2Range,
} from "@/lib/brain/offline-objects.server";

/** Resolved once per isolate; the objects are immutable for a release. */
const resolved = new Map<string, PartObject[]>();

async function partObjects(store: R2Bucket, releaseId: string): Promise<PartObject[] | null> {
  const release = offlineRelease();
  if (!release || release.releaseId !== releaseId) return null;
  const known = resolved.get(releaseId);
  if (known) return known;
  const listing = await store.list({ prefix: OFFLINE_OBJECT_PREFIX });
  if (listing.truncated) return null;
  const parts = matchParts(listing.objects, release.parts);
  if (parts) resolved.set(releaseId, parts);
  return parts;
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

        const parts = await partObjects(store, releaseId).catch(() => null);
        if (!parts) return new Response(null, { status: 404 });
        const size = parts.reduce((sum, part) => sum + part.size, 0);

        const range = parseRange(request.headers.get("range"), size);
        if (range === "unsatisfiable") {
          return new Response(null, {
            status: 416,
            headers: { "content-range": `bytes */${size}` },
          });
        }
        const start = range
          ? range.suffix !== undefined
            ? size - range.suffix
            : (range.offset ?? 0)
          : 0;
        const length = range ? (range.suffix ?? range.length ?? size - start) : size;
        const body = concatenated(store, slices(parts, start, length));

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

        headers.set("content-length", String(length));
        if (range) {
          headers.set("content-range", `bytes ${start}-${start + length - 1}/${size}`);
          return new Response(body, { status: 206, headers });
        }
        return new Response(body, { status: 200, headers });
      },
    },
  },
});
