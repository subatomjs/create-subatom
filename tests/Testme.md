This is a comprehensive end-to-end test for `create-subatom` that covers the **entire feature matrix** — every language, ORM, database, and feature toggle combination.

## Test Matrix (15 scenarios)

All 14 combinations of:
- **Languages**: TypeScript, JavaScript
- **ORMs**: Prisma, Drizzle, Mongoose
- **Databases**: PostgreSQL, MySQL, SQLite (for Prisma/Drizzle), MongoDB (for Mongoose)
- **Features**: Redis + ESLint + Vitest enabled on all matrix runs

Plus 1 control scenario with **all features disabled** (`ts/prisma/postgresql [no features]`) to verify feature toggles actually suppress artifacts.

## Files

### 1. `create-subatom/tests/e2e/expect-driver.exp`
Parameterized PTY driver that accepts `language, redis, eslint, vitest, orm, database` arguments. It:
- Selects the language via arrow keys (TypeScript default / JavaScript = down+Enter)
- Answers Redis/ESLint/Vitest confirms with `y`/`n` (immediate submit per @clack/codebase)
- Navigates ORM & database selects via arrow keys + Enter
- Handles the Mongoose case where the database prompt is skipped (MongoDB is implied)
- Verifies the CLI exits with the "Project created" outro

### 2. `create-subatom/tests/e2e/run-e2e.mjs`
Test runner that for **each scenario**:
1. **Builds** the CLI (if not already built)
2. **Drives** the interactive CLI via the expect driver
3. **Verifies project structure** — asserts every expected file exists with correct language extension (e.g. `main.ts` vs `main.js`, `prisma.ts` vs `prisma.js`, plus per-database extras like `src/db/dbUrl.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, etc.)
4. **Verifies package.json** — asserts correct project name, private flag, all scripts (template + ORM-specific like `build-schema`, `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed`, plus eslint `lint`/`lint:fix` and vitest `test`), all dependencies (subatom, ORM-specific adapters like `@prisma/adapter-pg`, `mysql2`, `@libsql/client`, plus `ioredis` when Redis is on), and all devDependencies per language
5. **Verifies feature toggles** — asserts Redis files (`src/redis/*`), eslint.config.mjs, and vitest `test` script are **absent** when disabled
6. **Verifies git init** — `.git` exists with at least one commit
7. **Verifies no leftover** `package.snippet*.json` files

On failure, it continues to the next scenario and reports a summary (passed/failed/total), exiting non-zero if any scenario fails.

### 3. `create-subatom/package.json`
Added `"test:e2e": "node tests/e2e/run-e2e.mjs"` script.

## Verified Result
```
[SUMMARY] Passed: 15 | Failed: 0 | Total: 15
✅ create-subatom E2E test PASSED (15 scenarios)
```

## Run the test
```bash
cd create-subatom
npm run test:e2e
```
**Prerequisites:** `expect` (built into macOS), Node.js >= 18. The full suite takes ~2-3 minutes (each scenario runs npm install).