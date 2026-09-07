import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../../types.js";
import {
  dotEnvFileContent,
  mainFileContent,
  serverFileContent,
  subatomConfigContent,
  TEMPLATES_DIR,
  userRouterFileContent,
} from "../../utils/common_content.js";
import handleCopyIfExists from "./handleCopyIfExists.js";
import prismaConfigHandler from "../../utils/prisma/prismaConfigHandler.js";
import { slugify } from "../sharedHelper.js";
import handlePackageSnippetUpdate from "./handlePackageSnippetUpdate.js";
import mongooseConfigHandler from "../../utils/mongo/mongooseConfigHandler.js";
import drizzleConfigHandler from "../../utils/drizzle/drizzleConfigHandler.js";
import redisConfigHandler from "../../utils/redis/redisConfigHandler.js";
import { setupEslint } from "../eslint/setupEslint.js";
import socketConfigHandler from "../../utils/websocket/socketConfigHandler.js";

async function handleCopyTemplate(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  await fs.ensureDir(targetDir);

  //! 1. Create scripts directory path
  const script_directory = path.join(targetDir, "scripts");

  //! 2. Setup .env requirements, root .env.requirements, and subatom.config
  const copy_env_requirements_config_file =
    config.language === "js" ? "setup.env.js" : "setup.env.ts";

  // Base environment variables guaranteed for all configurations
  const baseEnvLines: string[] = [
    "PORT=8080",
    "HOST=localhost",
    "NODE_ENV=development",
  ];

  if (config.useRedis) {
    baseEnvLines.push("REDIS_URL=redis://localhost:6379");
  }

  await Promise.all([
    // scripts/setup.env.(ts|js)
    fs.outputFile(
      path.join(script_directory, copy_env_requirements_config_file),
      dotEnvFileContent(),
      "utf-8",
    ),
    // Root .env.requirements (written even if no DB/ORM is selected)
    fs.outputFile(
      path.join(targetDir, ".env.requirements"),
      `${baseEnvLines.join("\n")}\n`,
      "utf-8",
    ),
    // subatom.config.(ts|js)
    fs.outputFile(
      path.join(
        targetDir,
        config.language === "js" ? "subatom.config.js" : "subatom.config.ts",
      ),
      subatomConfigContent(config.language),
      "utf-8",
    ),
  ]);

  //! 3. Base language template
  const required_template =
    config.language === "ts" ? "template_ts" : "template_js";

  const copyJobs: Promise<void>[] = [
    handleCopyIfExists(
      path.join(TEMPLATES_DIR, required_template),
      targetDir,
      required_template,
    ),
  ];

  //! 4. Handle ORM templates
  const hasOrm = config.orm !== "none";

  if (hasOrm) {
    const required_orm_directory = `orm/${config.orm}/base`;

    copyJobs.push(
      handleCopyIfExists(
        path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
        targetDir,
        required_orm_directory,
      ),
    );

    if (config.orm !== "mongoose" && config.database !== "none") {
      copyJobs.push(
        handleCopyIfExists(
          path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
          targetDir,
          `orm/${config.orm}/${config.database}`,
        ),
      );
    }
  }

  //! 5. Optional feature templates
  if (config.useRedis) {
    copyJobs.push(
      handleCopyIfExists(path.join(TEMPLATES_DIR, "redis"), targetDir, "redis"),
    );
  }

  if (config.useSocket) {
    copyJobs.push(
      handleCopyIfExists(
        path.join(TEMPLATES_DIR, "socket"),
        targetDir,
        "socket",
      ),
    );
  }

  if (config.useVitest) {
    copyJobs.push(
      handleCopyIfExists(
        path.join(TEMPLATES_DIR, "vitest"),
        targetDir,
        "vitest",
      ),
    );
  }

  // Copy in order so overlapping template paths cannot race on the destination.
  for (const copyJob of copyJobs) {
    await copyJob;
  }

  //! 6. Execute ORM-specific configuration handlers
  switch (config.orm) {
    case "prisma": {
      await prismaConfigHandler(
        targetDir,
        config.database,
        config.language,
        config.useRedis,
        config.orm,
        config.useSocket,
      );

      const required_orm_directory = `orm/${config.orm}/base`;
      const prisma_snippet_file = path.join(
        targetDir,
        `package.snippet.${slugify(required_orm_directory)}.json`,
      );
      await handlePackageSnippetUpdate(prisma_snippet_file, config.language);
      break;
    }

    case "mongoose":
      await mongooseConfigHandler(
        targetDir,
        config.language,
        config.database,
        config.orm,
        config.useRedis,
        config.useSocket,
      );
      break;

    case "drizzle":
      await drizzleConfigHandler(
        targetDir,
        config.language,
        config.database,
        config.orm,
        config.useRedis,
        config.useSocket,
      );
      break;

    case "none":
      break;

    default: {
      const _exhaustiveCheck: never = config.orm;
      throw new Error(`Unsupported ORM: ${_exhaustiveCheck}`);
    }
  }

  //! 7. Generate main entry file (Guarantees main.ts/js is always written)
  const mainFileName = config.language === "ts" ? "main.ts" : "main.js";
  await fs.outputFile(
    path.join(targetDir, mainFileName),
    mainFileContent(
      config.database,
      config.orm,
      config.language,
      config.useRedis,
      config.useSocket,
    ),
    "utf-8",
  );

  //! 8. create dynamic server file.
  const serverFileName = config.language === "ts" ? "server.ts" : "server.js";
  await fs.outputFile(
    path.join(targetDir, "src", serverFileName),
    serverFileContent(config.useSocket, config.language),
    "utf-8",
  );

//! 9. create user router file.
    const userRouterFileName = config.language === "ts" ? "user.route.ts" : "user.route.js";
  await fs.outputFile(
    path.join(targetDir, "src", "routes", userRouterFileName),
    userRouterFileContent(config.language),
    "utf-8",
  );


  //! 10. Post-copy feature handlers
  if (config.useRedis) {
    await redisConfigHandler(targetDir, config.language);
  }

  if (config.useSocket) {
    await socketConfigHandler(targetDir, config.language);
  }

  if (config.useEslint) {
    await setupEslint(config, targetDir);
  }
}

export default handleCopyTemplate;
