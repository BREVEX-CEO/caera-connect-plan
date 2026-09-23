/**
 * The version every OCADE package reports, and nothing else.
 *
 * It lived in `health.ts`, which is the Cloudflare liveness handler. That made
 * the constant unreachable from the Supabase Edge Function without dragging a
 * Cloudflare request handler into a Deno bundle — and, because the import was a
 * VALUE rather than a type, Deno could not erase it either. The Edge Function
 * in this tree was undeployable for that one line.
 *
 * One line, one module, no runtime of its own: both the Cloudflare handler and
 * the Edge boundary can read it without importing each other's world.
 */
export const OCADE_RELEASE_VERSION = "0.1.0";

declare const __OCADE_COMMIT__: string | undefined;

/** The Git commit this bundle was built from, injected by the build (F13). */
export const OCADE_COMMIT: string =
  typeof __OCADE_COMMIT__ === "string" && __OCADE_COMMIT__ ? __OCADE_COMMIT__ : "unknown";
