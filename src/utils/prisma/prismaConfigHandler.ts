import fs from "fs-extra";
import path from "node:path";
import { ProjectConfig } from "../../types.js";
import {
  envConfigContentRelationalDb,
  mainFileContent,
} from "../common_content.js";
import { prismaClientGenerator } from "./prismaClientGenerator.js";
import prismaConfigFileContent from "./constants/prisma-config-content.js";
import subatomSchemaFileContent from "./constants/subatom-schema-content.js";
import schemaFileContent from "./constants/schema-prisma-content.js";
import prismaSchemaBuilderScript from "./constants/schema-builder-script.js";
import envRequirementFileContent from "../drizzle/constants/env-requirements-content.js";

async function prismaConfigHandler(
  targetDir: string,
  database: ProjectConfig["database"],
  language: ProjectConfig["language"],
  useRedis: ProjectConfig["useRedis"],
  orm: ProjectConfig["orm"],
  useSocket: ProjectConfig["useSocket"],
): Promise<void> {
  //* 1) main.ts || main.js file...
  const main_file_path = path.join(
    targetDir,
    language === "js" ? "main.js" : "main.ts",
  );

  //* 2) prisma.ts || prisma.js...
  const prisma_file_path = path.join(
    targetDir,
    language === "js" ? "prisma.js" : "prisma.ts",
  );

  //* 3) prisma.config.ts || prisma.config.js...
  const prisma_config_file_path = path.join(
    targetDir,
    language === "js" ? "prisma.config.js" : "prisma.config.ts",
  );

  //* 4) .env.requirements...
  // BUG FIX: Standardized filename to .env.requirements (singular) to match Mongoose and Drizzle handlers.
  const env_requirements_path = path.join(targetDir, ".env.requirements");

  //* 5) .env...
  const env_config_file_path = path.join(
    targetDir,
    "src",
    "config",
    language === "js" ? "envConfig.js" : "envConfig.ts",
  );

  //* 6) /src/models/subatom.prisma...
  const model_file_path = path.join(
    targetDir,
    "src",
    "models",
    "subatom.prisma",
  );

  //* 7) /prisma/schema.prisma...
  const schema_path = path.join(targetDir, "prisma", "schema.prisma");

  //* 8) /scripts/schema_builder.ts || /scripts/schema_builder.js...
  const schema_builder_file_path = path.join(
    targetDir,
    "scripts",
    language === "js" ? "schema_builder.js" : "schema_builder.ts",
  );

  // BUG FIX: Removed pre-check error throwing on `schema_path`. Using `fs.outputFile` below safely creates
  // nested directories and files even if templates didn't copy a placeholder schema.prisma first.

  //? Create all files...
  // BUG FIX: Changed fs.writeFile to fs.outputFile across all jobs to ensure parent directories
  // (like root or src/ directory structures) are auto-created if missing.
  const jobs: Promise<void>[] = [
    //todo: (1) main file...
    fs.outputFile(
      main_file_path,
      mainFileContent(database, orm, language, useRedis, useSocket),
      "utf-8",
    ),

    //todo: (2) prisma file...
    fs.outputFile(
      prisma_file_path,
      prismaClientGenerator(database as any, language),
      "utf-8",
    ),

    //todo: (3) prisma.config file...
    fs.outputFile(prisma_config_file_path, prismaConfigFileContent(), "utf-8"),

    //todo: (4) .env.requirements file...
    fs.outputFile(
      env_requirements_path,
      envRequirementFileContent(database, useRedis),
      "utf-8",
    ),

    //todo: (5) envConfig file...
    fs.outputFile(
      env_config_file_path,
      envConfigContentRelationalDb(language, database, orm, useRedis),
      "utf-8",
    ),

    //todo: (6) subatom.prisma file...
    fs.outputFile(model_file_path, subatomSchemaFileContent(), "utf-8"),

    //todo: (7) schema.prisma file...
    fs.outputFile(schema_path, schemaFileContent(database, language), "utf-8"),

    //todo: (8) prisma schema builder
    fs.outputFile(
      schema_builder_file_path,
      prismaSchemaBuilderScript(targetDir, database, language),
      "utf-8",
    ),
  ];

  await Promise.all(jobs);
}

export default prismaConfigHandler;
