// src/helpers/merge-package-json.ts
import fs from "fs-extra";
import path from "node:path";
import type { PackageJsonSnippet, ProjectConfig } from "../../../types.js";
import findSnippetFiles from "./findSnippetFiles.js";
import mergeTwo from "./mergeTwo.js";
import { sortKeys, toValidPackageName } from "../../sharedHelper.js";
import adjustScriptExtensions from "./adjustScriptExtensions.js";
import { atomicWriteFile } from "../../atomicWriteFile.js";

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

  const snippetsToRemove: string[] = [];
  for (const snippetPath of snippetPaths) {
    const snippet: PackageJsonShape = await fs.readJson(snippetPath);
    rootPackageJson = mergeTwo(rootPackageJson, snippet);
    snippetsToRemove.push(snippetPath);
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

  await atomicWriteFile(
    rootPackageJsonPath,
    `${JSON.stringify(finalPackageJson, null, 2)}\n`,
  );

  await Promise.all(snippetsToRemove.map((snippetPath) => fs.remove(snippetPath)));
}

export default mergePackageJson