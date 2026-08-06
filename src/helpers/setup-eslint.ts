// src/helpers/setup-eslint.ts
import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig, PackageJsonSnippet } from "../types.js";

/**
 * Writes ESLint devDependencies/scripts (as a package.snippet file, merged
 * later by mergePackageJson) and the eslint.config.mjs file itself.
 * No-op if the user opted out of ESLint.
 */
export async function setupEslint(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  if (!config.useEslint) return;

  if (config.language === "ts") {
    await writeSnippet(targetDir, {
      devDependencies: {
        "eslint": "^9.39.5",
        "@eslint/js": "^9.39.5",
        "typescript-eslint": "^8.66.0"
      },
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix"
      },
    });

    await writeEslintConfig(targetDir, TS_ESLINT_CONFIG);
  } else if (config.language === "js") {
    await writeSnippet(targetDir, {
      devDependencies: {
        "eslint": "^9.39.5",
        "@eslint/js": "^9.39.5"
      },
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix"
      },
    });

    await writeEslintConfig(targetDir, JS_ESLINT_CONFIG);
  }
}

async function writeSnippet(
  targetDir: string,
  snippet: PackageJsonSnippet,
): Promise<void> {
  const snippetPath = path.join(targetDir, "package.snippet.eslint.json");
  await fs.writeJson(snippetPath, snippet, { spaces: 2 });
}

async function writeEslintConfig(
  targetDir: string,
  contents: string,
): Promise<void> {
  const configPath = path.join(targetDir, "eslint.config.mjs");
  await fs.writeFile(configPath, contents, "utf8");
}

const TS_ESLINT_CONFIG = `// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
    {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // your custom rule overrides
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'build/**'],
  }
);
`;

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