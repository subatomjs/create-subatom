import { Database, Language } from "../../../types.js";

function drizzleConfigFileContent(
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
});`;
} else if (database === "mysql") {
    return `import { defineConfig } from 'drizzle-kit';
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
});`;
} else if (database === "sqlite") {
    return `import { defineConfig } from 'drizzle-kit';
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
    return "//Unsupported database.";
  }
}

export default drizzleConfigFileContent