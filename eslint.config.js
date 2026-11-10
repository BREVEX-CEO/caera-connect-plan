import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
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
     *
     * `evidence` is dated run evidence, never source (Prettier already skips it). Its only
     * TypeScript is the bundled copy of each deployed staging function, kept byte-exact for
     * rollback (`evidence/2026-11-07-staging-function-backup`): bundler output is `var`
     * throughout, and `--fix` would rewrite the copy a rollback depends on. The functions'
     * real source (`supabase/functions`, `src/lib/intelligence`) stays linted.
     */
    ignores: [".playwright-mcp/**", "dist", ".output", ".codex/**", ".claude/**", "evidence/**"],
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
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // A provider's own hook, and one pure formatter, beside the components that use them.
          allowExportNames: ["useAppearance", "useSettingsPanel", "describeWhen"],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // ~207 pre-existing `any` usages in the Lovable source; surface as a
      // warning (paid down over time). New OCADE code is written without `any`.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Formatting is Prettier's own check (`npm run format:check`); ESLint only turns off the
  // style rules that would fight it.
  eslintConfigPrettier,
);
