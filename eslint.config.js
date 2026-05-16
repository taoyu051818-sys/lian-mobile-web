import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "public/assets/",
      "public/tools/",
      "*.config.*",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  ...vue.configs["flat/recommended"],

  prettier,

  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },

  // TypeScript and Vue files: disable no-undef (TypeScript handles this)
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "no-undef": "off",
    },
  },

  // Scripts and test .mjs files: add Node.js globals
  {
    files: ["scripts/**/*.js", "tests/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ["src/**/*.{ts,vue}", "tests/**/*.{ts,mjs,js}", "scripts/**/*.js"],
    rules: {
      "no-console": "error",
      "no-debugger": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-constant-binary-expression": "off",

      "vue/require-v-for-key": "error",
      "vue/no-mutating-props": "error",
      "vue/no-dupe-keys": "warn",
      "vue/require-explicit-emits": "warn",
      "vue/multi-word-component-names": "off",
    },
  },

  // Test and script files: allow console (used for test output and CLI reporting)
  {
    files: ["tests/**/*.{ts,mjs,js}", "scripts/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
];
