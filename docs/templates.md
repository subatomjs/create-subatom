# Templates and Package Snippets

## Template Composition

Templates are composable layers. The base language template is always copied first, followed by the selected ORM base, database-specific ORM template, and optional feature templates.

```text
templates/
  template_ts/
  template_js/
  orm/
    prisma/base/
    prisma/postgresql/
    prisma/mysql/
    prisma/sqlite/
    drizzle/base/
    drizzle/postgresql/
    drizzle/mysql/
    drizzle/sqlite/
    mongoose/base/
  redis/
  socket/
  vitest/
  eslint/
```

A template directory may contain source files, static assets, and one generic `package.snippet.json`.

## Base Template Requirements

A language template should provide the common project surface expected by the E2E suite, including:

- `Readme.md`
- `public/index.html`
- `package.snippet.json`
- TypeScript-only `tsconfig.json` where applicable

Dynamic files are written by `handleCopyTemplate`, so do not duplicate those files in a template unless the overwrite behavior is intentional.

## Package Snippets

A snippet is a JSON fragment merged into the generated root package. Example:

```json
{
  "dependencies": {
    "example-driver": "^1.0.0"
  },
  "devDependencies": {
    "example-cli": "^1.0.0"
  },
  "scripts": {
    "example": "node scripts/example.js"
  }
}
```

The merge rules are:

- Later sorted snippets override scalar keys from earlier snippets.
- `scripts`, `dependencies`, and `devDependencies` are merged by key.
- The generated package name is always derived from `ProjectConfig.projectName`.
- The generated package is always private.
- TypeScript projects receive `type: module` unless a snippet explicitly provides a type.
- Script extensions are adjusted to the selected language.
- Snippets are removed only after the final package write succeeds.

Use label-specific copied snippet names such as `package.snippet.orm-prisma-base.json`; the merge finder accepts the `package.snippet*.json` pattern.

## Dynamic Content

`src/utils/common_content.ts` generates files whose contents depend on language, ORM, database, Redis, and WebSocket selections. Dynamic generators include:

- `mainFileContent`
- `serverFileContent`
- `userRouterFileContent`
- `subatomConfigContent`
- `envConfigContentRelationalDb`
- `dotEnvFileContent`

When adding a new interpolation branch:

1. Add the branch to the generator.
2. Add both TypeScript and JavaScript assertions where relevant.
3. Add the corresponding files to `run-e2e.mjs` expected artifacts.
4. Add dependency/script expectations if the branch changes package metadata.
5. Run generated-source validation.

## Adding a Feature Template

For a feature named `example`:

1. Create `templates/example/`.
2. Add feature files using paths relative to the generated project root.
3. Add `templates/example/package.snippet.json` if dependencies or scripts are required.
4. Add a `useExample` field to `ProjectConfig`.
5. Add the prompt and cancellation handling.
6. Add a conditional copy job in `handleCopyTemplate`.
7. Add a post-copy configuration handler only if dynamic files are required.
8. Update package and artifact expectations in the E2E runner.
9. Add language permutations to unit tests.

Do not edit the interpolation mechanism or rename existing target paths without a migration plan.

## Adding a Database Variant

For an existing ORM:

1. Add `templates/orm/<orm>/<database>/`.
2. Add its package snippet if dependencies/scripts differ.
3. Update the ORM handler and dynamic content generators.
4. Add database-specific generated files to `run-e2e.mjs`.
5. Add source validation and package expectations.
6. Test both JavaScript and TypeScript.

The prompt layer currently restricts Prisma and Drizzle to relational databases and Mongoose to MongoDB.

## Symlinks and Paths

Template copy uses filesystem paths created with `node:path`. Keep template references relative to the configured template root; do not concatenate URL-style separators. The transaction rejects a symbolic-link target directory to avoid writing through an unexpected filesystem boundary. Symlinks inside copied template content should be tested explicitly before relying on them in published templates.
