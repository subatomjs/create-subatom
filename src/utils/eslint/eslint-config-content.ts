const TS_ESLINT_CONFIG = `import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    //Add your custom config...
  },
  {
    ignores: ["dist/**", "node_modules/**", "build/**"],
  },
);
`
const JS_ESLINT_CONFIG = `import js from '@eslint/js';
import globals from 'globals';

export default [
  // 1. Recommended JavaScript rules
  js.configs.recommended,

  // 2. Global environment and language settings
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Change to 'commonjs' if using require()
      globals: {
        ...globals.node, // Provides process, __dirname, Buffer, etc.
      },
    },

    rules: {
      // Best Practices & Clean Code
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],

      // Async/Node.js Error Handling
      'no-return-await': 'off', // Deprecated in favor of native V8 optimizations
      'require-await': 'error',
      'no-process-exit': 'off', // Useful to disable in CLI scripts, enable if strict API

      // Code Formatting & Cleanliness
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'object-shorthand': ['error', 'always'],
    },
  },

  // 3. Global Ignores
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
    ],
  },
];
`;

export { TS_ESLINT_CONFIG, JS_ESLINT_CONFIG };
