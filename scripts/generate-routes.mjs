import { Generator, getConfig } from "@tanstack/router-generator";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generate the TanStack file-route tree using the generator already installed
 * by the locked router plugin dependency graph.
 *
 * This avoids `npm exec --package=...`, which would download a separate CLI at
 * typecheck time and make clean CI dependent on an untracked package fetch.
 */
const root = process.cwd();
const config = getConfig({}, root);
const generator = new Generator({ config, root });
await generator.run();

/*
 * TanStack Start's Vite plugin appends this server registration during its
 * normal build. The standalone router generator does not do so on every
 * platform/version, which made `npm run typecheck` dirty the tracked route
 * tree on Windows. Keep the standalone command deterministic and equivalent to
 * the Start plugin: generate first, then add the registration exactly once.
 */
const routeTreePath = join(root, "src", "routeTree.gen.ts");
const routeTree = await readFile(routeTreePath, "utf8");
if (!routeTree.includes("startInstance.getOptions")) {
  await appendFile(
    routeTreePath,
    `\nimport type { getRouter } from './router.tsx'\nimport type { startInstance } from './start.ts'\ndeclare module '@tanstack/react-start' {\n  interface Register {\n    ssr: true\n    router: Awaited<ReturnType<typeof getRouter>>\n    config: Awaited<ReturnType<typeof startInstance.getOptions>>\n  }\n}\n`,
    "utf8",
  );
}
