# Module Reference

This is a practical map of the current source tree. Paths are relative to the repository root.

## Entrypoints and Contracts

| Path | Responsibility | Third-party relevance |
| --- | --- | --- |
| `src/bin/create.ts` | Process entrypoint, orchestration, spinner/cancellation, exit behavior | Primary CLI boundary; preserve observable output. |
| `src/prompt.ts` | Collects `ProjectConfig` through `@clack/prompts` | Prompt order and text are externally observable. |
| `src/types.ts` | Language, ORM, database, package-manager, config, and snippet types | Update when extending the configuration model. |

## Core Helpers

| Path | Responsibility |
| --- | --- |
| `src/helpers/resolveProjectName.ts` | Resolves explicit names and validates `.` current-directory mode. |
| `src/helpers/scaffoldTransaction.ts` | Stages, commits, and rolls back initialization. |
| `src/helpers/atomicWriteFile.ts` | Replaces one file atomically using a sibling temporary file. |
| `src/helpers/installDeps.ts` | Invokes the detected package manager with inherited output. |
| `src/helpers/gitInit.ts` | Best-effort Git repository and initial commit setup. |
| `src/helpers/formatOutro.ts` | Builds database-aware completion instructions. |
| `src/helpers/sharedHelper.ts` | Shared package-name, slug, sorting, and small transformation helpers. |

## Template Helpers

| Path | Responsibility |
| --- | --- |
| `src/helpers/copy-template/handleCopyTemplate.ts` | Coordinates base, ORM, database, and optional feature generation. |
| `src/helpers/copy-template/handleCopyIfExists.ts` | Copies a template layer and extracts its package snippet. |
| `src/helpers/copy-template/handlePackageSnippetUpdate.ts` | Adds the language-specific Prisma schema-builder script. |
| `src/helpers/eslint/setupEslint.ts` | Adds ESLint package metadata and config files. |
| `src/helpers/eslint/writeSnippet.ts` | Writes an ESLint package snippet. |
| `src/helpers/eslint/writeEslintConfig.ts` | Writes the selected ESLint config. |

## Package Helpers

| Path | Responsibility |
| --- | --- |
| `src/helpers/packages/detectPackageManager.ts` | Maps `npm_config_user_agent` to package-manager commands. |
| `src/helpers/packages/package-json/findSnippetFiles.ts` | Recursively finds package snippets while skipping `.git` and `node_modules`. |
| `src/helpers/packages/package-json/mergeTwo.ts` | Merges scalar package values and dependency/script maps. |
| `src/helpers/packages/package-json/adjustScriptExtensions.ts` | Converts `.ts` and `.js` script references to the selected language. |
| `src/helpers/packages/package-json/mergePackageJson.ts` | Produces the final sorted package and removes consumed snippets after success. |

## ORM and Feature Utilities

| Area | Main responsibility |
| --- | --- |
| `src/utils/prisma/` | Prisma client/config/schema generation and database-specific content. |
| `src/utils/drizzle/` | Drizzle config, schema, pool, migration, seed, and environment generation. |
| `src/utils/mongo/` | Mongoose schema, connection, and environment generation. |
| `src/utils/redis/` | Redis client, configuration, bootstrap, errors, types, and environment generation. |
| `src/utils/websocket/` | WebSocket server and socket configuration generation. |
| `src/utils/common_content.ts` | Shared dynamic application, server, route, environment, and Subatom config content. |

ORM handlers generally write dynamic files after their template layer has been copied. Constants under each ORM directory return source strings; they do not execute database operations during scaffolding.

## Templates

| Path | Role |
| --- | --- |
| `templates/template_ts/` | TypeScript base project files and package metadata. |
| `templates/template_js/` | JavaScript base project files and package metadata. |
| `templates/orm/<orm>/base/` | ORM-common files and package metadata. |
| `templates/orm/<orm>/<database>/` | Database-specific ORM files and package metadata. |
| `templates/redis/` | Redis files and dependency snippet. |
| `templates/socket/` | WebSocket files and dependency snippet. |
| `templates/vitest/` | Vitest package metadata. |
| `templates/eslint/` | ESLint package metadata. |

## Tests

| Path | Role |
| --- | --- |
| `tests/unit/` | Focused helper, generator, error, rollback, and orchestration tests. |
| `tests/e2e/expect-driver.exp` | Interactive PTY input driver. |
| `tests/e2e/run-e2e.mjs` | Matrix runner, installation, generated-source validation, artifact assertions, and cleanup. |

## Build Artifacts

- `dist/bin/create.js` is the built executable.
- `dist/templates` is copied from the repository `templates` directory by `src/helpers/copyFolder.ts` during `npm run build`.
- `coverage/` is generated test output and should not be treated as source.
- `examples/` contains sample generated projects and is useful for manual inspection, but the source templates remain authoritative.
