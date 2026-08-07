// src/helpers/merge-package-json.ts
import fs from "fs-extra";
import path from "node:path";
import { PackageJsonSnippet, ProjectConfig } from "../../../types.js";
import findSnippetFiles from "./findSnippetFiles.js";
import mergeTwo from "./mergeTwo.js";
import { sortKeys, toValidPackageName } from "../../sharedHelper.js";
import adjustScriptExtensions from "./adjustScriptExtensions.js";

export type PackageJsonShape = PackageJsonSnippet;

async function mergePackageJson(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  const rootPackageJsonPath = path.join(targetDir, "package.json");

  let rootPackageJson: PackageJsonShape = {};
  if (await fs.pathExists(rootPackageJsonPath)) {
    rootPackageJson = await fs.readJson(rootPackageJsonPath);
  }

  const snippetPaths = (await findSnippetFiles(targetDir)).sort();

  for (const snippetPath of snippetPaths) {
    const snippet: PackageJsonShape = await fs.readJson(snippetPath);
    rootPackageJson = mergeTwo(rootPackageJson, snippet);
    await fs.remove(snippetPath);
  }

  const {
    name: _ignoredName,
    version: mergedVersion,
    private: _ignoredPrivate,
    type: mergedType,
    description,
    scripts,
    dependencies,
    devDependencies,
    ...rest
  } = rootPackageJson;

  const finalPackageJson: PackageJsonShape = {
    name: toValidPackageName(config.projectName),
    private: true,
    version: mergedVersion ?? "0.1.0",
    ...(description ? { description } : {}),
    ...(mergedType !== undefined
      ? { type: mergedType }
      : config.language === "ts"
        ? { type: "module" }
        : {}),
    scripts: adjustScriptExtensions(scripts ?? {}, config.language),
    dependencies: sortKeys(dependencies ?? {}),
    devDependencies: sortKeys(devDependencies ?? {}),
    ...rest,
  };

  await fs.writeJson(rootPackageJsonPath, finalPackageJson, { spaces: 2 });
}

export default mergePackageJson