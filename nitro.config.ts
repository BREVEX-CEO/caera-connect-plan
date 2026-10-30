import { defineNitroConfig } from "nitro/config";

/**
 * Production is Cloudflare, and there the project entry must win: Nitro's stock
 * Cloudflare entry serves matching public files BEFORE the application handler,
 * and OCADE has to gate uploaded bundles at the outermost edge boundary.
 */
export default defineNitroConfig({ entry: "./src/cloudflare-entry.ts" });
