#!/usr/bin/env node
import { intro, outro, spinner, cancel } from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";

import { runPrompts } from "../prompt.js";
import { installDeps } from "../helpers/installDeps.js";
import { gitInit } from "../helpers/gitInit.js";
import {
  resolveProjectNameArg,
  InvalidProjectNameError,
} from "../helpers/resolveProjectName.js";
import { buildOutroMessage } from "../helpers/formatOutro.js";
import handleCopyTemplate from "../helpers/copy-template/handleCopyTemplate.js";
import mergePackageJson from "../helpers/packages/package-json/mergePackageJson.js";

export async function main(resolver: (arg?: string) => { name: string | undefined; useCurrentDir: boolean } = resolveProjectNameArg) {
  intro(pc.bgCyan(pc.black(" create-subatom ")));

  let resolved: { name: string | undefined; useCurrentDir: boolean };
  try {
    resolved = resolver(process.argv[2]);
  } catch (err) {
    // Be defensive: `InvalidProjectNameError` may not be available in some
    // mocked environments, so avoid using `instanceof` directly without a
    // safety check which can itself throw. Prefer a name-based fallback.
    const isInvalidNameError =
      (err && (err as any).name === "InvalidProjectNameError") ||
      (typeof InvalidProjectNameError !== "undefined" && err instanceof InvalidProjectNameError);

    if (isInvalidNameError) {
      cancel(`${pc.red((err as any).message)}\n\n${pc.dim((err as any).cause)}`);
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
    await handleCopyTemplate(config as unknown as any, targetDir);
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

// Only auto-run when not under test to allow stable unit testing of `main()`.
if (process.env.NODE_ENV !== 'test') {
  main();
}
