#!/usr/bin/env node
import { intro, outro, spinner, cancel } from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";

import { runPrompts } from "./prompt.js";
import { copyTemplate } from "./helpers/copy-template.js";
import { mergePackageJson } from "./helpers/merge-package-json.js";
import { installDeps } from "./helpers/install-deps.js";
import { gitInit } from "./helpers/git-init.js";
import { resolveProjectNameArg, InvalidProjectNameError } from "./helpers/resolve-project-name.js";
import { buildOutroMessage } from "./helpers/format-outro.js";

async function main() {
  intro(pc.bgCyan(pc.black(" create-subatom ")));

  let resolved: { name: string | undefined; useCurrentDir: boolean };
  try {
    resolved = resolveProjectNameArg(process.argv[2]);
  } catch (err) {
    if (err instanceof InvalidProjectNameError) {
      cancel(`${pc.red(err.message)}\n\n${pc.dim(err.cause)}`);
      process.exit(1);
    }
    throw err;
  }

  const config = await runPrompts(resolved.name);

  // "." means install into the current directory — don't nest a new folder.
  const targetDir = resolved.useCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), config.projectName);

  const s = spinner();

  try {
    s.start("Creating project structure");
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

  outro(buildOutroMessage(config));
}

main();