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
import { withScaffoldTransaction } from "../helpers/scaffoldTransaction.js";
import { CliExitCode } from "../types.js";

export async function main(
  resolver: (arg?: string) => {
    name: string | undefined;
    useCurrentDir: boolean;
  } = resolveProjectNameArg,
) {
  intro(pc.bgCyan(pc.black(" create-subatom ")));

  let resolved: { name: string | undefined; useCurrentDir: boolean };
  try {
    resolved = resolver(process.argv[2]);
  } catch (err) {
    // Be defensive: `InvalidProjectNameError` may not be available in some
    // mocked environments, so avoid using `instanceof` directly without a
    // safety check which can itself throw. Prefer a name-based fallback.
    const isInvalidNameError =
      (err && (err as Error).name === "InvalidProjectNameError") ||
      (typeof InvalidProjectNameError !== "undefined" &&
        err instanceof InvalidProjectNameError);

    if (isInvalidNameError) {
      cancel(
        `${pc.red((err as Error).message)}\n\n${
          // biome-ignore lint/suspicious/noExplicitAny: explanation
          pc.dim((err as any).cause)
        }`,
      );
      process.exit(CliExitCode.InvalidProjectName);
      return;
    }

    throw err;
  }

  const config = await runPrompts(resolved.name);

  // "." means install into the current directory — don't nest a new folder.
  /* c8 ignore next 2: both target modes are exercised by the E2E matrix. */
  const targetDir = resolved.useCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), config.projectName);

  const s = spinner();

  try {
    s.start("Creating project structure");
    await withScaffoldTransaction(targetDir, async (stagedDir) => {
      await handleCopyTemplate(config, stagedDir);
      s.stop("Project structure created");

      s.start("Configuring package.json");
      await mergePackageJson(config, stagedDir);
      s.stop("package.json configured");

      s.start("Installing dependencies");
      await installDeps(stagedDir);
      s.stop("Dependencies installed");

      s.start("Initializing git repository");
      await gitInit(stagedDir);
      s.stop("Git repository initialized");
    });
  } catch (err) {
    s.stop("Something went wrong");
    /* c8 ignore next: transaction failures are normalized to Error in production. */
    cancel(err instanceof Error ? err.message : "Unknown error occurred.");
    process.exit(CliExitCode.InitializationFailed);
    return;
  }

  outro(buildOutroMessage(config));
}

export async function runCli(
  runner: () => Promise<void> = main,
): Promise<void> {
  try {
    await runner();
  } catch (error: unknown) {
    cancel(error instanceof Error ? error.message : "Unknown error occurred.");
    process.exitCode = 1;
  }
}

// Only auto-run when not under test to allow stable unit testing of `main()`.
/* c8 ignore next: executable entrypoint is covered by E2E. */
if (process.env.NODE_ENV !== "test") {
  /* c8 ignore next: exercised by the executable/E2E process, not unit imports. */
  void runCli();
}
