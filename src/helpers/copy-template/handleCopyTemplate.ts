import fs from "fs-extra";
import path from "node:path";
import { ProjectConfig } from "../../types.js";
import { dotEnvFileContent, subatomConfigContent, TEMPLATES_DIR } from "../../utils/common_content.js";
import handleCopyIfExists from "./handleCopyIfExists.js";
import prismaConfigHandler from "../../utils/prisma/prismaConfigHandler.js";
import { slugify } from "../sharedHelper.js";
import handlePackageSnippetUpdate from "./handlePackageSnippetUpdate.js";
import mongooseConfigHandler from "../../utils/mongo/mongooseConfigHandler.js";
import drizzleConfigHandler from "../../utils/drizzle/drizzleConfigHandler.js";
import redisConfigHandler from "../../utils/redis/redisConfigHandler.js";
import { setupEslint } from "../eslint/setupEslint.js";

async function handleCopyTemplate(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  await fs.ensureDir(targetDir);

  //!  1. create script directory path..
  const script_directory = path.join(targetDir, "scripts");
  
  //! 2. setup.env.ts || setup.env.js file...
  const copy_env_requirements_config_file = config.language === "js" ? "setup.env.js" : "setup.env.ts";


  await Promise.all([
    //todo: 1. create .env file from .env.requirements script...
    fs.outputFile(path.join(script_directory, copy_env_requirements_config_file), dotEnvFileContent(), "utf-8"),

    //todo: 2. create subatom.config.ts || subatom.config.js file...
    fs.outputFile(path.join(targetDir, config.language === "js" ? "subatom.config.js" : "subatom.config.ts"), subatomConfigContent(config.language),"utf-8"),
  ]);

  //! 3. template selection according language ...
  const required_template = config.language === "ts" ? "template_ts" : "template_js";

  //! 4. base file path...
  const required_orm_directory = `orm/${config.orm}/base`;


  const copyJobs: Promise<void>[] = [
    //todo: 1. Template directory copy...
    handleCopyIfExists(
      path.join(TEMPLATES_DIR, required_template),
      targetDir,
      required_template,
    ),

    //todo: 2. ORM directory copy ...
    handleCopyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
      targetDir,
      required_orm_directory,
    ),
  ];


  //todo: If orm is not mongoose: push this to copy jobs...
  if (config.orm !== "mongoose") {
    copyJobs.push(
      handleCopyIfExists(
        path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
        targetDir,
        `orm/${config.orm}/${config.database}`,
      ),
    );
  }

  await Promise.all(copyJobs);



switch (config.orm) {
    case "prisma":
      await prismaConfigHandler(
        targetDir,
        config.database,
        config.language,
        config.projectName,
        config.useRedis,
        config.orm,
      );

      // Update package snippet name...
      const prisma_snippet_file = path.join(targetDir, `package.snippet.${slugify(required_orm_directory)}.json`);
      await handlePackageSnippetUpdate(prisma_snippet_file, config.language);
      break;

    case "mongoose":
      await mongooseConfigHandler(
        targetDir,
        config.language,
        config.projectName,
        config.database,
        config.orm,
        config.useRedis,
      );
      break;

    case "drizzle":
      await drizzleConfigHandler(
        targetDir,
        config.language,
        config.projectName,
        config.database,
        config.orm,
        config.useRedis,
      );
      break;

    default:
      throw new Error(`Unsupported ORM: ${config.orm}`);
  }


  //! Redis configuration....
  if (config.useRedis === true) {
    await redisConfigHandler(targetDir, config.language);
  }

  //! Eslint configuration....
  if (config.useEslint === true) {
    await setupEslint(config, targetDir);
  }

  // Optional extras are independent of each other — copy concurrently.
  const optionalJobs: Promise<void>[] = [];
  
  if (config.useRedis) {
    optionalJobs.push(
      handleCopyIfExists(path.join(TEMPLATES_DIR, "redis"), targetDir, "redis"),
    );
  }
  if (config.useVitest) {
    optionalJobs.push(
      handleCopyIfExists(path.join(TEMPLATES_DIR, "vitest"), targetDir, "vitest"),
    );
  }
  if (optionalJobs.length) {
    await Promise.all(optionalJobs);
  }
}

export default handleCopyTemplate