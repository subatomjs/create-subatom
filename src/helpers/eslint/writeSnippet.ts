import fs from "fs-extra";
import path from "node:path";
import { PackageJsonSnippet } from "../../types.js";



async function writeSnippet(
  targetDir: string,
  snippet: PackageJsonSnippet,
): Promise<void> {
  const snippetPath = path.join(targetDir, "package.snippet.eslint.json");
  await fs.writeJson(snippetPath, snippet, { spaces: 2 });
}

export default writeSnippet