# CLI Contract

This document describes the observable behavior of `create-subatom` that users, automation, and integration tests can rely on.

## Invocation

```bash
npm create subatom@latest [project-name]
```

The published package exposes the `create-subatom` binary through:

```text
dist/bin/create.js
```

### Explicit project name

```bash
npm create subatom@latest my-api
```

The supplied name is passed to the prompt layer and becomes the generated project's target directory name and `package.json` name.

### Current directory

```bash
npm create subatom@latest .
```

The CLI scaffolds into the current directory instead of creating a new child directory.

The current directory's basename must be a valid npm package name. The CLI rejects names containing whitespace, uppercase letters, npm-disallowed characters (`~ ' ! ( ) *`), names beginning with `.` or `_`, or names that fail the npm package-name pattern.

Invalid names produce `InvalidProjectNameError` and the CLI exits with a non-zero status.

## Prompt Contract

After resolving the project name, prompts occur in this exact order:

1. **Language**
   - TypeScript
   - JavaScript

2. **ORM**
   - Prisma
   - Drizzle
   - Mongoose
   - None

3. **Database**
   - If ORM is **Mongoose**, MongoDB is selected automatically and no database prompt is shown.
   - If ORM is **Prisma** or **Drizzle**, the choices are PostgreSQL, MySQL, and SQLite.
   - If ORM is **None**, the choices are PostgreSQL, MySQL, SQLite, MongoDB, or None.

4. **Redis**
   - Default: `false`

5. **ESLint**
   - Default: `true`

6. **Vitest**
   - Default: `false`

7. **WebSocket**
   - Default: `false`

The CLI currently uses these prompt messages:

```text
Select a language:
Select an ORM:
Select a database:
Select a database (or skip):
Would you like to configure Redis?
Would you like to setup ESLint?
Would you like to add Vitest?
Does your project need a WebSocket connection?
```

Prompt text and ordering are part of the observable CLI contract because the E2E PTY driver synchronizes against them.

## Cancellation

Cancelling any interactive prompt prints:

```text
Operation cancelled.
```

and exits successfully with code `0`.

## Generation Stages

A normal generation run performs these stages:

1. Resolve the project-name argument.
2. Collect language, ORM, database, and feature selections.
3. Create the project inside a transaction-owned staging directory.
4. Copy the base language and selected ORM/feature templates.
5. Generate dynamic files such as the main entry point, server/routes, environment setup, and configuration.
6. Merge package snippets into the generated `package.json`.
7. Install dependencies using the package manager that launched the CLI.
8. Initialize Git when possible.
9. Atomically replace the destination with the staged project.
10. Print the completion message.

Observable spinner messages are:

```text
Creating project structure
Project structure created
Configuring package.json
package.json configured
Installing dependencies
Dependencies installed
Initializing git repository
Git repository initialized
```

If a mutating stage fails, the transaction cleans up staged output and restores an existing destination when applicable.

## Exit Behavior

| Situation | Behavior |
|---|---|
| Successful generation | Completion outro; normal exit |
| Invalid project name | Cancellation/error output; exit code `1` |
| Initialization/copy/merge/install/transaction failure | Cancellation/error output; exit code `2` |
| Prompt cancellation | `Operation cancelled.`; exit code `0` |
| Git unavailable or Git initialization/commit failure | Warning; generation continues |

## Configuration Matrix

| ORM | Database choices |
|---|---|
| Prisma | PostgreSQL, MySQL, SQLite |
| Drizzle | PostgreSQL, MySQL, SQLite |
| Mongoose | MongoDB only |
| None | PostgreSQL, MySQL, SQLite, MongoDB, None |

The scaffolder does not connect to a database during project generation. It creates the selected configuration, schema/migration, and related files supplied by the corresponding templates.

## Package Manager Detection

The CLI detects the package manager from `npm_config_user_agent`.

Supported managers:

- npm
- pnpm
- yarn
- bun

Unknown or missing user-agent information falls back to npm.

The detected manager is used to install generated dependencies.

## Compatibility Notes

The E2E PTY driver depends on the exact prompt text and ordering. Changes to prompts must therefore be synchronized with:

```text
tests/e2e/expect-driver.exp
```

For E2E execution:

```text
TERM=xterm-256color
FORCE_COLOR=1
```

are used to provide deterministic terminal behavior.

The E2E suite can skip dependency installation only when explicitly configured with:

```bash
SUBATOM_E2E_SKIP_INSTALL=1
```

Scenario execution can be limited with:

```text
SUBATOM_E2E_SCENARIO_LIMIT
```
