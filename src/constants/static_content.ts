import type { Database, Language, Orm } from "../types.js";

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

// .env create
export function generateEnv(): string {
  return `
/// <reference types="node" />
import * as fs from "fs";

const source = ".env.requirement";
const destination = ".env";

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("✅ Created .env from .env.requirement");
} else {
  console.log("ℹ️ .env already exists");
}
    
    `;
}

export function schemaContent(
  database: SqlDatabase,
  language: Language,
): string {
  if (
    language === "js" &&
    (database === "postgresql" || database === "mysql" || database === "sqlite")
  ) {
    return `
  generator client {
  provider = "prisma-client-js"
  }

datasource db {
  provider = "${database}"
}


      `;
  } else {
    return `datasource db {
  provider = "${database}"
}

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
`;
  }
}

/**
 * Generates the contents of `prisma.config.ts` (the `language === "js"`
 * caller is responsible for writing this to a `.js` filename; the file
 * contents are the same ESM shape either way).
 */
export function prismaConfig(): string {
  return `
import {configEnv} from 'subatom'
configEnv() 
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

// main.js || main.ts
// export function mainFileContent(
//   database: Database,
//   orm: Orm,
//   fileType: Language,
//   projectName: string,
// ): string {
//   const relationalDbs: Database[] = ["postgresql", "sqlite", "mysql"];

//   // 1. Validate supported combinations
//   if (orm === "mongoose" && database !== "mongodb") {
//     return "// Unsupported database configuration: Mongoose only supports MongoDB.";
//   }
//   if (
//     (orm === "prisma" || orm === "drizzle") &&
//     !relationalDbs.includes(database)
//   ) {
//     return `// Unsupported database configuration: ${orm} only supports relational databases (PostgreSQL, MySQL, SQLite).`;
//   }

//   // 2. Language specifics
//   const isTs = fileType === "ts";
//   const returnType = isTs ? ": Promise<void>" : "";

//   // 3. Imports + health-check/shutdown wiring per ORM
//   //    Contract: each connection module exports
//   //      checkDatabaseConnection(): Promise<boolean>
//   //      closeDatabase(): void | Promise<void>
//   let imports = "";
//   let connectedLog = "";

//   if (orm === "mongoose") {
//     imports = `import { checkDatabaseConnection, closeDatabase } from "./src/config/mongoConnect.js";\n`;
//     connectedLog = `console.log("✅ Connected to ${database} (Mongoose) successfully");`;
//   } else if (orm === "prisma") {
//     imports = `import { checkDatabaseConnection, closeDatabase } from "./prisma.js";\n`;
//     connectedLog = `console.log("✅ Connected to ${database} (Prisma) successfully");`;
//   } else if (orm === "drizzle") {
//     imports = `import { checkDatabaseConnection, closeDatabase } from "./src/db/db_pool.js";\n`;
//     connectedLog = `console.log("✅ Connected to ${database} (Drizzle) successfully");`;
//   }

//   // 4. Return unified template
//   return `//! Adjust path according to your project if mismatch..
// import __env from "./src/config/__env.js";
// import server from "./src/server.js";
// ${imports}
// async function main()${returnType} {
//   const healthy = await checkDatabaseConnection();
//   if (!healthy) {
//     console.error("❌ Database health check failed. Aborting startup.");
//     process.exit(1);
//   }
//   ${connectedLog}

//   server.listen(__env.PORT || 8080, __env.HOST, "${projectName}");
// }

// process.on("SIGINT", () => { closeDatabase(); process.exit(0); });
// process.on("SIGTERM", () => { closeDatabase(); process.exit(0); });

// await main();
// `;
// }


// main.js || main.ts
export function mainFileContent(
  database: Database,
  orm: Orm,
  fileType: Language,
  projectName: string,
): string {
  const relationalDbs: Database[] = ["postgresql", "sqlite", "mysql"];

  // 1. Validate supported combinations
  if (orm === "mongoose" && database !== "mongodb") {
    return "// Unsupported database configuration: Mongoose only supports MongoDB.";
  }
  if (
    (orm === "prisma" || orm === "drizzle") &&
    !relationalDbs.includes(database)
  ) {
    return `// Unsupported database configuration: ${orm} only supports relational databases (PostgreSQL, MySQL, SQLite).`;
  }

  // 2. Language specifics
  const isTs = fileType === "ts";
  const returnType = isTs ? ": Promise<void>" : "";
  const logError = isTs ? "error as Error" : "error";

  // 3. Imports and connection logic based on ORM
  let imports = "";
  let connectLogic = "";
  let errorMessage = "";
  let connectedLog = "";

  if (orm === "mongoose") {
    imports = `import connectDB from "./src/config/mongoConnect.js";\n`;
    connectLogic = `await connectDB();`;
    errorMessage = `"❌ Something went wrong:", ${logError}`;
  } else if (orm === "prisma") {
    imports = `import prisma from "./prisma.js";\n`;
    connectLogic = `await prisma.$connect();\n        console.log("✅ Connected to ${database} (Prisma) successfully");`;
    errorMessage = `"❌ Failed to connect to ${database}:", ${logError}`;
  } else if (orm === "drizzle" && database !== "sqlite") {
    imports = `import { db } from "./src/db/db_pool.js";\nimport { sql } from "drizzle-orm";\n`;
    connectLogic = `// Verify pool connection\n        await db.execute(sql\`SELECT 1\`);\n        console.log("✅ Connected to ${database} (Drizzle) successfully");`;
    errorMessage = `"❌ Failed to connect to ${database}:", ${logError}`;
  }else if(orm === "drizzle" && database === "sqlite"){
    imports = `import { checkDatabaseConnection, closeDatabase } from "./src/db/db_pool.js";\n`;
    connectedLog = `console.log("✅ Connected to ${database} (Drizzle) successfully");`;
  }

  // 4. Return unified template
  if(orm === "drizzle" && database === "sqlite"){
      return `//! Adjust path according to your project if mismatch..
import __env from "./src/config/__env.js";
import server from "./src/server.js";
${imports}
async function main()${returnType} {
  const healthy = await checkDatabaseConnection();
  if (!healthy) {
    console.error("❌ Database health check failed. Aborting startup.");
    process.exit(1);
  }
  ${connectedLog}

  server.listen(__env.PORT || 8080, __env.HOST, "${projectName}");
}

process.on("SIGINT", () => { closeDatabase(); process.exit(0); });
process.on("SIGTERM", () => { closeDatabase(); process.exit(0); });

await main();
`;
  }else{
  return `//! Adjust path according to your project if mismatch..  
import __env from "./src/config/__env.js";
import server from "./src/server.js";
${imports}
async function main()${returnType} {
    try {
        ${connectLogic}

        // Server listen
        server.listen(__env.PORT || 8080, __env.HOST, "${projectName}");
    } catch (error) {
        console.error(${errorMessage});
        process.exit(1);
    }
}

await main();
`;}
}


export function subatomConfigGenerate(language: Language): string {
  if (language === "js") {
    return `
      import { defineConfig } from "subatom";

      export default defineConfig({
             port: 8080,
             host: "localhost",
             outDir: "build",
             entry:"main.js",
             watch: {
                    extensions: ["js", "jsx"],
                    debounceMs: 500,
                    ignore: ["**/logs/**"],
        }
      });
    `;
  } else {
    return `
      import { defineConfig } from "subatom";

      export default defineConfig({
             port: 8080,
             host: "localhost",
             outDir: "build",
             sourcemap: true,
             minify: true,
             entry:"main.ts",
             watch: {
                    extensions: ["ts", "tsx", "js", "jsx"],
                    debounceMs: 500,
                    ignore: ["**/logs/**"],
        }
      });
    `;
  }
}

/**
 * Generates the Prisma Client bootstrap file (`prisma.ts` / `prisma.js`)
 * wired to the correct driver adapter for the selected database.
 *
 * @param database      The selected SQL database. MongoDB is intentionally
 *                       excluded — the mongoose ORM path never reaches
 *                       this generator.
 */
export function prismaFileGenerate(
  database: SqlDatabase,
  language: Language,
): string {
  switch (database) {
    case "postgresql":
      return postgresClientFile(language);
    case "mysql":
      return mysqlClientFile(language);
    case "sqlite":
      return sqliteClientFile(language);
    default: {
      const exhaustiveCheck: never = database;
      throw new Error(
        `prismaFileGenerate: unsupported database "${exhaustiveCheck}"`,
      );
    }
  }
}

// POSTGRESQL DB
function postgresClientFile(language: Language): string {
  if (language === "js") {
    return `
import { createRequire } from "module";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import __env from "./src/config/__env.js";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const { Pool } = pg;

const pool = new Pool({
  connectionString: __env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;

      `;
  } else {
    return `
import { PrismaClient } from "./generated/prisma/client.js";
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
}

// MYSQL DB
function mysqlClientFile(language: Language): string {
  if (language === "js") {
    return `
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import __env from "./src/config/__env.js";

if (!__env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env file, e.g.\\n" +
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
  } else {
    return `
import { PrismaClient } from "./generated/prisma/client.js";
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
}

function sqliteClientFile(language: Language): string {
  if (language === "js") {
    return `
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import __env from "./src/config/__env.js";

if (!__env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env file, e.g.\\n" +
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
  } else {
    return `
import { PrismaClient } from "./generated/prisma/client.js";
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
}

export const prismaSchema = (): string => {
  return `
  model subatom {
   id String @id @default(uuid()) @unique
   application String
   version String
   author String?
   framework String?

   createdAt      DateTime       @default(now())
   updatedAt      DateTime       @updatedAt
}
  `;
};

export const envConfigForRelationalDb = (
  fileType: Language,
  database: Database,
  orm: Orm,
) => {
  if (fileType === "ts") {
    if (database === "sqlite" && orm === "drizzle") {
      return `
  /// <reference types="node" />
import { configEnv } from 'subatom';
configEnv();

export type DbConfig =
  | { kind: 'file'; url: string }
  | { kind: 'libsql'; url: string; authToken: string };

function resolveDbConfig(): DbConfig {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('Fatal: DATABASE_URL is not defined in environment variables.');
  }

  // Parse the scheme, e.g. "file:./local.db" -> "file", "libsql:something" -> "libsql"
  const scheme = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();

  const isRemote = scheme === 'libsql' || scheme === 'https' || scheme === 'http';

  if (isRemote) {
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        'Fatal: DATABASE_AUTH_TOKEN is required when DATABASE_URL uses the "libsql:", "https:" or "http:" scheme.'
      );
    }
    return { kind: 'libsql', url: rawUrl, authToken };
  }

  if (scheme === 'file' || !scheme) {
    return { kind: 'file', url: rawUrl };
  }

  throw new Error("Fatal: Unsupported DATABASE_URL scheme Use 'file:' or 'libsql:'.");
}

const environment = {
  DB: resolveDbConfig(),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.isFinite(Number(process.env.PORT)) && process.env.PORT ? Number(process.env.PORT) : 8080,
  HOST: process.env.HOST || 'localhost',
};

const __env = Object.freeze(environment);
export default __env;
  
  `;
    } else {
      return `
/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    DATABASE_URL: process.env.DATABASE_URL as string || "",
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",

}
const __env = Object.freeze(environment);
export default __env;`;
    }
  } else {
    if (database === "sqlite" && orm === "drizzle") {
      return `
        import { configEnv } from 'subatom';
configEnv();

function resolveDbConfig() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('Fatal: DATABASE_URL is not defined in environment variables.');
  }

  // Parse the scheme, e.g. "file:./local.db" -> "file", "libsql:something" -> "libsql"
  const scheme = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();

  const isRemote = scheme === 'libsql' || scheme === 'https' || scheme === 'http';

  if (isRemote) {
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        'Fatal: DATABASE_AUTH_TOKEN is required when DATABASE_URL uses the "libsql:", "https:" or "http:" scheme.'
      );
    }
    return { kind: 'libsql', url: rawUrl, authToken };
  }

  if (scheme === 'file' || !scheme) {
    return { kind: 'file', url: rawUrl };
  }

  throw new Error("Fatal: Unsupported DATABASE_URL scheme", scheme, "Use 'file:' or 'libsql:'.");
}

const environment = {
  DB: resolveDbConfig(),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.isFinite(Number(process.env.PORT)) && process.env.PORT ? Number(process.env.PORT) : 8080,
  HOST: process.env.HOST || 'localhost',
};

const __env = Object.freeze(environment);
export default __env;
        `;
    } else {
      return `

import {configEnv} from 'subatom'
configEnv()

const environment = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",

}
const __env = Object.freeze(environment);
export default __env;
    `;
    }
  }
};

//! 2.  Mongoose ORM .....................................

export const mongoDBConfig = (fileType: Language): string => {
  if (fileType === "ts") {
    return `
  import mongoose from 'mongoose';
  import __env from './__env.js';

const connectDB = async (): Promise<void> => {
  try {
    // Assert the string exists or let Mongoose throw if undefined
    const connectionString = __env.MONGO_CONNECTION_STRING as string;

    const conn = await mongoose.connect(connectionString, {
      autoIndex: __env.NODE_ENV !== 'production', // Disable autoIndex in production
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

 console.log("MongoDB Connected:", conn.connection.host);
  } catch (error) {
    const err = error as Error;
     console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  }
};

// Connection Lifecycle Event Listeners
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err: Error) => {
 console.error("MongoDB connection error:", err);
});

export default connectDB;
  `;
  } else {
    return `
import __env from "./__env.js"
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Replace with your MongoDB connection string or use an environment variable
    const conn = await mongoose.connect(__env.MONGO_CONNECTION_STRING, {
      // Optional configuration options:
      autoIndex: true, // Set to false in production to prevent performance hits
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log("MongoDB Connected:", conn.connection.host);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process with failure
  }
};

// Event Listeners for Connection Lifecycle
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error("MongoDB connection error:", err);
});

export default connectDB;

`;
  }
};

export const mongooseSchema = (fileType: Language): string => {
  if (fileType === "js") {
    return `
import { Schema, mongoose } from 'mongoose';

const SubatomSchema = new Schema(
  {
    application: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      unique: true,
    },
    framework: {
      type: String,
      required: true,
      default: "Subatom"
      
    },
  },
  { timestamps: true }
);

const subatom_model = mongoose.model(
  'subatom_js',
  SubatomSchema
);
export default subatom_model;
    
    `;
  } else {
    return `
import mongoose, { Schema, Document, Model } from 'mongoose';

// 1. Interface representing the raw document structure
export interface ISubatom {
  application: string;
  version: string;
  author: string;
  framework?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Interface representing the Mongoose Document (includes _id, save(), etc.)
export interface ISubatomDocument extends ISubatom, Document {}

// 3. Schema definition with strong typing
const SubatomSchema: Schema<ISubatomDocument> = new Schema(
  {
    application: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      unique: true,
    },
    framework: {
      type: String,
      required: true,
      default: 'Subatom',
    },
  },
  { timestamps: true }
);

// 4. Model Creation with safeguards against re-compilation models in dev mode
const SubatomModel: Model<ISubatomDocument> =
  mongoose.models.subatom_js ||
  mongoose.model<ISubatomDocument>('subatom_js', SubatomSchema);

export default SubatomModel;
`;
  }
};

export const envConfigForMongoose = (fileType: Language) => {
  if (fileType === "ts") {
    return `

/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING as string || "",
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",

}
const __env = Object.freeze(environment);
export default __env;
`;
  } else {
    return `
import {configEnv} from 'subatom'
configEnv()


const environment = {
    MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING || "",
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",

}
const __env = Object.freeze(environment);
export default __env;
    `;
  }
};

//! 3.  Drizzle ORM .....................................

/**
 * Generates drizzle.config file content based on dialect.
 */
export function drizzleConfigFile(
  database: Database,
  language: Language,
): string {
  const extension = language === "ts" ? "ts" : "js";
  if (database === "mongodb") {
    throw new Error("Drizzle does not support MongoDB (NoSQL).");
  }

  if (database === "postgresql") {
    return `import { defineConfig } from 'drizzle-kit';
import __env from './src/config/__env.js';

export default defineConfig({
  schema: './src/db/schema.${extension}',
  out: './drizzle',
  dialect: '${database}',
  dbCredentials: {
    url: __env.DATABASE_URL,
  },
});
`;
  } else if (database === "mysql") {
    return `// base_dir/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { parseDatabaseUrl } from "./src/db/dbUrl.js";
import __env from './src/config/__env.js';

const { connectionString } = parseDatabaseUrl(__env.DATABASE_URL);

export default defineConfig({
  schema: './src/db/schema.${extension}',
  out: './drizzle',
  dialect: '${database}',
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
    `;
  } else if (database === "sqlite") {
    return `
      import { defineConfig } from 'drizzle-kit';
import __env from './src/config/__env.js';

const dbCredentials =
  __env.DB.kind === 'libsql'
    ? { url: __env.DB.url, authToken: __env.DB.authToken }
    : { url: __env.DB.url };

export default defineConfig({
  schema: './src/db/schema.${extension}',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials,
  strict: true,
  verbose: true,
});
      `;
  } else {
    return "Unsupported database.";
  }
}

/**
 * Generates dialect-aware schema file content.
 */
export function drizzleSchema(database: Database, language: Language): string {
  switch (database) {
    case "postgresql":
      return `import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const subatom = pgTable('subatom', {
  id: uuid('id').defaultRandom().primaryKey(),
  application: varchar('application', { length: 255 }).notNull(),
  version: varchar('version', { length: 8 }).notNull().unique(),
  author: varchar('author', { length: 255 }).notNull(),
  framework: varchar('framework', { length: 255 }).notNull().default("Subatom"),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});
${language === "ts" ? "\nexport type TypeSubatom = typeof subatom.$inferSelect;" : ""}
`;

    case "mysql":
      return `
import { mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const subatom = mysqlTable('subatom', {
  id: varchar('id', { length: 64 }).primaryKey(),
  application: varchar('application', { length: 255 }).notNull(),
  version: varchar('version', { length: 8 }).notNull().unique(),
  author: varchar('author', { length: 255 }).notNull(),
  framework: varchar('framework', { length: 255 }).notNull().default('Subatom'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

${language === "ts" ? "\nexport type TypeSubatom = typeof subatom.$inferSelect;" : ""}
            `;

    case "sqlite":
      return `
      import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const subatom = sqliteTable(
  'subatom',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    application: text('application').notNull(),
    version: text('version').notNull(),
    author: text('author').notNull(),
    framework: text('framework').notNull().default('Subatom'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql.raw('unixepoch()')),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql.raw('unixepoch()'))
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('subatom_application_idx').on(table.application),
    uniqueIndex('subatom_application_version_idx').on(table.application, table.version),
  ],
);

  ${language === "ts" ? "export type Subatom = typeof subatom.$inferSelect; \n export type NewSubatom = typeof subatom.$inferInsert;" : ""}

      
      `;

    default:
      throw new Error(`Unsupported database dialect: ${database}`);
  }
}

/**
 * Handles database pool generation for Drizzle.
 */
export class DatabasePoolForDrizzle {
  public readonly language: Language;
  public readonly database: Database;

  constructor(language: Language, database: Database) {
    this.language = language;
    this.database = database;
  }

  public generateCode(): string {
    switch (this.database) {
      case "postgresql":
        return `import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import __env from "../config/__env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: __env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
`;

      case "mysql":
        return `
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';
import __env from '../config/__env.js';
import { parseDatabaseUrl } from '../db/dbUrl.js';

const parsed = parseDatabaseUrl(__env.DATABASE_URL);

export const poolConnection = mysql.createPool({
  host: parsed.host,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  port: parsed.port,
  ssl: parsed.ssl || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export const db = drizzle(poolConnection, { schema, mode: 'default' });

let closed = false;
export async function closeDb() {
  if (closed) return;
  closed = true;
  await poolConnection.end();
}

// Ensure connections are released on process exit (important in containers / PM2 / k8s).
process.once('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
              `;

      case "sqlite":
        if (this.language === "ts") {
          return `
            import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import { drizzle as drizzleLibsql, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle as drizzleBetterSqlite3, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

import * as schema from './schema.js';
import __env from '../config/__env.js';

export type AppDatabase = LibSQLDatabase<typeof schema> | BetterSQLite3Database<typeof schema>;

let sqliteHandle: Database.Database | null = null;

function createDatabaseInstance(): AppDatabase {
  const dbConfig = __env.DB;

  if (dbConfig.kind === 'libsql') {
    const client = createClient({
      url: dbConfig.url,
      authToken: dbConfig.authToken,
    });
    return drizzleLibsql(client, { schema });
  }

  // Local SQLite file via better-sqlite3
  const filePath = dbConfig.url.replace(/^file:/, '') || './local.db';

  const sqlite = new Database(filePath, {
    fileMustExist: false,
    timeout: 5000, // busy_timeout for concurrent writers
  });

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  sqliteHandle = sqlite;
  return drizzleBetterSqlite3(sqlite, { schema });
}

export const db = createDatabaseInstance();

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.run(sql.raw('select 1'));
    return true;
  } catch {
    return false;
  }
}

export function closeDatabase(): void {
  sqliteHandle?.close();
}

process.on('SIGINT', () => { closeDatabase(); process.exit(0); });
process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });
            `;
        } else {
          return `
              import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

import * as schema from './schema.js';
import __env from '../config/__env.js';

let sqliteHandle = null;

function createDatabaseInstance() {
  const dbConfig = __env.DB;

  if (dbConfig.kind === 'libsql') {
    const client = createClient({
      url: dbConfig.url,
      authToken: dbConfig.authToken,
    });
    return drizzleLibsql(client, { schema });
  }

  // Local SQLite file via better-sqlite3
  const filePath = dbConfig.url.replace(/^file:/, '') || './local.db';

  const sqlite = new Database(filePath, {
    fileMustExist: false,
    timeout: 5000, // busy_timeout for concurrent writers
  });

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  sqliteHandle = sqlite;
  return drizzleBetterSqlite3(sqlite, { schema });
}

export const db = createDatabaseInstance();

export async function checkDatabaseConnection() {
  try {
    await db.run(sql.raw('select 1'));
    return true;
  } catch {
    return false;
  }
}

export function closeDatabase() {
  sqliteHandle?.close();
}

process.on('SIGINT', () => { closeDatabase(); process.exit(0); });
process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });`;
        }

      default:
        throw new Error(`Unsupported database: ${this.database}`);
    }
  }
}

// Drizzle static for mysql
export function generateDbUrl(language: Language) {
  if (language === "js") {
    return `
      import { existsSync, readFileSync } from 'node:fs';

/**
 * Hostnames of managed MySQL providers that require (or strongly expect) TLS.
 * Extend this list as you onboard new providers.
 */
const SSL_REQUIRED_HOST_SUFFIXES = [
  'tidbcloud.com',      // TiDB Cloud
  'psdb.cloud',          // PlanetScale
  'aivencloud.com',      // Aiven
  'amazonaws.com',       // RDS / Aurora
  'azure.com',           // Azure Database for MySQL
  'render.com',          // Render
  'railway.app',         // Railway
  'digitalocean.com',    // DigitalOcean Managed MySQL
];

function hostRequiresSSL(hostname) {
  return SSL_REQUIRED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Parses a mysql:// connection string into discrete pool credentials AND a
 * normalized connection string, so drizzle-kit (CLI) and mysql2 (runtime pool)
 * always agree on host/port/ssl — no drift between the two.
 *
 * @param {string | undefined} connectionString
 * @returns {{
 *   host: string,
 *   port: number,
 *   user: string,
 *   password: string,
 *   database: string,
 *   ssl: false | { rejectUnauthorized: boolean, ca?: string },
 *   connectionString: string
 * }}
 */
export function parseDatabaseUrl(connectionString) {
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL is not set.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('[db] DATABASE_URL is not a valid connection string.');
  }

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error('[db] Unsupported protocol', url.protocol, ' — expected mysql://');
  }

  const params = url.searchParams;
  const sslParam = params.get('ssl');
  const sslMode = params.get('sslmode') ?? params.get('ssl-mode');
  const sslAccept = params.get('sslaccept'); // PlanetScale-style: strict | accept_invalid_certs

  const explicitlyDisabled = sslParam === 'false' || sslMode === 'disable';
  const explicitlyEnabled =
    (sslParam !== null && sslParam !== 'false') ||
    (sslMode !== null && sslMode !== 'disable') ||
    sslAccept !== null;

  const needsSSL =
    !explicitlyDisabled &&
    (explicitlyEnabled || hostRequiresSSL(url.hostname) || process.env.NODE_ENV === 'production');

  let ssl = false;
  if (needsSSL) {
    const rejectUnauthorized = sslAccept !== 'accept_invalid_certs';
    ssl = { rejectUnauthorized };

    const caPath = process.env.DATABASE_SSL_CA_PATH;
    if (caPath && existsSync(caPath)) {
      ssl.ca = readFileSync(caPath, 'utf8');
    }
  }

  // Normalize the connection string: strip the ad-hoc ssl params we just
  // interpreted, and encode our final SSL decision back in as ssl=<json>,
  // which is the form both mysql2 and drizzle-kit understand.
  const normalized = new URL(url.toString());
  normalized.searchParams.delete('sslmode');
  normalized.searchParams.delete('ssl-mode');
  normalized.searchParams.delete('sslaccept');
  if (ssl) {
    normalized.searchParams.set('ssl', JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }));
  } else {
    normalized.searchParams.delete('ssl');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\\//, ''),
    ssl,
    connectionString: normalized.toString(),
  };
}
      `;
  } else {
    return `
import { existsSync, readFileSync } from 'node:fs';

export interface ParsedDbConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  /** Normalized connection string — safe to hand to drizzle-kit and mysql2 alike. */
  connectionString: string;
}

/**
 * Hostnames of managed MySQL providers that require (or strongly expect) TLS.
 * Extend this list as you onboard new providers.
 */
const SSL_REQUIRED_HOST_SUFFIXES = [
  'tidbcloud.com',      // TiDB Cloud
  'psdb.cloud',          // PlanetScale
  'aivencloud.com',      // Aiven
  'amazonaws.com',       // RDS / Aurora
  'azure.com',           // Azure Database for MySQL
  'render.com',          // Render
  'railway.app',         // Railway
  'digitalocean.com',    // DigitalOcean Managed MySQL
];

function hostRequiresSSL(hostname: string): boolean {
  return SSL_REQUIRED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Parses a mysql:// connection string into discrete pool credentials AND a
 * normalized connection string, so drizzle-kit (CLI) and mysql2 (runtime pool)
 * always agree on host/port/ssl — no drift between the two.
 */
export function parseDatabaseUrl(connectionString: string | undefined): ParsedDbConnection {
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL is not set.');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('[db] DATABASE_URL is not a valid connection string.');
  }

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error("[db] Unsupported protocol url.protocol — expected mysql://");
  }

  const params = url.searchParams;
  const sslParam = params.get('ssl');
  const sslMode = params.get('sslmode') ?? params.get('ssl-mode');
  const sslAccept = params.get('sslaccept'); // PlanetScale-style: strict | accept_invalid_certs

  const explicitlyDisabled = sslParam === 'false' || sslMode === 'disable';
  const explicitlyEnabled =
    (sslParam !== null && sslParam !== 'false') ||
    (sslMode !== null && sslMode !== 'disable') ||
    sslAccept !== null;

  const needsSSL =
    !explicitlyDisabled &&
    (explicitlyEnabled || hostRequiresSSL(url.hostname) || process.env.NODE_ENV === 'production');

  let ssl: ParsedDbConnection['ssl'] = false;
  if (needsSSL) {
    const rejectUnauthorized = sslAccept !== 'accept_invalid_certs';
    ssl = { rejectUnauthorized };

    const caPath = process.env.DATABASE_SSL_CA_PATH;
    if (caPath && existsSync(caPath)) {
      ssl.ca = readFileSync(caPath, 'utf8');
    }
  }

  // Normalize the connection string: strip the ad-hoc ssl params we just
  // interpreted, and encode our final SSL decision back in as ssl=<json>,
  // which is the form both mysql2 and drizzle-kit understand.
  const normalized = new URL(url.toString());
  normalized.searchParams.delete('sslmode');
  normalized.searchParams.delete('ssl-mode');
  normalized.searchParams.delete('sslaccept');
  if (ssl) {
    normalized.searchParams.set('ssl', JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }));
  } else {
    normalized.searchParams.delete('ssl');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\\//, ''),
    ssl,
    connectionString: normalized.toString(),
  };
}
    
    `;
  }
}

export function generateSeedForSqlite() {
  return `
    import { db, closeDatabase } from './db_pool.js';
import { subatom } from './schema.js';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  await db
    .insert(subatom)
    .values([
      {
        application: 'Core Payment Gateway',
        version: 'v1.0.0',
        author: 'DevOps Team',
        framework: 'Subatom Enterprise',
      },
      {
        application: 'Auth Service',
        version: 'v2.1.0',
        author: 'Security Team',
      },
    ])
    .onConflictDoUpdate({
      target: [subatom.application, subatom.version],
      set: { author: sql.raw('excluded.author'), framework: sql.raw('excluded.framework') },
    });

  console.log('✅ Seeding completed successfully.');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });`;
}
export function generateMigrationPathConfig() {
  return `
    // base_dir/src/db/migrate.ts
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { closeDb, db,  } from './db_pool.js';

async function runMigrations() {
  const env = process.env.NODE_ENV ?? 'development';
  console.log("Running migrations:", env);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    // Without this, the pool's open sockets can keep the process alive
    // or mask the real exit code in some CI/hosting environments.
    await closeDb();
  }
}

runMigrations();
    `;
}
export function resetDbConfig(language: Language) {
  return String.raw`
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, closeDb, poolConnection } from './db_pool.js';

async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to reset the database when NODE_ENV=production.');
    process.exit(1);
  }

  try {
    console.log('Dropping all tables in the current schema...');
    const [rows] = await poolConnection.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()'
    );

    await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 0'));
    for (const row of rows ${language === "ts" ? "as Array<{ name: string }>" : ""}) {
      await db.execute(sql.raw('DROP TABLE IF EXISTS \x60' + row.name + '\x60'));
      console.log('  dropped ' + row.name);
    }
    await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 1'));

    console.log('Re-running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });

    console.log('Database reset complete.');
  } catch (error) {
    console.error('Reset failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

resetDatabase();
`;
}
