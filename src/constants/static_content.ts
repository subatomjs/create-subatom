const schemaContent = (
  database: "postgresql" | "mysql" | "sqlite" | string,
): string => {
  return `datasource db {
  provider = "${database}"
}

generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
  previewFeatures = []
}
`;
};

const prismaConfig = (): string => {
  return `
    import "dotenv/config"; 
    import { defineConfig } from "prisma/config";
    import __env from "./src/config/__env";
    
    const DATABASE_URL = process.env.DATABASE_URL ?? __env.DATABASE_URL;
    
    const config = defineConfig({
      schema: "prisma/schema.prisma",
      migrations: { path: "prisma/migrations" },
      datasource: { url: DATABASE_URL ?? "" },
    });
    
    module.exports = config;
    `;
};

const prismaFileGenerate = (
  database: "postgresql" | "mysql" | "sqlite" | string,
) => {
  if (database === "postgresql") {
    return `
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import __env from "./src/config/__env";

const pool = new Pool({
  connectionString: __env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
  
  `;
  } else if (database === "mysql") {
    return `
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";
import __env from "./src/config/__env";


const url = new URL(__env.DATABASE_URL);

const pool = mariadb.createPool({
  host: url.hostname,
  port: parseInt(url.port || "3306", 10),
  user: url.username,
  password: url.password,
  database: url.pathname.replace(/^\\//, ""),
  connectionLimit: 10,
});

// Create the Prisma driver adapter
const adapter = new PrismaMariaDb(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
    `;
  } else {
    return `
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import __env from "./src/config/__env";

const db = new Database(__env.DATABASE_URL);

// Create the Prisma driver adapter
const adapter = new PrismaBetterSqlite(db);

export const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;
    
    `;
  }
};

export { schemaContent, prismaConfig, prismaFileGenerate };
