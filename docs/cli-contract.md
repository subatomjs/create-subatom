# CLI Contract

This page documents observable behavior that third-party tooling and users can rely on.

## Invocation

```bash
npm create subatom@latest [project_name]
```

The package binary points to `dist/bin/create.js`.

### Explicit Name

```bash
npm create subatom my-api
```

The name is passed to the prompt layer and is used for the target directory and final package name after npm-name normalization.

### Current Directory

```bash
npm create subatom .
```

The current directory is used as the target. Its basename must not contain whitespace, uppercase characters, npm-disallowed characters, or an invalid npm package pattern. Invalid names produce `InvalidProjectNameError` and a non-zero exit.

## Prompt Order

The order is part of the CLI contract:

1. Language: TypeScript or JavaScript.
2. ORM: Prisma, Drizzle, Mongoose, or None.
3. Database:
   - Mongoose derives MongoDB and does not ask this question.
   - Prisma and Drizzle ask for PostgreSQL, MySQL, or SQLite.
   - None asks for PostgreSQL, MySQL, SQLite, MongoDB, or None.
4. Redis confirmation, default false.
5. ESLint confirmation, default true.
6. Vitest confirmation, default false.
7. WebSocket confirmation, default false.

Cancellation at any prompt prints `Operation cancelled.` and exits successfully with code `0`, matching the current prompt implementation.

## Output Stages

The spinner labels are observable terminal output:

- `Creating project structure`
- `Project structure created`
- `Configuring package.json`
- `package.json configured`
- `Installing dependencies`
- `Dependencies installed`
- `Initializing git repository`
- `Git repository initialized`

Failure output stops the spinner with `Something went wrong` and calls the prompt cancellation UI.

## Exit Behavior

| Situation | Behavior |
| --- | --- |
| Successful generation | Completion outro; process exits normally. |
| Invalid current-directory name | Cancellation message; exit code `1`. |
| Copy, merge, install, or transaction failure | Cancellation message; exit code `1`. |
| Git unavailable or Git commit failure | Warning; generation continues. |
| Prompt cancellation | Cancellation message; process exit code `0`. |

## Configuration Matrix

| ORM | Supported database choices |
| --- | --- |
| Prisma | PostgreSQL, MySQL, SQLite |
| Drizzle | PostgreSQL, MySQL, SQLite |
| Mongoose | MongoDB only |
| None | PostgreSQL, MySQL, SQLite, MongoDB, or None |

The generator does not connect to a database during scaffolding. It writes configuration and migration files for the selected combination.

## Compatibility Notes

- The E2E PTY driver uses the exact prompt text and ordering. Prompt changes require synchronized updates to `tests/e2e/expect-driver.exp`.
- Terminal color is forced in E2E through `TERM=xterm-256color` and `FORCE_COLOR=1`.
- E2E dependency installation can be skipped only by explicitly setting `SUBATOM_E2E_SKIP_INSTALL=1`.
- The E2E runner can limit scenarios with `SUBATOM_E2E_SCENARIO_LIMIT`, useful for local smoke tests.
