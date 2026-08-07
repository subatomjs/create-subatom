import { Language } from "../../../types.js";

function mysqlClientFileContent(language: Language): string {
  if (language === "js") {
    return `import { createRequire } from "module";
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

export default prisma;`;
  } else {
    return `import { PrismaClient } from "./generated/prisma/client.js";
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

export default prisma;`;
  }
}

export default mysqlClientFileContent;
