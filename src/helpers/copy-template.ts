// src/helpers/copy-template.ts
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "url";

import type { Language, ProjectConfig } from "../types.js";
import {
  schemaContent,
  prismaConfig,
  prismaFileGenerate,
  mongoDBConfig,
  mongooseSchema,
  prismaSchema,
  envConfigForMongoose,
  mainFileContent,
  generateEnv,
  subatomConfigGenerate,
  drizzleConfigFile,
  drizzleSchema,
  DatabasePoolForDrizzle,
  envConfigForRelationalDb,
  generateDbUrl,
  generateMigrationPathConfig,
  resetDbConfig,
  generateSeedForSqlite,
} from "../constants/static_content.js";
import { handlePrismaSchemaBuilder } from "../constants/schema_builder.js";

// BUG FIX: `.pathname` on a file:// URL leaves a leading slash on Windows
// (e.g. "/C:/Users/..."), which breaks path.join downstream. fileURLToPath
// normalizes this correctly on every platform.
const TEMPLATES_DIR: string = fileURLToPath(
  new URL("../../templates", import.meta.url),
);
const SNIPPET_FILENAME = "package.snippet.json";

export async function copyTemplate(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  await fs.ensureDir(targetDir);

  const scriptDir = path.join(targetDir, "scripts");
  const setupEnvFileName =
    config.language === "js" ? "setup.env.js" : "setup.env.ts";

  // These two writes are independent of each other and of the template
  // copies below, so they can run concurrently.
  await Promise.all([
    fs.outputFile(
      path.join(scriptDir, setupEnvFileName),
      generateEnv(),
      "utf-8",
    ),
    fs.outputFile(
      path.join(
        targetDir,
        config.language === "js" ? "subatom.config.js" : "subatom.config.ts",
      ),
      subatomConfigGenerate(config.language),
      "utf-8",
    ),
  ]);

  const baseTemplate = config.language === "ts" ? "template_ts" : "template_js";
  const ormBaseLabel = `orm/${config.orm}/base`;

  // BUG FIX (perf): these copies write to disjoint subfolders of targetDir
  // and don't depend on one another, so run them in parallel instead of
  // serially awaiting each one.
  const copyJobs: Promise<void>[] = [
    copyIfExists(
      path.join(TEMPLATES_DIR, baseTemplate),
      targetDir,
      baseTemplate,
    ),
    copyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
      targetDir,
      ormBaseLabel,
    ),
  ];

  if (config.orm !== "mongoose") {
    copyJobs.push(
      copyIfExists(
        path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
        targetDir,
        `orm/${config.orm}/${config.database}`,
      ),
    );
  }

  await Promise.all(copyJobs);

  // ORM-specific file generation must run *after* the copies above, since
  // it patches/overwrites placeholder files (schema.prisma, schema.ts,
  // main.ts, etc.) that the copies just put in place.
  if (config.orm === "prisma") {
    await addPrismaConfig(
      targetDir,
      config.database,
      config.language,
      config.projectName,
      config.orm,
    );

    // BUG FIX: this must point at the copy of the snippet that now lives in
    // the *generated project* (targetDir), not the CLI's own shared
    // TEMPLATES_DIR. Writing to TEMPLATES_DIR would permanently mutate the
    // install's master template on every run instead of patching the file
    // that actually gets merged into the new project's package.json.
    // copyIfExists already placed it at
    // targetDir/package.snippet.<slugified-label>.json — reuse the same
    // label/slugify logic so the two never drift apart.
    const prismaSnippetFile = path.join(
      targetDir,
      `package.snippet.${slugify(ormBaseLabel)}.json`,
    );

    await updatePackageSnippet(prismaSnippetFile, config.language);
  }

  if (config.orm === "mongoose") {
    await addMongooseConfig(
      targetDir,
      config.language,
      config.projectName,
      config.database,
      config.orm,
    );
  }

  // BUG FIX: this branch was missing entirely. Without it, Drizzle projects
  // got the raw (placeholder) template files copied in above and nothing
  // else — no generated schema.ts content, no db_pool file, and no main
  // file — which is exactly the "schema.ts has no content / main file not
  // created" issue.
  if (config.orm === "drizzle") {
    await addDrizzleConfig(
      targetDir,
      config.language,
      config.projectName,
      config.database,
      config.orm,
    );
  }

  // Optional extras are independent of each other — copy concurrently.
  const optionalJobs: Promise<void>[] = [];
  if (config.useRedis) {
    optionalJobs.push(
      copyIfExists(path.join(TEMPLATES_DIR, "redis"), targetDir, "redis"),
    );
  }
  if (config.useEslint) {
    optionalJobs.push(
      copyIfExists(path.join(TEMPLATES_DIR, "eslint"), targetDir, "eslint"),
    );
  }
  if (config.useVitest) {
    optionalJobs.push(
      copyIfExists(path.join(TEMPLATES_DIR, "vitest"), targetDir, "vitest"),
    );
  }
  if (optionalJobs.length) {
    await Promise.all(optionalJobs);
  }
}

async function copyIfExists(
  src: string,
  dest: string,
  label: string,
): Promise<void> {
  const exists = await fs.pathExists(src);
  if (!exists) {
    throw new Error(
      `Missing template folder: "${label}" (expected at ${src}). ` +
        `Create this folder before this option can be used.`,
    );
  }

  await fs.copy(src, dest, {
    filter: (srcPath) => path.basename(srcPath) !== SNIPPET_FILENAME,
  });

  const snippetSrcPath = path.join(src, SNIPPET_FILENAME);
  if (await fs.pathExists(snippetSrcPath)) {
    const uniqueName = `package.snippet.${slugify(label)}.json`;
    await fs.copy(snippetSrcPath, path.join(dest, uniqueName));
  }
}

async function updatePackageSnippet(
  filePath: string,
  language: Language,
): Promise<void> {
  try {
    // 1. Read and parse existing JSON snippet
    const rawData = await fs.readFile(filePath, "utf8");
    const snippet = JSON.parse(rawData);

    // 2. Ensure scripts object exists
    snippet.scripts = snippet.scripts || {};

    // 3. Update build-schema conditionally
    snippet.scripts["build-schema"] =
      language === "ts"
        ? "ts-node scripts/schema_builder.ts"
        : "node scripts/schema_builder.js";

    // 4. Save formatted JSON back to file
    await fs.writeFile(filePath, JSON.stringify(snippet, null, 2), "utf8");
    console.log("Snippet updated successfully!");
  } catch (error) {
    // BUG FIX: previously this only logged and swallowed the error, so a
    // missing/corrupt snippet file silently produced a broken package.json
    // snippet with no build-schema script, and callers had no way to know.
    // Log for context, then rethrow so the failure surfaces to the caller.
    console.error("Failed to update snippet:", error);
    throw error;
  }
}

//TODO: 1. -------- PRISMA CONFIG --------
async function addPrismaConfig(
  targetDir: string,
  database: ProjectConfig["database"],
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
  orm: ProjectConfig["orm"],
): Promise<void> {
  const modelFilePath = path.join(targetDir, "src", "models", "subatom.prisma");
  const envSamplePath = path.join(targetDir, ".env.requirement");
  const schemaPath = path.join(targetDir, "prisma", "schema.prisma");
  const configDir = path.join(targetDir, "src", "config");
  const prisma_env_conf = path.join(
    configDir,
    language === "js" ? "__env.js" : "__env.ts",
  );

  if (!(await fs.pathExists(schemaPath))) {
    throw new Error(
      `Expected to find "${schemaPath}" after copying Prisma templates, but it's missing. ` +
        `Check that orm/prisma/base/prisma/schema.prisma exists.`,
    );
  }

  const env_for_prisma = `
        DATABASE_URL = ""
        NODE_ENV="development"
        PORT = 8080
        HOST = 'localhost'
`;

  // BUG FIX: previously these paths were rebuilt from process.cwd() +
  // projectName instead of using the targetDir that was passed in. If a
  // caller ever invokes copyTemplate with a targetDir that isn't exactly
  // cwd()/projectName, these files were written to the wrong location while
  // everything else in the function correctly used targetDir.
  const mainFilePath = path.join(
    targetDir,
    language === "js" ? "main.js" : "main.ts",
  );
  const prismaFilePath = path.join(
    targetDir,
    language === "js" ? "prisma.js" : "prisma.ts",
  );
  const prismaConfigFilePath = path.join(
    targetDir,
    language === "js" ? "prisma.config.js" : "prisma.config.ts",
  );

  const scriptDir = path.join(targetDir, "scripts");
  const schemaBuilderFileName =
    language === "js" ? "schema_builder.js" : "schema_builder.ts";

  // Writes with no interdependencies run concurrently.
  const jobs: Promise<void>[] = [
    // 2. prisma.config.js / .ts
    fs.outputFile(prismaConfigFilePath, prismaConfig(), "utf-8"),
    // 5. schema builder script
    fs.outputFile(
      path.join(scriptDir, schemaBuilderFileName),
      handlePrismaSchemaBuilder(targetDir, database, language),
      "utf-8",
    ),
    // .env.requirement
    fs.outputFile(envSamplePath, env_for_prisma, "utf-8"),
    // model file
    fs.outputFile(modelFilePath, prismaSchema(), "utf-8"),
    // __env config
    fs.outputFile(
      prisma_env_conf,
      envConfigForRelationalDb(language, database, orm),
      "utf-8",
    ),
  ];

  // mongodb has no schema.prisma / prisma.js / main.js of its own — keep the
  // original behavior (skip these three writes) but as a single guarded
  // block instead of three separate ternaries repeating the same check.
  if (database !== "mongodb") {
    jobs.push(
      fs.writeFile(schemaPath, schemaContent(database, language), "utf-8"),
      fs.writeFile(
        prismaFilePath,
        prismaFileGenerate(database, language),
        "utf-8",
      ),
      fs.writeFile(
        mainFilePath,
        mainFileContent(database, orm, language, projectName),
        "utf-8",
      ),
    );
  }

  await Promise.all(jobs);
}

//!(****************************************************************************************************************)

//TODO 2. --------- MONGOOSE CONFIG ---------
async function addMongooseConfig(
  targetDir: string,
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
  database: ProjectConfig["database"],
  orm: ProjectConfig["orm"],
): Promise<void> {
  const modelFilePath = path.join(
    targetDir,
    "src",
    "models",
    language === "js" ? "subAtom.model.js" : "subAtom.model.ts",
  );
  const envSamplePath = path.join(targetDir, ".env.requirement");
  const configDir = path.join(targetDir, "src", "config");
  const mongooseConfigPath = path.join(
    configDir,
    language === "js" ? "mongoConnect.js" : "mongoConnect.ts",
  );
  const mongooseEnvConfig = path.join(
    configDir,
    language === "js" ? "__env.js" : "__env.ts",
  );

  // BUG FIX: same targetDir-vs-process.cwd() inconsistency as addPrismaConfig.
  const mainFilePath = path.join(
    targetDir,
    language === "js" ? "main.js" : "main.ts",
  );

  const env_for_mongoose = `
        MONGO_CONNECTION_STRING = ""
        NODE_ENV="development"
        PORT = 8080
        HOST = 'localhost'
`;

  // All five writes are independent — run concurrently.
  await Promise.all([
    fs.outputFile(mongooseConfigPath, mongoDBConfig(language), "utf-8"),
    fs.outputFile(envSamplePath, env_for_mongoose, "utf-8"),
    fs.outputFile(modelFilePath, mongooseSchema(language), "utf-8"),
    fs.outputFile(mongooseEnvConfig, envConfigForMongoose(language), "utf-8"),
    fs.writeFile(
      mainFilePath,
      mainFileContent(database, orm, language, projectName),
      "utf-8",
    ),
  ]);
}

//!(****************************************************************************************************************)

//TODO 3. --------- DRIZZLE CONFIG ---------
export async function addDrizzleConfig(
  targetDir: string,
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
  database: ProjectConfig["database"],
  orm: ProjectConfig["orm"],
): Promise<void> {
  if (database === "mongodb") {
    throw new Error("Cannot attach Drizzle configuration to MongoDB.");
  }

  const ext = language === "js" ? "js" : "ts";

  // Path resolution alignment (all schema and pool paths located under src/db)
  const mainFilePath = path.join(targetDir, `main.${ext}`);

  const rootDrizzleDir = path.join(
    targetDir,
    "drizzle",
    language === "ts" ? "schema.ts" : "schema.js",
  );

  const drizzleConfigFilePath = path.join(targetDir, `drizzle.config.${ext}`);

  const envSamplePath = path.join(targetDir, ".env.requirement");

  const srcDbDir = path.join(targetDir, "src", "db");

  const schemaPath = path.join(srcDbDir, `schema.${ext}`);

  const subatomModelPath = path.join(
    targetDir,
    "src",
    "models",
    `subatom.model.${ext}`,
  );

  const poolPath = path.join(srcDbDir, `db_pool.${ext}`);

  const configDir = path.join(targetDir, "src", "config");

  const drizzleEnvConf = path.join(configDir, `__env.${ext}`);

  // Additional For Mysql....
  const dbUrlPath = path.join(srcDbDir, `dbUrl.${ext}`);
  const migratePath = path.join(srcDbDir, `migrate.${ext}`);
  const resetPath = path.join(srcDbDir, `reset.${ext}`);

  const envContent = `DATABASE_URL=""
NODE_ENV="development"
PORT=8080
HOST="localhost"
`;

  const jobs: Promise<void>[] = [
    // main.ts
    fs.outputFile(
      mainFilePath,
      mainFileContent(database, orm, language, projectName),
      "utf-8",
    ),

    // drizzle.config.ts
    fs.outputFile(
      drizzleConfigFilePath,
      drizzleConfigFile(database, language),
      "utf-8",
    ),
    // .env.requirement
    fs.outputFile(envSamplePath, envContent, "utf-8"),

    //src/db/schema.ts
    fs.outputFile(
      schemaPath,
      "export {subatom} from '../models/subatom.model.js'",
      "utf-8",
    ),

    // /src/models/subatom.models.ts
    fs.outputFile(subatomModelPath, drizzleSchema(database, language), "utf-8"),

    // /src/db/db_pool.ts
    fs.outputFile(
      poolPath,
      new DatabasePoolForDrizzle(language, database).generateCode(),
      "utf-8",
    ),

    // /src/config/__env.ts
    fs.outputFile(
      drizzleEnvConf,
      envConfigForRelationalDb(language, database, orm),
      "utf-8",
    ),
  ];

  if (database === "mysql") {
    jobs.push(
      fs.outputFile(dbUrlPath, generateDbUrl(language), "utf-8"),
      fs.outputFile(migratePath, generateMigrationPathConfig(), "utf-8"),
      fs.outputFile(resetPath, resetDbConfig(language), "utf-8"),
    );
  }

  if (database === "sqlite") {
    jobs.push(
      fs.outputFile(
        path.join(srcDbDir, `seed.${ext}`),
        generateSeedForSqlite(),
        "utf-8",
      ),
    );
  }

  await Promise.all(jobs);
}

function slugify(label: string): string {
  return label.replace(/[\\/]/g, "-");
}
