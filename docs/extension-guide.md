# Extension Guide

This guide explains how to extend `create-subatom` while preserving its architecture, generated-project behavior, tests, and CLI contract.

## Architecture of an Extension

A new generator capability normally spans several layers:

1. **Types/configuration** — add the new value to the appropriate type in `src/types.ts`.
2. **Prompt/config collection** — update `src/prompt.ts` when the user must choose or confirm the feature.
3. **Templates** — add or update the appropriate files under `templates/`.
4. **Generation logic** — update the relevant copy/template handler or helper.
5. **Package configuration** — add dependency/script snippets where required.
6. **Tests** — cover the new behavior in unit tests and, where applicable, E2E scenarios.
7. **Documentation** — update the support matrix and user-facing documentation.

Do not add a new feature only to the prompt layer. A selection must propagate through `ProjectConfig` and affect the generated project consistently.

## Adding an ORM

An ORM integration should cover:

- the ORM type in `src/types.ts`;
- prompt behavior and valid database combinations in `src/prompt.ts`;
- ORM/base/database templates under `templates/`;
- the appropriate generation handler;
- dynamic files such as the main application entry point and environment configuration;
- package dependencies and scripts;
- unit tests for supported language/database combinations;
- E2E scenarios and generated-artifact assertions;
- the documentation support matrix.

The handler should receive the generated-project context required by the existing template pipeline, including language, database, and feature selections.

Database compatibility must be explicit. For example, the current CLI treats Mongoose as MongoDB-only and Prisma/Drizzle as PostgreSQL/MySQL/SQLite integrations.

## Adding a Database

Adding a database is more than adding a label.

Determine whether the database requires:

- schema generation;
- a client/adapter;
- environment variables;
- migrations;
- connection/pool setup;
- package dependencies;
- language-specific templates.

Update ORM-specific validation so unsupported combinations cannot be selected.

Database credentials must never be embedded in templates or tests. Generated configuration should use environment-based connection settings.

## Adding a Package Manager

Package-manager behavior is centralized in:

```text
src/helpers/packages/detectPackageManager.ts
src/types.ts
```

A supported package manager provides:

```ts
interface PackageManagerInfo {
  name: PackageManager;
  installCommand: string[];
  runCommand: (script: string) => string[];
}
```

When adding another manager:

1. Add it to the `PackageManager` type.
2. Add its installation and script commands.
3. Add detection based on `npm_config_user_agent`.
4. Add unit tests.
5. Add integration/E2E coverage when its behavior changes generated lockfiles or installation semantics.

## Extending Git Behavior

Git initialization is intentionally best-effort.

Git-related behavior must not make an otherwise valid generated project unusable merely because Git is unavailable or Git initialization/commit fails.

When changing Git behavior, preserve coverage for:

- Git unavailable;
- existing Git work tree;
- initialization;
- `.gitignore` handling;
- initial commit;
- commit failure.

Keep Git-specific failures separate from the core scaffolding transaction unless the product contract is intentionally changed.

## Extending CLI Errors

Use typed errors for conditions that require special user-facing handling.

The CLI boundary should:

- distinguish invalid project names from unexpected failures;
- stop the spinner before displaying failure/cancellation output;
- return a non-zero status for initialization failures;
- prevent unhandled top-level promise rejections.

Reusable helpers should reject/throw rather than calling `process.exit()` themselves. Exit behavior belongs at the CLI boundary.

## Adding a New Prompt

A new prompt must be integrated into `runPrompts` and must:

- have a typed return value;
- use cancellation handling;
- have a deterministic default when appropriate;
- propagate its result through `ProjectConfig`;
- be placed deliberately in the prompt sequence;
- be represented at the exact corresponding position in the E2E driver;
- have unit coverage for normal and cancelled input.

Prompt text and ordering are externally observable because the E2E PTY driver synchronizes on them. Treat prompt changes as CLI-contract changes.

## Templates and Generated Output

Template changes should preserve the existing generated-project conventions.

When adding generated files:

- place them in the appropriate template hierarchy;
- ensure language-specific variants remain consistent;
- update package snippets when dependencies/scripts change;
- verify the generated directory structure;
- verify generated `package.json`;
- verify environment/configuration output;
- add generated-artifact assertions to tests.

The generator should continue to produce a complete, runnable project for every supported configuration.

## Public vs Internal APIs

The primary supported integration surface of `create-subatom` is:

1. the executable CLI;
2. the generated project output.

Internal helpers are organized for maintainability and testing. They should not be treated as stable third-party runtime APIs unless they are explicitly exported and documented as such.

Plugins, forks, or tooling that imports internal source helpers should pin a repository/package version and expect internal signatures to change between releases.
