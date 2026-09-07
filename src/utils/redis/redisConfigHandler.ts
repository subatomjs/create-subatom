// redisConfigHandler.ts

import fs from "fs-extra";
import path from "node:path";

import type { ProjectConfig } from "../../types.js";
import redisClientFileContent from "./constants/redis-client-content.js";
import redisConfigFileContent from "./constants/redis-config-content.js";
import redisErrorsFileContent from "./constants/redis-error-content.js";
import indexFileContent from "./constants/redis-index-content.js";
import redisBootstrapFileContent from "./constants/redis-bootstrap-content.js";
import redisTypesFileContent from "./constants/redis-types-content.js";
import redisEnvConfigFileContent from "./constants/redis-env-config.js";

async function redisConfigHandler(
  targetDir: string,
  language: ProjectConfig["language"],
) {
  const redis_directory = path.join(targetDir, "src", "redis");
  const config_directory_address = path.join(targetDir, "src", "config");

  const env_config_file_path = path.join(
    config_directory_address,
    language === "js" ? "envConfig.js" : "envConfig.ts",
  );

  const jobs: Promise<void>[] = [
    //! 1. redis-client.ts
    fs.outputFile(
      path.join(redis_directory, `redis-client.${language}`),
      redisClientFileContent(language),
      "utf-8",
    ),
    //! 2. redis.config.ts
    fs.outputFile(
      path.join(redis_directory, `redis.config.${language}`),
      redisConfigFileContent(language),
      "utf-8",
    ),
    //! 3. redis.errors.ts
    fs.outputFile(
      path.join(redis_directory, `redis.errors.${language}`),
      redisErrorsFileContent(language),
      "utf-8",
    ),
    //! 4. index.ts
    fs.outputFile(
      path.join(redis_directory, `index.${language}`),
      indexFileContent(language),
      "utf-8",
    ),
    //! 5. redis.bootstrap.ts
    fs.outputFile(
      path.join(redis_directory, `redis.bootstrap.${language}`),
      redisBootstrapFileContent(language),
      "utf-8",
    ),
    fs.outputFile(
      path.join(env_config_file_path, `envConfig.${language}`),
      redisEnvConfigFileContent(language),
      "utf-8",
    ),
  ];

  // TODO: (If language is typescript create [redis.types.ts] file)
  if (language === "ts") {
    jobs.push(
      //! 6. redis.types.ts
      fs.outputFile(
        path.join(redis_directory, `redis.types.${language}`),
        redisTypesFileContent,
        "utf-8",
      ),
    );
  }
}

export default redisConfigHandler;
