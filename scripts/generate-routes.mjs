import { Generator, getConfig } from "@tanstack/router-generator";

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
