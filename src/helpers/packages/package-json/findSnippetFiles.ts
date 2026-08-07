import fs from "fs-extra";
import path from "node:path";
import { SNIPPET_PATTERN } from "../../../utils/common_content.js";

async function findSnippetFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      results.push(...(await findSnippetFiles(fullPath)));
    } else if (entry.isFile() && SNIPPET_PATTERN.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

export default findSnippetFiles;
