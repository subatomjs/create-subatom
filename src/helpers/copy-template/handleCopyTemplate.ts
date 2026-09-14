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
  // 1. Resolve targetDir to an absolute path so VS Code's watcher and child processes track it properly
  const resolvedTargetDir = path.resolve(process.cwd(), targetDir);
  await fs.ensureDir(resolvedTargetDir);

  // 2. Base language template
  const required_template =
    config.language === "ts" ? "template_ts" : "template_js";

  await handleCopyIfExists(
    path.join(TEMPLATES_DIR, required_template),
    resolvedTargetDir,
    required_template,
  );

  // 3. Handle ORM templates sequentially to prevent destination write races
  const hasOrm = config.orm !== "none";

  if (hasOrm) {
    const required_orm_directory = `orm/${config.orm}/base`;

    await handleCopyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
      resolvedTargetDir,
      required_orm_directory,
    );

    if (config.orm !== "mongoose" && config.database !== "none") {
      await handleCopyIfExists(
        path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
        resolvedTargetDir,
        `orm/${config.orm}/${config.database}`,
      );
    }
  }

  // 4. Optional feature templates (executed sequentially)
  if (config.useRedis) {
    await handleCopyIfExists(
      path.join(TEMPLATES_DIR, "redis"),
      resolvedTargetDir,
      "redis",
    );
  }

  if (config.useSocket) {
    await handleCopyIfExists(
      path.join(TEMPLATES_DIR, "socket"),
      resolvedTargetDir,
      "socket",
    );
  }

  if (config.useVitest) {
    await handleCopyIfExists(
      path.join(TEMPLATES_DIR, "vitest"),
      resolvedTargetDir,
      "vitest",
    );
  }

  // 5. Execute ORM-specific configuration handlers
  switch (config.orm) {
    case "prisma": {
      await prismaConfigHandler(
        resolvedTargetDir,
        config.database,
        config.language,
        config.useRedis,
        config.orm,
        config.useSocket,
      );

      const required_orm_directory = `orm/${config.orm}/base`;
      const prisma_snippet_file = path.join(
        resolvedTargetDir,
        `package.snippet.${slugify(required_orm_directory)}.json`,
      );
      await handlePackageSnippetUpdate(prisma_snippet_file, config.language);
      break;
    }

    case "mongoose":
      await mongooseConfigHandler(
        resolvedTargetDir,
        config.language,
        config.database,
        config.orm,
        config.useRedis,
        config.useSocket,
      );
      break;

    case "drizzle":
      await drizzleConfigHandler(
        resolvedTargetDir,
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

  // 6. Setup environment files, scripts, and subatom.config after templates are in place
  const script_directory = path.join(resolvedTargetDir, "scripts");
  await fs.ensureDir(script_directory);

  const copy_env_requirements_config_file =
    config.language === "js" ? "setup.env.js" : "setup.env.ts";

  const baseEnvLines: string[] = [
    "PORT=8080",
    "HOST=localhost",
    "NODE_ENV=development",
  ];

  if (config.useRedis) {
    baseEnvLines.push("REDIS_URL=redis://localhost:6379");
  }

  await Promise.all([
    fs.outputFile(
      path.join(script_directory, copy_env_requirements_config_file),
      dotEnvFileContent(),
      "utf-8",
    ),
    fs.outputFile(
      path.join(resolvedTargetDir, ".env.requirements"),
      `${baseEnvLines.join("\n")}\n`,
      "utf-8",
    ),
    fs.outputFile(
      path.join(
        resolvedTargetDir,
        config.language === "js" ? "subatom.config.js" : "subatom.config.ts",
      ),
      subatomConfigContent(config.language),
      "utf-8",
    ),
  ]);

  // 7. Generate main entry file
  const mainFileName = config.language === "ts" ? "main.ts" : "main.js";
  await fs.outputFile(
    path.join(resolvedTargetDir, mainFileName),
    mainFileContent(
      config.database,
      config.orm,
      config.language,
      config.useRedis,
      config.useSocket,
    ),
    "utf-8",
  );

  // 8. Create dynamic server file
  const serverFileName = config.language === "ts" ? "server.ts" : "server.js";
  await fs.outputFile(
    path.join(resolvedTargetDir, "src", serverFileName),
    serverFileContent(config.useSocket, config.language),
    "utf-8",
  );

  // 9. Create user router file
  const userRouterFileName =
    config.language === "ts" ? "user.route.ts" : "user.route.js";
  await fs.outputFile(
    path.join(resolvedTargetDir, "src", "routes", userRouterFileName),
    userRouterFileContent(config.language),
    "utf-8",
  );

  // 10. Post-copy feature handlers
  if (config.useRedis) {
    await redisConfigHandler(resolvedTargetDir, config.language);
  }

  if (config.useSocket) {
    await socketConfigHandler(resolvedTargetDir, config.language);
  }

  if (config.useEslint) {
    await setupEslint(config, resolvedTargetDir);
  }
}

export default handleCopyTemplate;