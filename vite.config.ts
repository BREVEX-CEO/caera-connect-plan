import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { transform } from "lightningcss";
import { nitro } from "nitro/vite";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "vite";

/**
 * Repository-owned Vite authority.
 *
 * Vite 8 resolves tsconfig paths itself. The previous third-party wrapper
 * always installed `vite-tsconfig-paths`, producing a build warning and making
 * most plugin time belong to a redundant resolver. Keeping the small plugin
 * composition here makes its order explicit and removes that obsolete peer.
 */
/** The commit being built: CI's own variable first, then the local checkout. */
function buildCommit(): string {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function defineOcadeConfig(options: {
  tanstackStart?: Parameters<typeof tanstackStart>[0];
  vite: UserConfig;
}) {
  return defineConfig(({ command }) => {
    const config = options.vite;
    return {
      ...config,
      define: { __OCADE_COMMIT__: JSON.stringify(buildCommit()), ...config.define },
      css: { transformer: "lightningcss", ...config.css },
      resolve: {
        tsconfigPaths: true,
        alias: { "@": resolve(process.cwd(), "src") },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
        ...config.resolve,
      },
      plugins: [
        tailwindcss(),
        tanstackStart({
          importProtection: {
            behavior: "error",
            client: { files: ["**/server/**"], specifiers: ["server-only"] },
          },
          ...options.tanstackStart,
        }),
        ...(command === "build"
          ? [
              nitro({
                defaultPreset: "cloudflare-module",
                cloudflare: { nodeCompat: true, deployConfig: false },
              }),
            ]
          : []),
        viteReact(),
        ...(config.plugins ?? []),
      ],
    };
  });
}

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

export default defineOcadeConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
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
     * LIGHTNING CSS OVER THE EMITTED STYLESHEET.
     *
     * `PLAN.md` §26 caps CSS at 145 KiB. esbuild's CSS minifier strips
     * whitespace and little else; Lightning CSS also merges adjacent rules that
     * share a selector and collapses the `@supports` wrappers Tailwind emits
     * around every colour utility. Measured on this sheet: 149,987 to 147,986
     * bytes — the difference between over and under the limit.
     *
     * DONE AS A PLUGIN BECAUSE THE SETTING DID NOTHING. `build.cssMinify:
     * "lightningcss"` was tried first, both at the top level and under
     * `environments.client`, and produced a byte-identical file each time:
     * the stylesheet does not pass through the minifier that option selects. A
     * setting that silently changes nothing is worse than no setting, so this
     * transforms the emitted asset where it can be seen to happen.
     *
     * Lightning CSS is already a Vite dependency, so no new package is added.
     */
    plugins: [
      {
        name: "ocade-minify-css-with-lightningcss",
        enforce: "post" as const,
        apply: "build" as const,
        generateBundle(
          _options: unknown,
          bundle: Record<string, { type: string; source?: unknown; fileName: string }>,
        ) {
          for (const asset of Object.values(bundle)) {
            if (asset.type !== "asset" || !asset.fileName.endsWith(".css")) continue;
            const code = Buffer.from(asset.source as Uint8Array | string);
            const { code: minified } = transform({
              filename: asset.fileName,
              code,
              minify: true,
            });
            asset.source = Buffer.from(minified);
          }
        },
      },
      {
        name: "ocade-client-chunking",
        /*
         * CLIENT ONLY, and that scoping matters.
         *
         * A static `environments.client` object is inherited by Nitro's SSR
         * environment before it is resolved. Its `codeSplitting` then clashes
         * with Nitro's `inlineDynamicImports`. Vite 8's environment hook is the
         * precise boundary: return this config only for the browser client.
         */
        configEnvironment(name) {
          if (name !== "client") return;
          return {
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
                      //
                      // `tslib` IS THE SAME PROBLEM WEARING A DIFFERENT NAME, and it
                      // cost 203 KiB on every first paint. Its helpers are used by
                      // packages all over the tree; `@supabase/*` happened to reach
                      // them first, so tslib was pulled into `vendor-supabase` — and
                      // the entry chunk then carried a static
                      // `import{...}from"./vendor-supabase.js"` to get three helper
                      // functions. Every OCADE module had already been changed to load
                      // the Supabase client dynamically, the source graph had no path
                      // to it at all, and the browser still fetched and parsed the
                      // whole auth stack before the landing page could respond to a
                      // tap. A shared helper with no home of its own is not a small
                      // problem.
                      {
                        name: "vendor-runtime",
                        test: (id) =>
                          id.includes("preload-helper") ||
                          id.includes("commonjsHelpers") ||
                          id.includes("/node_modules/tslib/"),
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
                      { name: "vendor-zip", test: fromPackage("jszip"), priority: 90 },

                      // Supabase sits above the rest of the vendors. Groups claim
                      // dependencies recursively, so at equal priority an earlier
                      // group reaches the Supabase client through its own dependency
                      // chain and the client stops being a chunk of its own — it lands
                      // back in the entry, adding ~200 KB to first paint. A higher
                      // priority makes this group claim those modules first.
                      //
                      // OCADE'S OWN CLIENT MODULE BELONGS IN IT TOO, and that is the
                      // half that was missing. `src/integrations/supabase/client.ts`
                      // is the only module that imports `@supabase/supabase-js`, and
                      // with no group of its own it stayed in the entry chunk — where
                      // a static `import ... from "./vendor-supabase.js"` came with
                      // it. Every caller in the entry graph had already been changed
                      // to load it dynamically and first paint still fetched and
                      // parsed all 200 KiB, because the chunk boundary was in the
                      // wrong place rather than missing.
                      //
                      // The directory rather than one file: `previewAuthStorage` and
                      // the configuration message are the client's dependencies and
                      // would otherwise be reached the same way.
                      //
                      // THREE MODULES IN IT MUST STAY OUT. `auth-attacher` is
                      // registered as a global function middleware in `src/start.ts`,
                      // so it is in the entry by definition; `on-demand` is the
                      // accessor the entry uses to reach the client without importing
                      // it; and `configuration` answers "is Supabase configured?" from
                      // two environment variables, which the public status page, the
                      // status API route and the sign-in page all ask WITHOUT wanting
                      // a client. Letting the group claim any of them puts the entry
                      // back to statically importing this chunk — the exact 200 KiB
                      // the split exists to move — while looking, in the source, as
                      // though it does not.
                      //
                      // `configuration` was the third one, and it was added by the
                      // change that split it out of `client.ts`: the source graph then
                      // had no path from the entry to the client, and the bundle still
                      // fetched all 200 KiB, because the boundary was in the wrong
                      // place rather than missing. `no-eager-supabase.test.ts` now
                      // asserts the built graph rather than the source graph, so the
                      // next version of this mistake fails a test instead of a budget.
                      // THE CHEAP HALF OF THE SUPABASE INTEGRATION, CLAIMED FIRST.
                      //
                      // `configuration.ts` answers "is Supabase configured?" from two
                      // environment variables and `configuration-message.ts` builds a
                      // sentence about it. Neither touches `@supabase/supabase-js`,
                      // and the entry reaches both — the public status page and the
                      // sign-in page ask the question, and the auth middleware builds
                      // the message.
                      //
                      // EXCLUDING THEM FROM `vendor-supabase` BY `test` DOES NOT WORK,
                      // and that is the thing worth knowing here: groups pull in their
                      // dependencies RECURSIVELY, and `client.ts` imports both. So the
                      // group claimed them through the back door however the test was
                      // written, and the entry then statically imported a 203 KiB
                      // chunk to read two environment variables. A higher priority is
                      // the only thing that wins that argument — the same mechanism
                      // `vendor-runtime` uses above, for the same reason.
                      //
                      // The chunk is about a kilobyte. That is the point.
                      {
                        name: "supabase-configuration",
                        test: (id) => id.includes("/src/integrations/supabase/configuration"),
                        priority: 70,
                      },

                      /*
                       * The on-demand accessor is shared by the entry and several
                       * lazy features. Feature groups recursively claim their
                       * dependencies, so without a higher-priority home the Help
                       * Center captures this tiny module and makes all of its prose
                       * eager merely so the shell can ask for the Supabase client.
                       * The accessor still loads the real client dynamically.
                       */
                      {
                        name: "supabase-accessor",
                        test: (id) => id.includes("/src/integrations/supabase/on-demand"),
                        priority: 85,
                      },

                      {
                        name: "vendor-supabase",
                        test: (id) =>
                          id.includes("@supabase") ||
                          (id.includes("/src/integrations/supabase/") &&
                            !id.includes("auth-attacher") &&
                            // `auth-middleware` is registered by `src/start.ts` for
                            // the same reason `auth-attacher` is, so it is in the
                            // entry by definition. It used to import
                            // `@supabase/supabase-js` at module scope, so claiming it
                            // here was the only way to keep that out of the entry —
                            // and the cost was that the entry then imported THIS
                            // chunk to reach the middleware, which is the same 203
                            // KiB by another route. The import inside it is now
                            // dynamic, so the middleware is cheap and belongs where
                            // it is used.
                            !id.includes("auth-middleware") &&
                            !id.includes("on-demand") &&
                            // Both `configuration.ts` and `configuration-message.ts`:
                            // one reads two environment variables, the other builds a
                            // sentence. Neither touches `@supabase/supabase-js`, and
                            // both are reached from the entry — the middleware imports
                            // the message, the public status page imports the reader.
                            !id.includes("configuration")),
                        priority: 60,
                      },

                      // Shared framework and UI vendors, split so a route change does
                      // not re-download the parts that never change.
                      {
                        name: "vendor-react",
                        test: fromPackage("react", "react-dom", "scheduler"),
                        priority: 50,
                      },
                      /*
                       * REACT-QUERY, CLAIMED BEFORE ANY FEATURE GROUP.
                       *
                       * `vendor-tanstack` below covers it by name, but at priority
                       * 50 — under every feature group — so the first feature to
                       * import it takes it. The Help Center did: its publishing
                       * workflow reads overrides through `useQuery`, groups pull
                       * dependencies recursively, and `@tanstack/react-query` was
                       * adopted into `help-articles`. Every screen in the product
                       * uses react-query, so the ENTRY then imported the help chunk
                       * to get it, and twenty-four kilobytes of help prose landed
                       * on first paint.
                       *
                       * The third time this shape of mistake has cost eager bytes —
                       * after `tslib` was swallowed by the Supabase chunk and the
                       * plan catalogue by the help chunk — and the third time the
                       * budget gate found it rather than review. A shared runtime
                       * library needs a home ABOVE the features that use it, not
                       * merely a home.
                       */
                      {
                        name: "vendor-query",
                        test: (id) =>
                          id.includes("@tanstack/query-core") ||
                          id.includes("@tanstack/react-query"),
                        priority: 90,
                      },
                      {
                        name: "vendor-tanstack",
                        test: (id) => id.includes("@tanstack"),
                        priority: 50,
                      },
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
                       * THE HELP CENTER'S PROSE IS NOT FIRST-PAINT CONTENT.
                       *
                       * `src/lib/support/articles.ts` is the single authority for
                       * every help answer, and four lazy routes read it: the Help
                       * Center home, an article page, the FAQ and site search. A
                       * module shared by several async chunks is hoisted into the
                       * common chunk — which here is the ENTRY — so making the
                       * answers canonical put seventeen kilobytes of help text on
                       * first paint, where nobody is reading it.
                       *
                       * Giving it a chunk of its own keeps one copy (the point of
                       * having one authority) without that copy being eager. It is
                       * fetched when somebody opens help, which is when they want
                       * it.
                       */
                      /*
                       * The commercial catalogue, claimed BEFORE the help articles.
                       *
                       * Groups pull their dependencies in recursively, and the
                       * billing article quotes the one canonical "checkout is not
                       * available" sentence — which reaches the catalogue, which
                       * reaches the plan table. Without a home of its own the
                       * catalogue was swallowed into the help chunk, and the entry
                       * then had to import twenty-five kilobytes of help prose to
                       * read a plan id. The same shape of mistake as
                       * `vendor-runtime` above, and found the same way: by the
                       * budget gate, not by review.
                       */
                      {
                        name: "commerce-catalogue",
                        test: (id) => id.includes("/src/lib/payments/"),
                        priority: 80,
                      },

                      /*
                       * The locale authority, claimed BEFORE the help articles —
                       * the same shape of mistake as `commerce-catalogue` above,
                       * and found the same way.
                       *
                       * Phase 18 routed every date and number through
                       * `src/lib/locale`, and the Help Center was one of the
                       * screens that started calling it. Without a home of its
                       * own the formatter module was swallowed into the help
                       * chunk, so the entry — which formats a date on almost
                       * every screen — had to import twenty-seven kilobytes of
                       * help prose to read one. It is small, shared by
                       * everything, and belongs with the code that loads first.
                       */
                      {
                        name: "locale-formatting",
                        test: (id) => id.includes("/src/lib/locale/"),
                        priority: 80,
                      },

                      {
                        name: "help-articles",
                        test: (id) => id.includes("/src/lib/support/"),
                        priority: 70,
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
          };
        },
      },
    ],
  },
});
