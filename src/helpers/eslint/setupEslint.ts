import { ProjectConfig } from "../../types.js";
import writeSnippet from "./writeSnippet.js";
import writeEslintConfig from "./writeEslintConfig.js";
import {
  JS_ESLINT_CONFIG,
  TS_ESLINT_CONFIG,
} from "../../utils/eslint/eslint-config-content.js";

export async function setupEslint(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  if (!config.useEslint) return;

  if (config.language === "ts") {
    await writeSnippet(targetDir, {
      devDependencies: {
        eslint: "^9.39.5",
        "@eslint/js": "^9.39.5",
        "typescript-eslint": "^8.66.0",
      },
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix",
      },
    });

    await writeEslintConfig(targetDir, TS_ESLINT_CONFIG);
  } else if (config.language === "js") {
    await writeSnippet(targetDir, {
      devDependencies: {
        eslint: "^9.39.5",
        "@eslint/js": "^9.39.5",
      },
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix",
      },
    });

    await writeEslintConfig(targetDir, JS_ESLINT_CONFIG);
  }
}
