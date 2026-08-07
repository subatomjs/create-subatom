import fs from "fs-extra";
import path from "node:path";
import { ProjectConfig } from "../../types.js";
import mongoDbConnectionScript from "./constants/mongodb-connection-script.js";
import mongooseSchemaContent from "./constants/mongoose-schema-content.js";
import mongoEnvConfigFileContent from "./constants/mongo-env-conf-content.js";
import { mainFileContent } from "../common_content.js";
import envRequirementFileContent from "../drizzle/constants/env-requirements-content.js";

async function mongooseConfigHandler(
  targetDir: string,
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
  database: ProjectConfig["database"],
  orm: ProjectConfig["orm"],
  useRedis: ProjectConfig["useRedis"],
): Promise<void> {
  // ! 1. config folder
  const config_directory_address = path.join(targetDir, "src", "config");

  //! 2. main.ts || main.js
  const main_file_path = path.join(
    targetDir,
    language === "js" ? "main.js" : "main.ts",
  );

  //! 3. subatom.model.ts || subatom.model.js...
  const subatom_schema_file_path = path.join(
    targetDir,
    "src",
    "models",
    language === "js" ? "subatom.model.js" : "subatom.model.ts",
  );

  //! 4. .env.requirements...
  const env_requirements_file_path = path.join(targetDir, ".env.requirements");

  //! 5. mongoose config file path...
  const mongoose_config_path = path.join(
    config_directory_address,
    language === "js" ? "mongoConnect.js" : "mongoConnect.ts",
  );

  //! 6. __env file path...
  const env_config_file_path = path.join(
    config_directory_address,
    language === "js" ? "__env.js" : "__env.ts",
  );

  // All five writes are independent — run concurrently.
  await Promise.all([
    //todo: (1) main.ts || main.js
    fs.outputFile(
      main_file_path,
      mainFileContent(database, orm, language, projectName, useRedis),
      "utf-8",
    ),

    //todo: (2) subatom.model.ts || subatom.model.js
    fs.outputFile(
      subatom_schema_file_path,
      mongooseSchemaContent(language),
      "utf-8",
    ),

    //todo: (3) .env.requirements...
    fs.outputFile(
      env_requirements_file_path,
      envRequirementFileContent(database, useRedis),
      "utf-8",
    ),

    //todo: (4) mongodb connection file...
    fs.outputFile(
      mongoose_config_path,
      mongoDbConnectionScript(language),
      "utf-8",
    ),

    //todo: (5) __env.ts || __env.js
    fs.outputFile(
      env_config_file_path,
      mongoEnvConfigFileContent(language, useRedis),
      "utf-8",
    ),
  ]);
}
export default mongooseConfigHandler;
