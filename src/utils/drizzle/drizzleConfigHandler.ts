import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../../types.js";
import {
  envConfigContentRelationalDb,
  mainFileContent,
} from "../common_content.js";
import drizzleConfigFileContent from "./constants/drizzle-config-content.js";
import { subatomSchemaContent } from "./constants/subatom-schema-content.js";
import { DatabasePoolForDrizzle } from "./constants/database-pool-content.js";
import dbUrlFileContent from "./constants/mysql/dburl-file-content.js";
import { drizzleMigrationScript } from "./constants/mysql/drizzle-migration-script.js";
import databaseResetScript from "./constants/mysql/database-reset-script.js";
import sqliteSeedFileContent from "./constants/sqlite/sqlite-seed-content.js";
import envRequirementFileContent from "./constants/env-requirements-content.js";

async function drizzleConfigHandler(
  targetDir: string,
  language: ProjectConfig["language"],
  database: ProjectConfig["database"],
  orm: ProjectConfig["orm"],
  useRedis: ProjectConfig["useRedis"],
  useSocket: ProjectConfig["useSocket"],
): Promise<void> {
  if (database === "mongodb") {
    throw new Error("Cannot attach Drizzle configuration to MongoDB.");
  }

  //! 1. db directory ----
  const db_directory = path.join(targetDir, "src", "db");

  //! 2. main.ts || main.js file...
  const main_file_path = path.join(targetDir, `main.${language}`);

  //! 3. drizzle.config file ...
  const drizzle_config_file_path = path.join(
    targetDir,
    `drizzle.config.${language}`,
  );

  //! 4. .env.requirements file ...
  const env_requirements_file_path = path.join(targetDir, ".env.requirements");

  //! 5. envConfig.ts || envConfig.js file ...
  const env_config_file_path = path.join(
    targetDir,
    "src",
    "config",
    `envConfig.${language}`,
  );

  //! 6. subatom.model.ts || subatom.model.js file ...
  const subatom_model_file_path = path.join(
    targetDir,
    "src",
    "models",
    `subatom.model.${language}`,
  );

  //! 7. schema.ts || schema.js
  const schema_file_path = path.join(db_directory, `schema.${language}`);

  //! 8. db_pool.ts || db_pool.js file ...
  const db_pool_file_path = path.join(db_directory, `db_pool.${language}`);

  //? Additional For Mysql......................................
  const db_url_file_path = path.join(db_directory, `dbUrl.${language}`);
  const migrate_file_path = path.join(db_directory, `migrate.${language}`);
  const db_reset_file_path = path.join(db_directory, `reset.${language}`);
  //? ..........................................................

  const jobs: Promise<void>[] = [
    //todo: (1) main.ts | main.js
    fs.outputFile(
      main_file_path,
      mainFileContent(database, orm, language, useRedis, useSocket),
      "utf-8",
    ),

    //todo: (2) drizzle.config.ts
    fs.outputFile(
      drizzle_config_file_path,
      drizzleConfigFileContent(database, language),
      "utf-8",
    ),

    //todo: (3) env.requirements
    fs.outputFile(
      env_requirements_file_path,
      envRequirementFileContent(database, useRedis),
      "utf-8",
    ),

    //todo: (4) subatom.models.ts
    fs.outputFile(
      subatom_model_file_path,
      subatomSchemaContent(database, language),
      "utf-8",
    ),

    //todo: (5) schema.ts || schema.js
    fs.outputFile(
      schema_file_path,
      "export {subatom} from '../models/subatom.model.js'",
      "utf-8",
    ),

    //todo: (6) db_pool.ts || db_pool.js
    fs.outputFile(
      db_pool_file_path,
      new DatabasePoolForDrizzle(language, database).generateCode(),
      "utf-8",
    ),

    //todo: (7) envConfig.ts || envConfig.js
    fs.outputFile(
      env_config_file_path,
      envConfigContentRelationalDb(language, database, orm, useRedis),
      "utf-8",
    ),
  ];

  if (database === "mysql") {
    jobs.push(
      fs.outputFile(db_url_file_path, dbUrlFileContent(language), "utf-8"),
      fs.outputFile(migrate_file_path, drizzleMigrationScript(), "utf-8"),
      fs.outputFile(db_reset_file_path, databaseResetScript(language), "utf-8"),
    );
  }

  if (database === "sqlite") {
    jobs.push(
      fs.outputFile(
        path.join(db_directory, `seed.${language}`),
        sqliteSeedFileContent(),
        "utf-8",
      ),
    );
  }

  await Promise.all(jobs);
}

export default drizzleConfigHandler;
