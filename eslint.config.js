// -----------------------------------------------------------------------------
// carrot-code — ESLint flat config
//
// Enforces Constitution v1.1.0 Principle III (mechanical code-quality bars)
// and Principle IX (readable over clever — JSDoc on public exports).
//
// Flat config (eslint.config.js) is the v9+ standard; legacy .eslintrc is
// deprecated. typescript-eslint is consumed through its tseslint helper.
//
// See:
//   .specify/memory/constitution.md  — Principles III + IX
//   specs/001-vertical-slice/plan.md#technical-context
// -----------------------------------------------------------------------------

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  // --- Global ignores -------------------------------------------------------
  {
    ignores: [
      "dist/**",
      "dev-dist/**",
      "coverage/**",
      ".vite/**",
      "node_modules/**",
      "**/*.tsbuildinfo",
    ],
  },

  // --- JS recommended baseline ---------------------------------------------
  js.configs.recommended,

  // --- TypeScript: strict + type-aware --------------------------------------
  // `strictTypeChecked` brings in rules that require parserOptions.project,
  // wired below per-file-group.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // --- Project-wide TS settings --------------------------------------------
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Principle III: no `any` outside narrowly scoped, commented boundary
      // code. The boundary-code escape hatch is an inline disable-line with
      // a `// reason: ...` comment; reviewers (you-with-distance) enforce.
      "@typescript-eslint/no-explicit-any": "error",

      // Principle XI: no module-level mutable singletons. Catches the easy
      // form (`export let foo = ...`) — the structural rule still requires
      // human review for the subtle cases.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Catch the common Phaser footgun: comparing `===` against an enum
      // member that's actually a string union.
      "@typescript-eslint/strict-boolean-expressions": [
        "warn",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
        },
      ],

      // Be loud about Promise misuse — game loops + async = silent bugs.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  // --- JSDoc on public exports (Principle IX) ------------------------------
  jsdoc.configs["flat/recommended-typescript"],
  {
    files: ["src/**/*.ts"],
    rules: {
      // Require JSDoc on exported declarations only — internal helpers are
      // free to be self-documenting.
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSEnumDeclaration",
          ],
        },
      ],
      // We use TypeScript for types; no need to repeat them in JSDoc.
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns-type": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param": "off",
    },
  },

  // --- Tests: relax a few rules that get in the way -------------------------
  {
    files: ["tests/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  // --- Config files: relax type-aware rules ---------------------------------
  {
    files: ["*.config.ts", "*.config.js"],
    rules: {
      "jsdoc/require-jsdoc": "off",
    },
  },

  // --- Prettier (MUST be last so it can disable conflicting style rules) ----
  prettier
);
