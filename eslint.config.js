import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    /**
     * `.codex` and `.claude` hold gitignored local checkpoint snapshots —
     * point-in-time copies of source kept so a previous state can be compared
     * or restored. Linting them was doing real harm, not just wasting time:
     *
     *   - they contributed 1,478 of 2,424 warnings (61%), so the headline
     *     count described copies of the code rather than the code;
     *   - `--fix` would have REWRITTEN those snapshots, destroying the exact
     *     historical fidelity that is the only reason they exist.
     *
     * They are excluded from version control already; excluding them here just
     * makes the linter agree with the repository about what the source is.
     */
    ignores: [
      "dist",
      // The E2E harnesses build the product with the node preset so they can
      // serve it here, and move it aside so it cannot clobber the shipping
      // build. Without this, eslint crawls 481 generated files and `npm run
      // lint` goes from seconds to minutes.
      //
      // A GLOB RATHER THAN A LIST, because a list is a second authority that
      // has to be kept in step and was not: adding the offline harness created
      // `.output-offline`, nobody added it here, and the next full lint took
      // five minutes at 100% CPU while it crawled a production bundle. The
      // pattern covers whatever the next harness calls its output.
      ".output*",
      ".vinxi",
      ".browser-sidecar/**",
      // Disposable archive/package inspection. It can contain third-party
      // source with its own lint directives and is never OCADE product code.
      ".work/**",
      "native/**/binaries/**",
      "native/**/gen/**",
      "native/**/target/**",
      // The OCADE-owned Python environment. Its site-packages ship third-party
      // .js test fixtures (win32com's scriptlet tests, urllib3's emscripten
      // worker) that are not product code and must not be reformatted.
      "native/python-host/.venv/**",
      /*
       * The incoming control engine, held READ-ONLY until it is deliberately
       * connected.
       *
       * Not merely noise-suppression. Without this, `eslint .` walked into it
       * and reported on a vendored `crypto-js.min.js` in its dashboard — which
       * means `eslint --fix`, a command run casually and often, would have
       * REWRITTEN a file inside a directory that is supposed to be immutable.
       * A convention that the folder must not be touched is not protection; an
       * ignore rule is.
       */
      "native/ocade_control_engine/**",
      ".codex/**",
      ".claude/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // ~207 pre-existing `any` usages in the Lovable source; surface as a
      // warning (paid down over time). New OCADE code is written without `any`.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  eslintPluginPrettier,
  {
    // Prettier plugin is registered by eslintPluginPrettier above; downgrade
    // pre-existing Lovable formatting deviations to warnings (run `npm run
    // format` to normalize) so the lint gate reflects real code errors.
    rules: {
      "prettier/prettier": "warn",
    },
  },
);
