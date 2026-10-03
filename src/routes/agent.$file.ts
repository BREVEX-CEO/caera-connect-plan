import { createFileRoute } from "@tanstack/react-router";
import { agentFileHeaders, agentFileKey } from "@/lib/agent/release";

interface R2Object {
  body: ReadableStream | null;
  size: number;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

function bucket(): R2Bucket | null {
  const environment = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const binding = environment?.["OCADE_MODELS"];
  return binding && typeof binding === "object" ? (binding as R2Bucket) : null;
}

/**
 * The Device Agent's installer, update archives and signed manifest.
 *
 * Public on purpose: a computer has no account when it installs, and an
 * installed agent checks for updates with no session. What protects the person
 * is not who may download, but that the agent installs only what the release
 * key signed and whose hash matches.
 */
export const Route = createFileRoute("/agent/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = String((params as { file?: string }).file ?? "");
        const key = agentFileKey(name);
        if (!key) return new Response(null, { status: 404 });
        const store = bucket();
        if (!store) return new Response(null, { status: 503 });
        const object = await store.get(key);
        if (!object?.body) return new Response(null, { status: 404 });
        return new Response(object.body, {
          status: 200,
          headers: {
            ...agentFileHeaders(name),
            "content-length": String(object.size),
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
