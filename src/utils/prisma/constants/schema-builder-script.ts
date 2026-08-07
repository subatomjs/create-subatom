import { Language } from "../../../types.js";
import schemaFileContent from "./schema-prisma-content.js";

const prismaSchemaBuilderScript = (
  target_path: string,
  database: "postgresql" | "mysql" | "sqlite" | string,
  language: "ts" | "js" | string,
) => {
  return `${language === "ts" ? '/// <reference types="node" />' : ""}
import fs from "fs";
import path from "path";

const moduleDir = path.join(${JSON.stringify(target_path)}, "src/models");
const outputFile = path.join(${JSON.stringify(target_path)}, "prisma/schema.prisma");

if (!fs.existsSync(moduleDir)) {
  throw new Error(\`Models directory not found: \${moduleDir}\`);
}

const allModels = ${language === "ts" ? "new Set<string>();" : "new Set();"}
let combinedModules = "";

// Read all module files
const files = fs.readdirSync(moduleDir).filter((f) => f.endsWith(".prisma"));

for (const file of files) {
  const content = fs.readFileSync(path.join(moduleDir, file), "utf-8");

  // Split content into models
  const models = content
    .split(/model\\s+/)
    .filter(Boolean)
    .map((s) => "model " + s);

  ${language === "ts" ? "const filteredModels: string[] = [];" : "const filteredModels = [];"}

  for (const model of models) {
    const match = model.match(/model (\\w+) {/);
    if (match) {
      const modelName = match[1];
      if (allModels.has(modelName)) {
        console.warn("⚠️ Duplicate model skipped:", modelName);
      } else {
        allModels.add(modelName);
        filteredModels.push(model);
      }
    }
  }

  if (filteredModels.length > 0) {
    combinedModules += filteredModels.join("\\n\\n") + "\\n\\n";
  }
}

// Header
// Cast database to any to satisfy schemaContent's expected SqlDatabase type
const header = ${JSON.stringify(schemaFileContent(database as any, language as Language))};

// Write final schema.prisma
fs.writeFileSync(outputFile, header + "\\n\\n" + combinedModules.trim());
console.log("✅ Prisma schema built successfully!");
`;
};

export default prismaSchemaBuilderScript
