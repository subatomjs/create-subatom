# Testing and Release

## Local Commands

Run these commands from the repository root:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:unit-coverage
npm run build
npm run test:e2e
```

Expected meanings:

- `typecheck`: validates strict TypeScript compilation for `src`.
- `lint`: runs Biome diagnostics over `src` and `tests`.
- `test:unit`: runs Vitest without coverage enforcement.
- `test:unit-coverage`: runs Vitest with V8 coverage and 100% global thresholds.
- `build`: creates the distributable CLI and copies templates to `dist/templates`.
- `test:e2e`: builds if needed, drives the CLI through a PTY, installs dependencies, validates generated output, and cleans up temporary directories.

## Biome

Biome configuration lives in `biome.json`. Use:

```bash
npm run lint
npm run lint:fix
```

The lint command is intentionally focused on source and test code. Generated `dist` content and template payloads are not treated as ordinary application source by the package script.

## Unit Test Design

Unit tests should isolate side effects with mocks for:

- `fs-extra` and `node:fs/promises`;
- `execa` subprocesses;
- `@clack/prompts` prompt and spinner methods;
- helper modules at orchestration boundaries.

High-risk cases to retain:

- missing template directories;
- malformed package snippets;
- write, rename, permission, and disk-full failures;
- symbolic-link targets;
- existing non-empty target directories;
- rollback after partial initialization;
- Git unavailable and Git commit failure;
- package-manager detection for npm, pnpm, yarn, bun, and unknown agents;
- prompt cancellation and resolver errors;
- TypeScript and JavaScript output for every ORM/database path.

## Coverage

`vitest.config.ts` uses the V8 provider and enforces 100% global statements, branches, functions, and lines. Do not reduce thresholds to make a change pass. Add a focused test for every new branch or update an existing exhaustive permutation test.

Coverage excludes infrastructure and declaration/configuration files listed in the config. It should not be used to hide application logic or generated-content branches accidentally.

## E2E Matrix

The E2E runner covers:

- both languages;
- Prisma, Drizzle, Mongoose, and a no-ORM control path;
- valid database combinations;
- Redis, ESLint, and Vitest enabled paths;
- all-features-disabled behavior;
- existing-directory preservation;
- dependency installation;
- Prisma client generation;
- generated TypeScript `tsc --noEmit` validation;
- generated JavaScript `node --check` validation;
- package, Git, snippet, and file-layout assertions.

Useful controls:

```bash
SUBATOM_E2E_SCENARIO_LIMIT=1 npm run test:e2e
SUBATOM_E2E_SKIP_INSTALL=1 npm run test:e2e
```

The first is a fast smoke limit. The second is an explicit offline mode and must not be used as evidence that dependency installation works.

The E2E driver forces `TERM=xterm-256color`, `FORCE_COLOR=1`, and `CI=1` so interactive output remains readable and deterministic. It synchronizes on exact prompt text; prompt changes require driver changes.

## Release Checklist

1. Update version metadata intentionally.
2. Run `npm install` and confirm the lockfile is consistent.
3. Run typecheck, Biome, unit tests, 100% coverage, and build.
4. Run at least one install-backed E2E smoke scenario.
5. Run the full install-backed E2E matrix before publishing.
6. Inspect `dist/bin/create.js` and `dist/templates` after build.
7. Test the package from a disposable directory with the published binary shape.
8. Review `npm audit` output and document unresolved dependency risks.
9. Confirm no credentials, local paths, temporary files, or coverage artifacts are included in the package.
10. Publish only after generated projects install and source validation succeeds.

## Known Boundaries

The E2E suite does not connect to PostgreSQL, MySQL, MongoDB, or Redis, and it does not run database migrations. Those operations require external services and environment-specific credentials. Generated applications still need environment configuration, database migration validation, runtime tests, and deployment checks in their own environments.
