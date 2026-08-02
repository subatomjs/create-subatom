// src/helpers/merge-package-json.ts
import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig, PackageJsonSnippet } from "../types.js";

type PackageJsonShape = PackageJsonSnippet;

// Matches "package.snippet.json" as well as the disambiguated
// "package.snippet.<label>.json" files written by copy-template.ts.
const SNIPPET_PATTERN = /^package\.snippet(?:\..+)?\.json$/;

export async function mergePackageJson(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  const rootPackageJsonPath = path.join(targetDir, "package.json");

  let rootPackageJson: PackageJsonShape = {};
  if (await fs.pathExists(rootPackageJsonPath)) {
    rootPackageJson = await fs.readJson(rootPackageJsonPath);
  }

  const snippetPaths = (await findSnippetFiles(targetDir)).sort(); // deterministic merge order

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
    type: mergedType ?? (config.language === "ts" ? "module" : undefined),
    scripts: scripts ?? {},
    dependencies: sortKeys(dependencies ?? {}),
    devDependencies: sortKeys(devDependencies ?? {}),
    ...rest,
  };

  await fs.writeJson(rootPackageJsonPath, finalPackageJson, { spaces: 2 });
}

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

function mergeTwo(
  base: PackageJsonShape,
  incoming: PackageJsonShape,
): PackageJsonShape {
  return {
    ...base,
    ...incoming,
    scripts: { ...base.scripts, ...incoming.scripts },
    dependencies: { ...base.dependencies, ...incoming.dependencies },
    devDependencies: { ...base.devDependencies, ...incoming.devDependencies },
  };
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function toValidPackageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}
