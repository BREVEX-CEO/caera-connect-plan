import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
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
