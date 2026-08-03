// src/helpers/copy-template.ts
import fs from "fs-extra";
import path from "node:path";

import type { Orm, ProjectConfig } from "../types.js";
import {
  schemaContent,
  prismaConfig,
  prismaFileGenerate,
  mongoDBConfig,
  mongooseSchema,
  prismaSchema,
  envConfigForMongoose,
  envConfigForPrisma,
  mainFileContent,
} from "../constants/static_content.js";
import { handlePrismaSchemaBuilder } from "../constants/schema_builder.js";

const TEMPLATES_DIR: string = new URL("../../templates", import.meta.url)
  .pathname;
const SNIPPET_FILENAME = "package.snippet.json";

export async function copyTemplate(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  await fs.ensureDir(targetDir);

  const baseTemplate = config.language === "ts" ? "template_ts" : "template_js";
  await copyIfExists(
    path.join(TEMPLATES_DIR, baseTemplate),
    targetDir,
    baseTemplate,
  );

  await copyIfExists(
    path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
    targetDir,
    `orm/${config.orm}/base`,
  );

  if (config.orm !== "mongoose") {
    await copyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
      targetDir,
      `orm/${config.orm}/${config.database}`,
    );
  }

  // Prisma's schema.prisma ships with a placeholder provider — patch it now
  // that both the base and database-specific copies are done.
  if (config.orm === "prisma") {
    await addPrismaConfig(
      targetDir,
      config.database,
      config.language,
      config.projectName,
      config.orm
    );
  }

  if (config.orm === "mongoose") {
    await addMongooseConfig(targetDir, config.language, config.projectName, config.database, config.orm);
  }

  if (config.useRedis) {
    await copyIfExists(path.join(TEMPLATES_DIR, "redis"), targetDir, "redis");
  }
  if (config.useEslint) {
    await copyIfExists(path.join(TEMPLATES_DIR, "eslint"), targetDir, "eslint");
  }
  if (config.useVitest) {
    await copyIfExists(path.join(TEMPLATES_DIR, "vitest"), targetDir, "vitest");
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

//TODO: 1. -------- PRISMA CONFIG --------
async function addPrismaConfig(
  targetDir: string,
  database: ProjectConfig["database"],
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
  orm: ProjectConfig["orm"]
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

  //! 1. Write boilerplate content of schema.prisma
  database !== "mongodb"
    ? await fs.writeFile(schemaPath, schemaContent(database, language), "utf-8")
    : null;

  //! 2. Write prisma.config.js or prisma.config.ts file
  await fs.writeFile(
    path.join(
      targetDir,
      `${language === "js" ? "prisma.config.js" : "prisma.config.ts"}`,
    ),
    prismaConfig(),
    "utf-8",
  );

  //! 3. Write prisma.js or prisma.ts file
  database !== "mongodb"
    ? await fs.writeFile(
        path.join(
          `${process.cwd()}/${projectName}`,
          `${language === "js" ? "prisma.js" : "prisma.ts"}`,
        ),
        prismaFileGenerate(database, language),
        "utf-8",
      )
    : null;

//! 4. Main file creation 
      database !== "mongodb"
    ? await fs.writeFile(
        path.join(
          `${process.cwd()}/${projectName}`,
          `${language === "js" ? "main.js" : "main.ts"}`,
        ),
        mainFileContent(database, orm, language, projectName),
        "utf-8",
      )
    : null;

  //! 5. Write schema builder file
// 1. Define the directory and full file path clearly
const scriptDir = path.join(process.cwd(), projectName, "script");
const fileName = language === "js" ? "schema_builder.js" : "schema_builder.ts";
const filePath = path.join(scriptDir, fileName);

// 2. Ensure the directory exists (creates recursively if missing)
await fs.mkdir(scriptDir, { recursive: true });

// 3. Write the file safely
await fs.writeFile(
  filePath,
  handlePrismaSchemaBuilder(
    path.join(process.cwd(), projectName),
    database,
    language
  ),
  "utf-8"
);

  //! 5. Write .env.requirement — outputFile creates any missing parent dirs
  const env_for_prisma = `
DATABASE_URL = ""
NODE_ENV="development"
PORT = 8080
HOST = 'localhost'
`;
  await fs.outputFile(envSamplePath, env_for_prisma, "utf-8");

  //! 6. Write model file — outputFile creates any missing parent dirs
  await fs.outputFile(modelFilePath, prismaSchema(), "utf-8");

  //! 4. __env write
  await fs.outputFile(prisma_env_conf, envConfigForPrisma(language), "utf-8");
}











//!(****************************************************************************************************************)

//TODO 2. --------- MONGOOSE CONFIG ---------
async function addMongooseConfig(
  targetDir: string,
  language: ProjectConfig["language"],
  projectName: ProjectConfig['projectName'],
  database: ProjectConfig['database'],
  orm: ProjectConfig['orm']


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

  const env_for_mongoose = `MONGO_CONNECTION_STRING = ""
  NODE_ENV="development"
PORT = 8080
HOST = 'localhost'
`;

  //! 1. Mongo connection config file inside src/config
  await fs.outputFile(mongooseConfigPath, mongoDBConfig(language), "utf-8");

  //! 2. .env.requirement
  await fs.outputFile(envSamplePath, env_for_mongoose, "utf-8");

  //! 3. Model file
  await fs.outputFile(modelFilePath, mongooseSchema(language), "utf-8");

  //! 4. __env write
  await fs.outputFile(
    mongooseEnvConfig,
    envConfigForMongoose(language),
    "utf-8",
  );

  //! 5. Main file creation 
   await fs.writeFile(
        path.join(
          `${process.cwd()}/${projectName}`,
          `${language === "js" ? "main.js" : "main.ts"}`,
        ),
        mainFileContent(database, orm, language, projectName),
        "utf-8",
      )

}

function slugify(label: string): string {
  return label.replace(/[\\/]/g, "-");
}
