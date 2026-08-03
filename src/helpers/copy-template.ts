// src/helpers/copy-template.ts
import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../types.js";
import {
  schemaContent,
  prismaConfig,
  prismaFileGenerate,
} from "../constants/static_content.js";
import { handlePrismaSchemaBuilder } from "../constants/schema_builder.js";

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

  // Prisma's schema.prisma ships with a placeholder provider — patch it now
  // that both the base and database-specific copies are done.
  if (config.orm === "prisma") {
    await addPrismaConfig(
      targetDir,
      config.database,
      config.language,
      config.projectName,
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

async function addPrismaConfig(
  targetDir: string,
  database: ProjectConfig["database"],
  language: ProjectConfig["language"],
  projectName: ProjectConfig["projectName"],
): Promise<void> {
  const schemaPath = path.join(targetDir, "prisma", "schema.prisma");

  if (!(await fs.pathExists(schemaPath))) {
    throw new Error(
      `Expected to find "${schemaPath}" after copying Prisma templates, but it's missing. ` +
        `Check that orm/prisma/base/prisma/schema.prisma exists.`,
    );
  }

  //! 1. Write boilerplate content of schema.prisma
  database !== "mongodb"
    ? await fs.writeFile(schemaPath, schemaContent(database), "utf-8")
    : null;

  //! 2. Write prisma.config.js or prisma.config.ts file
  await fs.writeFile(
    path.join(
      targetDir,
      `${language === "js" ? "prisma.config.js" : "prisma.config.ts"}`,
    ),
    prismaConfig(),
    "utf-8",
  );

  //! 3. Write prisma.js or prisma.ts file
  database !== "mongodb"
    ? await fs.writeFile(
        path.join(
          `${process.cwd()}/${projectName}`,
          `${language === "js" ? "prisma.js" : "prisma.ts"}`,
        ),
        prismaFileGenerate(database),
        "utf-8",
      )
    : null;

  //! 4. Write schema builder file
  await fs.writeFile(
    path.join(
      `${process.cwd()}/${projectName}`,
      "script",
      `${language === "js" ? "schema_builder.js" : "schema_builder.ts"}`,
    ),

    handlePrismaSchemaBuilder(
      `${process.cwd()}/${projectName}`,
      database,
      language,
    ),
    "utf-8",
  );
}

function slugify(label: string): string {
  return label.replace(/[\\/]/g, "-");
}
