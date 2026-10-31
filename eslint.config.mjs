import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["node_modules/**", ".build/**", "dist/**", "sw.js", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.ts"], languageOptions: { globals: globals.browser } },
  { files: ["src/service-worker.ts"], languageOptions: { globals: globals.serviceworker } },
  {
    files: ["**/*.cjs", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        EmberlineDebug: "readonly",
        Emberline: "readonly",
        audioCount: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  prettier,
);
