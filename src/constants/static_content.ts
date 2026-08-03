// const schemaContent = (
//   database: "postgresql" | "mysql" | "sqlite" | string,
// ): string => {
//   return `datasource db {
//   provider = "${database}"
// }

// generator client {
//   provider        = "prisma-client-js"
//   binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
//   previewFeatures = []
// }
// `;
// };

// const prismaConfig = (): string => {
//   return `
//     import "dotenv/config";
//     import { defineConfig } from "prisma/config";
//     import __env from "./src/config/__env";

//     const DATABASE_URL = process.env.DATABASE_URL ?? __env.DATABASE_URL;

//     const config = defineConfig({
//       schema: "prisma/schema.prisma",
//       migrations: { path: "prisma/migrations" },
//       datasource: { url: DATABASE_URL ?? "" },
//     });

//     module.exports = config;
//     `;
// };

// const prismaFileGenerate = (
//   database: "postgresql" | "mysql" | "sqlite" | string,
//   driver?: "better-sqlite3" | "libsql" | "d1" | string,
// ) => {
//   if (database === "postgresql") {
//     return `
// import { PrismaClient } from "@prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";
// import __env from "./src/config/__env";

// const pool = new Pool({
//   connectionString: __env.DATABASE_URL,
// });

// const adapter = new PrismaPg(pool);

// export const prisma = new PrismaClient({
//   adapter,
//   log: ["warn", "error"],
// });

// export default prisma;

//   `;
//   } else if (database === "mysql") {
//     return `
// import { PrismaClient } from "@prisma/client";
// import { PrismaMariaDb } from "@prisma/adapter-mariadb";
// import mariadb from "mariadb";
// import __env from "./src/config/__env";

// const url = new URL(__env.DATABASE_URL);

// const pool = mariadb.createPool({
//   host: url.hostname,
//   port: parseInt(url.port || "3306", 10),
//   user: url.username,
//   password: url.password,
//   database: url.pathname.replace(/^\\//, ""),
//   connectionLimit: 10,
// });

// // Create the Prisma driver adapter
// const adapter = new PrismaMariaDb(pool);

// export const prisma = new PrismaClient({
//   adapter,
//   log: ["warn", "error"],
// });

// export default prisma;
//     `;
//   } else {
//     if (driver === "libsql") {
//       return `
// import { PrismaClient } from "@prisma/client";
// import { PrismaLibsql } from "@prisma/adapter-libsql";
// import Database from "libsql";
// import __env from "./src/config/__env";

// const db = new Database(__env.DATABASE_URL);

// // Create the Prisma driver adapter
// const adapter = new PrismaLibsql(db);

// export const prisma = new PrismaClient({
//   adapter,
//   log: ["warn", "error"],
// });

// export default prisma;

//     `;
//     }

//     if (driver === "d1") {
//       return `
// import { PrismaClient } from "@prisma/client";
// import { PrismaD1 } from "@prisma/adapter-d1";
// import Database from "d1";
// import __env from "./src/config/__env";

// const db = new Database(__env.DATABASE_URL);

// // Create the Prisma driver adapter
// const adapter = new PrismaD1(db);

// export const prisma = new PrismaClient({
//   adapter,
//   log: ["warn", "error"],
// });

// export default prisma;

//     `;
//     }

//     // Default to better-sqlite3 if no driver is specified
//     return `
// import { PrismaClient } from "@prisma/client";
// import { PrismaBetterSqlite } from "@prisma/adapter-better-sqlite3";
// import Database from "better-sqlite3";
// import __env from "./src/config/__env";

// const db = new Database(__env.DATABASE_URL);

// // Create the Prisma driver adapter
// const adapter = new PrismaBetterSqlite(db);

// export const prisma = new PrismaClient({
//   adapter,
//   log: ["warn", "error"],
// });

// export default prisma;

//     `;
//   }
// };

// export { schemaContent, prismaConfig, prismaFileGenerate };

import type { Database } from "../types.js";

type SqlDatabase = Exclude<Database, "mongodb">;

/**
 * Generates the contents of `prisma/schema.prisma` for the selected
 * database provider.
 *
 * Targets Prisma ORM 7's driver-adapter architecture:
 *  - generator provider is "prisma-client" (NOT the legacy "prisma-client-js")
 *  - `output` is required — v7 no longer generates into node_modules
 *  - no `binaryTargets` — there is no Rust query engine binary to target
 *  - no `url` in the datasource block — the connection URL lives in
 *    prisma.config.ts, not the schema, as of v7
 */
export function schemaContent(database: SqlDatabase): string {
  return `datasource db {
  provider = "${database}"
}

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
`;
}

/**
 * Generates the contents of `prisma.config.ts` (the `language === "js"`
 * caller is responsible for writing this to a `.js` filename; the file
 * contents are the same ESM shape either way).
 */
export function prismaConfig(): string {
  return `import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
`;
}

/**
 * Generates the Prisma Client bootstrap file (`prisma.ts` / `prisma.js`)
 * wired to the correct driver adapter for the selected database — and,
 * for SQLite, the selected connection type.
 *
 * @param database      The selected SQL database. MongoDB is intentionally
 *                       excluded — the mongoose ORM path never reaches
 *                       this generator.
 * @param sqliteDriver   Required when database === "sqlite". Every branch
 *                       below is exhaustively typed so a missing case is a
 *                       compile-time error, not a runtime `undefined`.
 */
export function prismaFileGenerate(database: SqlDatabase): string {
  switch (database) {
    case "postgresql":
      return postgresClientFile();
    case "mysql":
      return mysqlClientFile();
    case "sqlite":
      return sqliteClientFile();
    default: {
      const exhaustiveCheck: never = database;
      throw new Error(
        `prismaFileGenerate: unsupported database "${exhaustiveCheck}"`,
      );
    }
  }
}

function postgresClientFile(): string {
  return `import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import __env from "./src/config/__env.js";

if (!__env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your .env file, e.g.\\n' +
      'DATABASE_URL="postgresql://user:password@localhost:5432/mydb"',
  );
}

const adapter = new PrismaPg({ connectionString: __env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
`;
}

function mysqlClientFile(): string {
  return `import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import __env from "./src/config/__env.js";

if (!__env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your .env file, e.g.\\n' +
      'DATABASE_URL="mysql://user:password@localhost:3306/mydb"',
  );
}

const connectionUrl = new URL(__env.DATABASE_URL);
const databaseName = connectionUrl.pathname.replace(/^\\//, "");

if (!databaseName) {
  throw new Error(
    "DATABASE_URL is missing a database name (the path segment after the " +
      'host), e.g. "mysql://user:password@localhost:3306/mydb".',
  );
}

const adapter = new PrismaMariaDb({
  host: connectionUrl.hostname,
  port: connectionUrl.port ? Number(connectionUrl.port) : 3306,
  user: decodeURIComponent(connectionUrl.username),
  password: decodeURIComponent(connectionUrl.password),
  database: databaseName,
  connectionLimit: 10,
});

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
`;
}

function sqliteClientFile(): string {
  return `import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import __env from "./src/config/__env.js";

if (!__env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your .env file, e.g.\\n' +
      'DATABASE_URL="file:./dev.db"',
  );
}

const adapter = new PrismaBetterSqlite3({ url: __env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
`;
}



