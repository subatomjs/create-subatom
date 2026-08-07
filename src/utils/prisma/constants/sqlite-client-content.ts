import { Language } from "../../../types.js";

function sqliteClientFileContent(language: Language): string {
  if (language === "js") {
    return `import { createRequire } from "module";
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

export default prisma;`;
  } else {
    return `import { PrismaClient } from "./generated/prisma/client.js";
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

export default prisma;`;
  }
}

export default sqliteClientFileContent