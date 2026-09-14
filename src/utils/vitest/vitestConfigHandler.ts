import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../../types.js";
import {
  VITEST_CONFIG_FILE_CONTENT,
  VITEST_EXAMPLE_FILE_CONTENT,
} from "./constant/vitest-config-content.js";

const vitestConfigHandler = async (
  targetDir: string,
  language: ProjectConfig["language"],
) => {
  //! 1. generate vitest.config file
  await fs.outputFile(
    path.join(targetDir, `vitest.config.${language}`),
    VITEST_CONFIG_FILE_CONTENT,
    "utf-8",
  );

  //! 2. generate tests/example.test file
  await fs.outputFile(
    path.join(targetDir, "tests", `example.test.${language}`),
    VITEST_EXAMPLE_FILE_CONTENT,
    "utf-8",
  );
};

export default vitestConfigHandler;
