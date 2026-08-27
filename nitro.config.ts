import { defineNitroConfig } from "nitro/config";
import { fileURLToPath } from "node:url";

/**
 * WHICH SERVER ENTRY, AND WHY IT IS NOT ALWAYS OURS.
 *
 * Production is Cloudflare, and there the project entry must win: Nitro's stock
 * Cloudflare entry serves matching public files BEFORE the application handler,
 * and OCADE has to gate uploaded bundles at the outermost edge boundary.
 *
 * The audit harness builds the same source with the node preset, because this
 * sandbox cannot run `wrangler dev`. Forcing the Cloudflare entry there
 * produced a server that exported a fetch handler and never listened — the
 * process started, printed nothing, and exited 0, which read for a long time as
 * "the pinned Nitro beta is broken". It was not. It was this line applying to a
 * preset it was never meant for.
 *
 * The node build therefore keeps Nitro's own listening entry. The application
 * gate is unaffected: `src/server.ts` applies the same launch window and the
 * same public security headers on every request either way. What the node build
 * loses is only the pre-application asset gate, which has no analogue on a
 * machine with no edge in front of it.
 */
const preset = process.env.NITRO_PRESET ?? "";
const targetsCloudflare = preset === "" || preset.includes("cloudflare");

export default defineNitroConfig({
  ...(targetsCloudflare ? { entry: "./src/cloudflare-entry.ts" } : {}),
  // WebLLM is a browser-only runtime. The client build keeps its lazy WebGPU
  // chunks, while the Cloudflare server resolves accidental imports to a tiny
  // fail-closed shim. This avoids both a multi-megabyte server copy and an
  // unresolved bare import in the deployed Worker.
  alias: {
    "@mlc-ai/web-llm": fileURLToPath(
      new URL("./src/lib/brain/adapters/webllm.server.ts", import.meta.url),
    ),
  },
});
