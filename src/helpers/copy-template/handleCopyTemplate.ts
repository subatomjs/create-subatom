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
  // Resolve the target directory once so every operation works against
  // exactly the same absolute path.
  const resolvedTargetDir = path.resolve(targetDir);

  // Ensure the project root exists before creating any nested files.
  await fs.ensureDir(resolvedTargetDir);

  //! 1. Create scripts directory
  const scriptDirectory = path.join(resolvedTargetDir, "scripts");
  await fs.ensureDir(scriptDirectory);

  //! 2. Setup environment requirements and Subatom config
  const setupEnvFileName =
    config.language === "js" ? "setup.env.js" : "setup.env.ts";

  // Base environment variables guaranteed for all configurations.
  const baseEnvLines: string[] = [
    "PORT=8080",
    "HOST=localhost",
    "NODE_ENV=development",
  ];

  if (config.useRedis) {
    baseEnvLines.push("REDIS_URL=redis://localhost:6379");
  }

  // Write these files sequentially. This avoids unnecessary bursts of
  // filesystem events while scaffolding a project.
  await fs.outputFile(
    path.join(scriptDirectory, setupEnvFileName),
    dotEnvFileContent(),
    "utf-8",
  );

  await fs.outputFile(
    path.join(resolvedTargetDir, ".env.requirements"),
    `${baseEnvLines.join("\n")}\n`,
    "utf-8",
  );

  await fs.outputFile(
    path.join(
      resolvedTargetDir,
      config.language === "js" ? "subatom.config.js" : "subatom.config.ts",
    ),
    subatomConfigContent(config.language),
    "utf-8",
  );

  //! 3. Copy base language template
  const requiredTemplate =
    config.language === "ts" ? "template_ts" : "template_js";

  await handleCopyIfExists(
    path.join(TEMPLATES_DIR, requiredTemplate),
    resolvedTargetDir,
    requiredTemplate,
  );

  //! 4. Handle ORM templates
  const hasOrm = config.orm !== "none";

  if (hasOrm) {
    const requiredOrmDirectory = `orm/${config.orm}/base`;

    await handleCopyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
      resolvedTargetDir,
      requiredOrmDirectory,
    );

    if (config.orm !== "mongoose" && config.database !== "none") {
      await handleCopyIfExists(
        path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
        resolvedTargetDir,
        `orm/${config.orm}/${config.database}`,
      );
    }
  }

  //! 5. Optional feature templates
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

  //! 6. Execute ORM-specific configuration handlers
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

      const requiredOrmDirectory = `orm/${config.orm}/base`;

      const prismaSnippetFile = path.join(
        resolvedTargetDir,
        `package.snippet.${slugify(requiredOrmDirectory)}.json`,
      );

      await handlePackageSnippetUpdate(prismaSnippetFile, config.language);

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

  //! 7. Generate main entry file
  // This intentionally runs after templates so the generated entry point
  // always wins over any template-provided version.
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

  //! 8. Generate dynamic server file
  const serverFileName = config.language === "ts" ? "server.ts" : "server.js";

  await fs.outputFile(
    path.join(resolvedTargetDir, "src", serverFileName),
    serverFileContent(config.useSocket, config.language),
    "utf-8",
  );

  //! 9. Generate user router file
  const userRouterFileName =
    config.language === "ts" ? "user.route.ts" : "user.route.js";

  await fs.outputFile(
    path.join(resolvedTargetDir, "src", "routes", userRouterFileName),
    userRouterFileContent(config.language),
    "utf-8",
  );

  //! 10. Post-copy feature handlers
  if (config.useRedis) {
    await redisConfigHandler(resolvedTargetDir, config.language);
  }

  if (config.useSocket) {
    await socketConfigHandler(resolvedTargetDir, config.language);
  }

  if (config.useEslint) {
    await setupEslint(config, resolvedTargetDir);
  }

  // Every filesystem operation and configuration handler has been awaited
  // before this function returns. This is important for callers that
  // immediately continue with package installation, Git initialization,
  // or process termination.
}

export default handleCopyTemplate;
