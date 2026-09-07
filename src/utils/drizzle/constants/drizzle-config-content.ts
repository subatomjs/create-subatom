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
import envConfig from './src/config/envConfig.js';

export default defineConfig({
  schema: './src/db/schema.${extension}',
  out: './drizzle',
  dialect: '${database}',
  dbCredentials: {
    url: envConfig.DATABASE_URL,
  },
});`;
} else if (database === "mysql") {
    return `import { defineConfig } from 'drizzle-kit';
import { parseDatabaseUrl } from "./src/db/dbUrl.js";
import envConfig from './src/config/envConfig.js';

const { connectionString } = parseDatabaseUrl(envConfig.DATABASE_URL);

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
import envConfig from './src/config/envConfig.js';

const dbCredentials =
  envConfig.DB.kind === 'libsql'
    ? { url: envConfig.DB.url, authToken: envConfig.DB.authToken }
    : { url: envConfig.DB.url };

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