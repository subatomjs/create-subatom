# Extension Guide

## Adding an ORM

An ORM integration spans four layers:

1. Add the ORM value to `Orm` in `src/types.ts`.
2. Add prompt behavior and valid database selection in `src/prompt.ts`.
3. Add base/database template directories under `templates/orm`.
4. Add a handler under `src/utils/<orm>` and dispatch it from `handleCopyTemplate`.

The handler should accept the target directory plus the selected language, database, and feature flags. It should write dynamic files with the repository's existing filesystem helper style and preserve generated path conventions.

Also update:

- `mainFileContent` and environment generators.
- package dependency/script expectations.
- unit tests for every language/database path.
- E2E matrix and generated artifact assertions.
- the documentation support matrix.

## Adding a Database

Use the existing database union and ORM-specific validation. A database is not merely a label: it may require a schema generator, client adapter, environment variable, migration scripts, pool implementation, and package dependencies.

Keep database connection strings in generated `.env.requirements` or equivalent setup output. Never embed real credentials in templates or tests.

## Adding a Package Manager

Package manager behavior is centralized in `src/helpers/packages/detectPackageManager.ts` and `PackageManagerInfo` in `src/types.ts`.

A new manager should provide:

```ts
interface PackageManagerInfo {
  name: PackageManager;
  installCommand: string[];
  runCommand: (script: string) => string[];
}
```

Add user-agent detection, command tests, and an E2E or integration path if the manager changes generated lockfiles or install semantics.

## Extending Git Behavior

`gitInit` is intentionally best-effort. It checks whether the target is already inside a work tree, checks Git availability, runs `git init`, creates a default `.gitignore` if absent, stages all files, and creates a local-identity initial commit.

Git errors must not make an otherwise generated project unusable unless the product contract is deliberately changed. Preserve the warning behavior and test Git-unavailable and commit-failure paths.

## Extending CLI Errors

Use typed errors for conditions that need special user-facing behavior. Keep generic stage failures inside the transaction boundary so partial output is removed. The CLI entrypoint should:

- distinguish invalid project names from unexpected resolver failures;
- stop the spinner before cancellation output;
- set a non-zero exit status for initialization failures;
- avoid unhandled top-level promise rejections.

Do not call `process.exit` deep inside reusable helpers. Helpers should reject; the CLI boundary decides how to display and exit.

## Adding a New Prompt

A new prompt must be added to `runPrompts` with:

- a typed return field;
- `exitOnCancel` handling;
- deterministic defaults;
- downstream propagation through `ProjectConfig`;
- E2E driver input at the exact position;
- unit tests for normal and canceled input.

Prompt text is an external contract because the PTY driver synchronizes on it.

## Public Versus Internal APIs

The repository's supported integration surface is the executable CLI and generated project output. Internal helpers are modular for maintainability and testing, but they are not a stable third-party runtime library API unless explicitly exported and documented.

When importing source helpers from a plugin or fork, pin the repository version and expect internal signatures to change between releases.
