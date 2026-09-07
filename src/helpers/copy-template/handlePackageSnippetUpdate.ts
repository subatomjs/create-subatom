import fs from "fs-extra";
import type { Language } from "../../types.js";
import { atomicWriteFile } from "../atomicWriteFile.js";


async function handlePackageSnippetUpdate(
  filePath: string,
  language: Language,
): Promise<void> {
  try {
    // 1. Read and parse existing JSON snippet
    const rawData = await fs.readFile(filePath, "utf8");
    const snippet = JSON.parse(rawData);

    // 2. Ensure scripts object exists
    snippet.scripts = snippet.scripts || {};

    // 3. Update build-schema conditionally
    snippet.scripts["build-schema"] =
      language === "ts"
        ? "ts-node scripts/schema_builder.ts"
        : "node scripts/schema_builder.js";

    // 4. Save formatted JSON back to file
    await atomicWriteFile(filePath, `${JSON.stringify(snippet, null, 2)}\n`);
    console.log("Snippet updated successfully!");
  } catch (error:unknown) {
    console.error("Failed to update snippet:", error);
    throw error;
  }
}

export default handlePackageSnippetUpdate