# Getting Started

`create-subatom` is the CLI scaffolder for creating a new Subatom project from the command line.

## Prerequisites

- **Node.js 24 or newer**.
- One of the supported package managers: **npm, pnpm, yarn, or bun**.
- Git is recommended. Git initialization is best-effort and does not prevent project generation when Git is unavailable.
- `expect` is required for the PTY-based E2E test suite on macOS/Linux.

The Node.js requirement is declared by the package's `engines` field.

## Use the Published CLI

Create a project with:

```bash
npm create subatom@latest my-app
```

The CLI interactively asks for:

1. Language — TypeScript or JavaScript.
2. ORM — Prisma, Drizzle, Mongoose, or None.
3. Database — based on the selected ORM.
4. Redis.
5. ESLint.
6. Vitest.
7. WebSocket.

You can also scaffold into the current directory:

```bash
npm create subatom@latest .
```

When using `.`, the current directory name must be a valid npm package name.

## Install and Build from Source

From the repository root:

```bash
npm install
npm run build
```

The build process:

1. Removes `dist`.
2. Type-checks the TypeScript source.
3. Bundles the CLI entry point.
4. Copies the `templates` directory into the distribution.
5. Marks the CLI entry point executable.

The published package exposes:

```text
dist/bin/create.js
```

through the `create-subatom` binary.

## Run the CLI Locally

Run the TypeScript source directly:

```bash
npm run dev
```

Run the built CLI directly:

```bash
node dist/bin/create.js my-app
```

The optional project-name argument avoids the interactive project-name prompt.

## What Happens During Generation

A normal run follows this lifecycle:

1. Resolve the project-name argument.
2. Collect the interactive configuration.
3. Create a temporary staging directory.
4. Copy the base and selected feature/ORM templates.
5. Generate dynamic source/configuration files.
6. Merge package snippets into `package.json`.
7. Install dependencies using the detected package manager.
8. Initialize Git when possible.
9. Atomically replace the destination with the completed project.
10. Display completion instructions.

The scaffolding process is transaction-based. If a mutating stage fails, staged output is removed and an existing destination is restored when applicable.

## Package Manager Detection

The CLI uses `npm_config_user_agent` to determine which package manager launched it.

| Detected manager | Install command |
|---|---|
| npm | `install` |
| pnpm | `install` |
| yarn | `install` |
| bun | `install` |

If the user agent is missing or unknown, npm is used.

Normal CLI usage installs dependencies. The E2E-only environment variable:

```bash
SUBATOM_E2E_SKIP_INSTALL=1
```

can bypass installation for local E2E debugging.

## Verify a Generated Project

After scaffolding, work inside the generated directory.

Typical project verification commands are:

```bash
npm install
npm run build
npm test
```

Use the generated project's own package scripts and selected configuration when the template provides additional commands.

Database migrations require real database connection settings and are not executed by the scaffolding E2E suite.

## Cancellation and Failures

Cancelling an interactive prompt prints:

```text
Operation cancelled.
```

and exits with status `0`.

Invalid project names and initialization failures produce non-zero exit statuses.

Git failures are non-fatal: the project can still be generated when Git initialization or the initial commit cannot be completed.
