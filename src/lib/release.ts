/**
 * The release version. Its own module, with no imports, so the Cloudflare
 * handler and the Deno Edge Function can both read it.
 */
export const OCADE_RELEASE_VERSION = "0.1.0";

declare const __OCADE_COMMIT__: string | undefined;

/** The Git commit this bundle was built from, injected by the build (F13). */
export const OCADE_COMMIT: string =
  typeof __OCADE_COMMIT__ === "string" && __OCADE_COMMIT__ ? __OCADE_COMMIT__ : "unknown";
