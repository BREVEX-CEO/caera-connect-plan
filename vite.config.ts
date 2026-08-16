// @lovable.dev/vite-tanstack-config already includes the core plugins.
// Extra build settings below split large browser bundles into smaller files.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";


/**
 * True when `id` is a file inside one of the named packages.
 *
 * Anchored on `/node_modules/<name>/` rather than a bare `/<name>/` fragment.
 * A loose fragment matches nested paths that merely happen to contain the word:
 * `mammoth/lib/docx/` reads as the `docx` package, and every `.../react/...`
 * directory reads as React itself. Module ids are forward-slashed on every
 * platform, including Windows.
 */
const fromPackage =
  (...names: string[]) =>
  (id: string) =>
    names.some((name) => id.includes(`/node_modules/${name}/`));

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
    plugins: [mcpPlugin()],

    /*
     * THE DEV PORT COMES FROM THE ENVIRONMENT, NOT FROM A FLAG.
     *
     * It used to be pinned with `--port 5173 --strictPort` in
     * `.claude/launch.json`, which meant a second session could not start the
     * server at all — the port was already held and `strictPort` turns that
     * into a hard failure rather than a shuffle to 5174.
     *
     * Nothing here needs 5173 specifically. The local-demo gate in
     * `control-access.node.ts` authorises on the Host being a LOOPBACK ADDRESS
     * and never looks at the port, and there are no OAuth callbacks or webhooks
     * pointing at a fixed one. So the harness assigns a free port through
     * `PORT` and this reads it; with nothing set, Vite picks its own default.
     */
    server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,

    /*
     * CLIENT ONLY, and that scoping matters.
     *
     * These groups used to sit under a top-level `build.rollupOptions`, which
     * applies to every environment — including the SSR bundle, where Nitro
     * sets `inlineDynamicImports`. The two are mutually exclusive, so every
     * build printed "inlineDynamicImports option is ignored because the
     * codeSplitting option is specified".
     *
     * Splitting a server bundle into vendor chunks buys nothing anyway: it is
     * loaded once, from disk, by one process. The browser is the only place
     * where any of this reasoning applies, so it is the only place it runs.
     */
    environments: {
      client: {
        build: {
          /*
           * Rollup's generic "chunk larger than 500 kB" warning is turned off
           * here because this repository enforces a STRICTER and more
           * meaningful budget in `scripts/check-asset-budgets.mjs`, which runs
           * in CI and fails the build rather than printing a note.
           *
           * The two chunks that trip the generic threshold are the web-llm
           * inference runtime and its worker, at ~5.9 MB each. An inference
           * engine cannot be made small, and splitting it further would only
           * produce more chunks that always load together. What actually
           * matters is that they never load unless the user starts the
           * on-device engine — and that IS checked: the budget gate asserts
           * `all lazy: true`, and the entry bundle contains zero references to
           * them, with no modulepreload in the HTML.
           *
           * The real numbers the gate holds: eager JavaScript 2,999/3,760 KiB,
           * largest eager chunk 486/537 KiB. A generic byte threshold that
           * cannot tell eager from lazy would only train people to ignore it.
           */
          chunkSizeWarningLimit: 6144,
          rollupOptions: {
            output: {
              // Explicit groups rather than `manualChunks`. A manual-chunk callback
              // only answers "which chunk is this module named for"; it cannot say
              // which group wins when several could claim the same module. Chunk
              // groups can, via `priority`, and that ordering is what keeps the
              // lazy document boundaries honest — see `vendor-runtime` below.
              codeSplitting: {
                groups: [
                  // Vite's dynamic-import preload helper is a dependency of every
                  // module that has a lazy boundary, including pdfjs-dist's own
                  // internal dynamic imports. Groups pull in their dependencies
                  // recursively, so without a higher-priority home of its own the
                  // helper gets swallowed by whichever document chunk reaches it
                  // first. Every entry then has to import that chunk just to get
                  // the helper, and the "lazy" PDF reader silently becomes a
                  // static dependency of the main bundle — which is exactly how a
                  // 1.2 MB document chunk ended up loading on first paint.
                  //
                  // Highest priority: claimed here first, removed from all others.
                  {
                    name: "vendor-runtime",
                    test: (id) => id.includes("preload-helper") || id.includes("commonjsHelpers"),
                    priority: 100,
                  },

                  // Document libraries are the heaviest dependencies in the tree
                  // and each is reached only through a dynamic import. They are
                  // kept in SEPARATE chunks on purpose: a single shared
                  // "documents" chunk makes any one of them drag in all the
                  // others, so reading a PDF would also pay for the DOCX writer.
                  //
                  // The PDF reader keeps the bare `pdf` name so the emitted file is
                  // `pdf-<hash>.js` — the lazy boundary the performance budget gate
                  // asserts on.
                  { name: "pdf", test: fromPackage("pdfjs-dist"), priority: 90 },
                  { name: "vendor-mammoth", test: fromPackage("mammoth"), priority: 90 },
                  { name: "vendor-zip", test: fromPackage("jszip"), priority: 90 },

                  // Supabase sits above the rest of the vendors. Groups claim
                  // dependencies recursively, so at equal priority an earlier
                  // group reaches the Supabase client through its own dependency
                  // chain and the client stops being a chunk of its own — it lands
                  // back in the entry, adding ~200 KB to first paint. A higher
                  // priority makes this group claim those modules first.
                  { name: "vendor-supabase", test: (id) => id.includes("@supabase"), priority: 60 },

                  // Shared framework and UI vendors, split so a route change does
                  // not re-download the parts that never change.
                  {
                    name: "vendor-react",
                    test: fromPackage("react", "react-dom", "scheduler"),
                    priority: 50,
                  },
                  { name: "vendor-tanstack", test: (id) => id.includes("@tanstack"), priority: 50 },
                  {
                    name: "vendor-ui",
                    test: (id) =>
                      id.includes("@radix-ui") ||
                      fromPackage("lucide-react", "cmdk", "vaul", "sonner")(id),
                    priority: 50,
                  },
                  {
                    name: "vendor-markdown",
                    test: (id) =>
                      fromPackage("react-markdown", "unified")(id) ||
                      /\/node_modules\/(?:remark|rehype)-[^/]+\//.test(id),
                    priority: 50,
                  },
                  {
                    name: "vendor-ai",
                    test: (id) => id.includes("@ai-sdk") || fromPackage("ai")(id),
                    priority: 50,
                  },
                  /*
                   * `vendor-docx` and `vendor-charts` used to sit here, naming
                   * `docx` and `recharts`. Both packages were uninstalled once
                   * nothing imported them — the shadcn components that pulled
                   * them in had already been deleted. A chunk group naming a
                   * package that is not installed is silently dead config:
                   * it matches nothing, and it reads as though the app still
                   * ships a chart library and a DOCX writer.
                   */
                ],
              },
            },
          },
        },
      },
    },
  },
});
