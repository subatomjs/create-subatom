// src/helpers/copy-template.ts
import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../types.js";

const TEMPLATES_DIR: string = new URL("../../templates", import.meta.url)
  .pathname;
const SNIPPET_FILENAME = "package.snippet.json";

export async function copyTemplate(
  config: ProjectConfig,
  targetDir: string,
): Promise<void> {
  await fs.ensureDir(targetDir);

  const baseTemplate = config.language === "ts" ? "template_ts" : "template_js";
  await copyIfExists(
    path.join(TEMPLATES_DIR, baseTemplate),
    targetDir,
    baseTemplate,
  );

  await copyIfExists(
    path.join(TEMPLATES_DIR, "orm", config.orm, "base"),
    targetDir,
    `orm/${config.orm}/base`,
  );

  if (config.orm !== "mongoose") {
    await copyIfExists(
      path.join(TEMPLATES_DIR, "orm", config.orm, config.database),
      targetDir,
      `orm/${config.orm}/${config.database}`,
    );
  }

  if (config.useRedis) {
    await copyIfExists(path.join(TEMPLATES_DIR, "redis"), targetDir, "redis");
  }
  if (config.useEslint) {
    await copyIfExists(path.join(TEMPLATES_DIR, "eslint"), targetDir, "eslint");
  }
  if (config.useVitest) {
    await copyIfExists(path.join(TEMPLATES_DIR, "vitest"), targetDir, "vitest");
  }
}

/**
 * Copies a template folder, but throws a clear, actionable error instead of
 * a raw ENOENT if the folder doesn't exist yet.
 *
 * IMPORTANT: every fragment gets copied into the SAME targetDir, and multiple
 * fragments can each ship their own package.snippet.json. If we copied that
 * file as-is, each fragment would silently overwrite the previous fragment's
 * snippet at the same path, and mergePackageJson would only ever see the
 * last one. So we exclude it from the bulk copy and copy it separately under
 * a name unique to this fragment (derived from `label`).
 */
async function copyIfExists(
  src: string,
  dest: string,
  label: string,
): Promise<void> {
  const exists = await fs.pathExists(src);
  if (!exists) {
    throw new Error(
      `Missing template folder: "${label}" (expected at ${src}). ` +
        `Create this folder before this option can be used.`,
    );
  }

  await fs.copy(src, dest, {
    filter: (srcPath) => path.basename(srcPath) !== SNIPPET_FILENAME,
  });

  const snippetSrcPath = path.join(src, SNIPPET_FILENAME);
  if (await fs.pathExists(snippetSrcPath)) {
    const uniqueName = `package.snippet.${slugify(label)}.json`;
    await fs.copy(snippetSrcPath, path.join(dest, uniqueName));
  }
}

function slugify(label: string): string {
  return label.replace(/[\\/]/g, "-");
}
