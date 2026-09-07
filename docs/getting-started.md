# Getting Started

## Prerequisites

- Node.js 24 or newer, matching the `engines` declaration in `package.json`.
- npm, pnpm, yarn, or bun for dependency installation.
- Git is recommended. Git initialization is non-fatal if Git is unavailable.
- `expect` is required for the PTY-based E2E suite on macOS/Linux.

## Install and Build the CLI

From the repository root:

```bash
npm install
npm run build
```

The build performs these operations:

1. Removes `dist`.
2. Type-checks the TypeScript source.
3. Bundles `src/bin/create.ts` to `dist/bin/create.js`.
4. Copies `templates` to `dist/templates`.
5. Marks the CLI entrypoint executable.

The published package exposes `dist/bin/create.js` through the `create-subatom` binary.

## Run Locally

Run the source CLI with:

```bash
npm run dev
```

Run the built CLI directly with:

```bash
node dist/bin/create.js my-app
```

The optional project-name argument skips the project-name prompt. Passing `.` scaffolds into the current working directory after validating its directory name as an npm package name.

## Generated Project Lifecycle

A normal run performs the following stages:

1. Resolve the CLI project-name argument.
2. Ask the interactive language, ORM, database, and feature questions.
3. Stage the target directory in a transaction-owned sibling directory.
4. Copy the base language and selected feature/ORM templates.
5. Generate dynamic files such as `main.ts`/`main.js`, server files, route files, environment setup, and configuration files.
6. Merge all package snippets into `package.json` and remove consumed snippets.
7. Install dependencies using the package manager that launched the CLI.
8. Initialize Git and create a first commit when possible.
9. Atomically replace the destination with the staged project.
10. Print the completion instructions.

If a mutating stage fails, the transaction removes staged output and restores the original target directory when one existed.

## Package Manager Detection

The CLI checks `npm_config_user_agent`:

- `pnpm` selects pnpm.
- `yarn` selects yarn.
- `bun` selects bun.
- `npm` or an unknown/unset value selects npm.

The generated project is installed with that manager's install command. To intentionally bypass installation for local E2E debugging only:

```bash
SUBATOM_E2E_SKIP_INSTALL=1 npm run test:e2e
```

Normal CLI usage does not skip installation.

## Generated Project Verification

After generation, third-party integrations should run in the generated directory:

```bash
npm install
npm run build
npm test
```

Database migration commands require real connection settings and are not executed by the scaffolding E2E suite.
