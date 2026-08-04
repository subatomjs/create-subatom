#!/usr/bin/env node
import { intro, outro, spinner, cancel } from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";

import { runPrompts } from "./prompt.js";
import { copyTemplate } from "./helpers/copy-template.js";
import { mergePackageJson } from "./helpers/merge-package-json.js";
import { installDeps } from "./helpers/install-deps.js";
import { gitInit } from "./helpers/git-init.js";

async function main() {
  intro(pc.bgCyan(pc.black(" create-subatom ")));

  const config = await runPrompts(process.argv[2]);
  const targetDir = path.resolve(process.cwd(), config.projectName);

  const s = spinner();

  try {
    s.start("Creating project structure");
    // cast config to any to satisfy TemplateConfig index signature
    await copyTemplate(config as unknown as any, targetDir);
    s.stop("Project structure created");

    s.start("Configuring package.json");
    await mergePackageJson(config, targetDir);
    s.stop("package.json configured");

    s.start("Installing dependencies");
    await installDeps(targetDir);
    s.stop("Dependencies installed");

    s.start("Initializing git repository");
    await gitInit(targetDir);
    s.stop("Git repository initialized");
  } catch (err) {
    s.stop("Something went wrong");
    cancel(err instanceof Error ? err.message : "Unknown error occurred.");
    process.exit(1);
  }

  if (
    config.orm === "prisma" &&
    (config.database === "postgresql" || config.database === "mysql" || config.database === 'sqlite')
  ) {
    outro(
      pc.bold(`Done! Just make sure:\n\n`) +
        pc.cyan(`  cd ${config.projectName}\n`) +
        pc.yellow(
          `  ${config.language === "js" ? "node scripts/setup.env.js" : "node scripts/setup.env.ts"}\n`,
        ) +
        pc.yellow(`  Add database url to .env...\n`) +
        pc.yellow(`  npm run build-schema\n`) +
        pc.blue(`  npm run db:generate\n`) +
        pc.green(`  npm run db:migrate\n`) +
        pc.cyan(`  npm run dev\n`),
    );
  } else {
    outro(
      pc.green(`Done! Next steps:\n\n`) +
        pc.cyan(`  cd ${config.projectName}\n`) +
        pc.cyan(`  npm run dev\n`),
    );
  }
}

main();
