import fs from "fs-extra";
import path from "node:path";



async function writeEslintConfig(
  targetDir: string,
  contents: string,
): Promise<void> {
  const configPath = path.join(targetDir, "eslint.config.mjs");
  await fs.writeFile(configPath, contents, "utf8");
}

export default writeEslintConfig