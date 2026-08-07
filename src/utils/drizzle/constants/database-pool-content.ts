import { Database, Language } from "../../../types.js";

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
        return `import { drizzle } from 'drizzle-orm/mysql2';
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
});`;

      case "sqlite":
        if (this.language === "ts") {
          return `import { createClient } from '@libsql/client';
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
process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });`;
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