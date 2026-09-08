# create-subatom Developer Documentation

`create-subatom` is an interactive Node.js CLI that generates Subatom projects from composable language, ORM, database, and feature templates.

This documentation is written for third-party developers who need to use, integrate, extend, test, or publish the scaffolding tool.

## Documentation Map

- [Getting Started](/docs/getting-started.md): prerequisites, commands, generated output, and operational behavior.
- [Architecture](/docs/architecture.md): module boundaries, execution flow, data contracts, and filesystem transaction behavior.
- [CLI Contract](/docs/cli-contract.md): command-line arguments, prompt order, supported combinations, output, cancellation, and exit behavior.
- [Templates and Snippets](/docs/templates.md): template directory conventions, package snippets, dynamic files, and adding a feature safely.
- [Extension Guide](/docs/extension-guide.md): how to add an ORM, database, feature, package-manager behavior, or validation.
- [Testing and Release](/docs/testing-and-release.md): unit tests, coverage, Biome, E2E tests, build, publishing, and troubleshooting.

## Supported Configuration Model

The generator currently combines:

- Languages: TypeScript and JavaScript.
- ORMs: Prisma, Drizzle, Mongoose, or none.
- Databases: PostgreSQL, MySQL, SQLite, MongoDB, or none.
- Optional features: Redis, ESLint, Vitest, and WebSocket support.

The prompt layer produces one `ProjectConfig` object. Downstream modules consume that object to copy templates, generate dynamic files, merge package metadata, install dependencies, and initialize Git.

## Important Maintainer Rules

1. Preserve prompt wording and order unless the CLI contract is intentionally versioned.
2. Keep template paths and generated file names stable; users and E2E tests depend on them.
3. Add package dependencies through `package.snippet.json` files rather than hard-coding them in the merge layer.
4. Keep generated output deterministic and validate both TypeScript and JavaScript paths.
5. Run `npm run typecheck`, `npm run lint`, `npm run test:unit-coverage`, `npm run build`, and the install-backed E2E suite before publishing.
