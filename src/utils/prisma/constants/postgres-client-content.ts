// postgres-client-content.ts 

import { Language } from "../../../types.js";

function postgresClientFileContent(language: Language): string {
  if (language === "js") {
    return `import { createRequire } from "module";
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

export default prisma;`;
  } else {
    return `import { PrismaClient } from "./generated/prisma/client.js";
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

export default prisma;`;
  }
}

export default postgresClientFileContent;
