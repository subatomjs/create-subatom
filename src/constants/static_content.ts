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
  if ((orm === "prisma" || orm === "drizzle") && !relationalDbs.includes(database)) {
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

  if (orm === "mongoose") {
    imports = `import connectDB from "./src/config/mongoConnect.js";\n`;
    connectLogic = `await connectDB();`;
    errorMessage = `"❌ Something went wrong:", ${logError}`;
  } else if (orm === "prisma") {
    imports = `import prisma from "./prisma.js";\n`;
    connectLogic = `await prisma.$connect();\n        console.log("✅ Connected to ${database} (Prisma) successfully");`;
    errorMessage = `"❌ Failed to connect to ${database}:", ${logError}`;
  } else if (orm === "drizzle") {
    imports = `import { db } from "./src/db/db_pool.js";\nimport { sql } from "drizzle-orm";\n`;
    connectLogic = `// Verify pool connection\n        await db.execute(sql\`SELECT 1\`);\n        console.log("✅ Connected to ${database} (Drizzle) successfully");`;
    errorMessage = `"❌ Failed to connect to ${database}:", ${logError}`;
  }

  // 4. Return unified template
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
`;
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

export const envConfigForRelationalDb = (fileType: Language) => {
  if (fileType === "ts") {
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
export function drizzleConfigFile(database: Database, language: Language): string {
  if (database === "mongodb") {
    throw new Error("Drizzle does not support MongoDB (NoSQL).");
  }

  const extension = language === "ts" ? "ts" : "js";
  const dialect = database === "postgresql" ? "postgresql" : database;

  return `import { defineConfig } from 'drizzle-kit';
import __env from './src/config/__env.js';

export default defineConfig({
  schema: './src/db/schema.${extension}',
  out: './drizzle',
  dialect: '${dialect}',
  dbCredentials: {
    url: __env.DATABASE_URL,
  },
});
`;
}

/**
 * Generates dialect-aware schema file content.
 */
export function drizzleSchema(database: Database, language: Language): string {
  const isTs = language === "ts";

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
${isTs ? '\nexport type TypeSubatom = typeof subatom.$inferSelect;' : ''}
`;

    case "mysql":
      return `import { mysqlTable, varchar, timestamp } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const subatom = mysqlTable('subatom', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql\`(uuid())\`),
  application: varchar('application', { length: 255 }).notNull(),
  version: varchar('version', { length: 8 }).notNull().unique(),
  author: varchar('author', { length: 255 }).notNull(),
  framework: varchar('framework', { length: 255 }).notNull().default("Subatom"),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
${isTs ? '\nexport type TypeSubatom = typeof subatom.$inferSelect;' : ''}
`;

    case "sqlite":
      return `import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const subatom = sqliteTable('subatom', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  application: text('application').notNull(),
  version: text('version').notNull().unique(),
  author: text('author').notNull(),
  framework: text('framework').notNull().default("Subatom"),
  createdAt: text('created_at').default(sql\`CURRENT_TIMESTAMP\`).notNull(),
  updatedAt: text('updated_at').default(sql\`CURRENT_TIMESTAMP\`),
});
${isTs ? '\nexport type TypeSubatom = typeof subatom.$inferSelect;' : ''}
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
        return `import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";
import __env from "../config/__env.js";

const pool = mysql.createPool({
  uri: __env.DATABASE_URL,
});

export const db = drizzle(pool, { schema, mode: "default" });
`;

      case "sqlite":
        return `import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import __env from "../config/__env.js";

const sqlite = new Database(__env.DATABASE_URL || "sqlite.db");

export const db = drizzle(sqlite, { schema });
`;

      default:
        throw new Error(`Unsupported database: ${this.database}`);
    }
  }
}