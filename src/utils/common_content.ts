import { fileURLToPath } from "node:url";
import type { Database, Language, Orm } from "../types.js";

const TEMPLATES_DIR: string = fileURLToPath(
  new URL("../../templates", import.meta.url),
);

const SNIPPET_FILENAME = "package.snippet.json";

const SNIPPET_PATTERN = /^package\.snippet(?:\..+)?\.json$/;

const redisEnvironmentVariable: { key: string; value: string }[] = [
  { key: "REDIS_URL", value: "'redis://127.0.0.1:6379/'" },
  { key: "REDIS_KEY_PREFIX", value: "'subatom_app:'" },
  { key: "REDIS_REQUIRED", value: "false" },
  { key: "REDIS_CONNECT_TIMEOUT_MS", value: "10000" },
  { key: "REDIS_SHUTDOWN_TIMEOUT_MS", value: "5000" },
  { key: "REDIS_DEBUG", value: "false" },
];

// Generates valid `KEY: process.env.KEY || default,` lines,
// consistent with the rest of the environment object.
function redisEnvLines(isTs: boolean): string {
  return redisEnvironmentVariable
    .map(({ key, value }) => {
      const cast = isTs ? " as string" : "";
      return `  ${key}: process.env.${key}${cast} || ${value},`;
    })
    .join("\n");
}

// .env create
function dotEnvFileContent(): string {
  return `/// <reference types="node" />
import * as fs from "fs";

const source = ".env.requirements";
const destination = ".env";

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("✅ Created .env from .env.requirements");
} else {
  console.log("ℹ️ .env already exists");
}`;
}

// main.js || main.ts
function mainFileContent(
  database: Database,
  orm: Orm,
  fileType: Language,
  projectName: string,
  useRedis: boolean,
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
  } else if (orm === "drizzle" && database === "sqlite") {
    imports = `import { checkDatabaseConnection, closeDatabase } from "./src/db/db_pool.js";\n`;
    connectedLog = `console.log("✅ Connected to ${database} (Drizzle) successfully");`;
  }

  // 4. Return unified template
  if (orm === "drizzle" && database === "sqlite") {
    return `//! Adjust path according to your project if mismatch..
import __env from "./src/config/__env.js";
import server from "./src/server.js";
${useRedis === true ? "import { bootstrapRedis } from './src/redis/redis.bootstrap.js';" : ""}
${imports}
async function main()${returnType} {
  const healthy = await checkDatabaseConnection();
  if (!healthy) {
    console.error("❌ Database health check failed. Aborting startup.");
    process.exit(1);
  }
  ${connectedLog}
  ${useRedis === true ? "await bootstrapRedis();" : ""}

  server.listen(__env.PORT || 8080, __env.HOST, "${projectName}");
}

process.on("SIGINT", () => { closeDatabase(); process.exit(0); });
process.on("SIGTERM", () => { closeDatabase(); process.exit(0); });

await main();
`;
  } else {
    return `//! Adjust path according to your project if mismatch..  
import __env from "./src/config/__env.js";
import server from "./src/server.js";
${useRedis === true ? "import { bootstrapRedis } from './src/redis/redis.bootstrap.js';" : ""}
${imports}
async function main()${returnType} {
    try {
        ${connectLogic}
        ${useRedis === true ? "await bootstrapRedis();" : ""}
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
}

function subatomConfigContent(language: Language): string {
  if (language === "js") {
    return `import { defineConfig } from "subatom";

export default defineConfig({
      port: 8080,
      host: "localhost",
      outDir: "build",
      entry:"main.js",
      watch: {
          extensions: ["js", "jsx"],
          debounceMs: 0,
          ignore: ["**/logs/**"],
      }
});`;
  } else {
    return `import { defineConfig } from "subatom";

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
});`;
  }
}

const envConfigContentRelationalDb = (
  fileType: Language,
  database: Database,
  orm: Orm,
  useRedis: boolean,
) => {
  if (fileType === "ts") {
    if (database === "sqlite" && orm === "drizzle") {
      return `/// <reference types="node" />
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
  ${useRedis === true ? redisEnvLines(true) : ""}
};

const __env = Object.freeze(environment);
export default __env;`;
    } else {
      return `/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    DATABASE_URL: process.env.DATABASE_URL as string || "",
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",
    ${useRedis === true ? redisEnvLines(true) : ""}

}
const __env = Object.freeze(environment);
export default __env;`;
    }
  } else {
    if (database === "sqlite" && orm === "drizzle") {
      return `import { configEnv } from 'subatom';
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
  ${useRedis === true ? redisEnvLines(false) : ""}
};

const __env = Object.freeze(environment);
export default __env;
        `;
    } else {
      return `import {configEnv} from 'subatom'
configEnv()

const environment = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",
    ${useRedis === true ? redisEnvLines(false) : ""}

}
const __env = Object.freeze(environment);
export default __env;`;
    }
  }
};

export {
  subatomConfigContent,
  envConfigContentRelationalDb,
  mainFileContent,
  dotEnvFileContent,
  TEMPLATES_DIR,
  SNIPPET_FILENAME,
  SNIPPET_PATTERN,
};
