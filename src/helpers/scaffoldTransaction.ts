import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

export class ScaffoldTransactionError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ScaffoldTransactionError";
    this.cause = cause;
  }
}

function transactionPath(targetDir: string, suffix: string): string {
  const parent = path.dirname(targetDir);
  const name = path.basename(targetDir);
  return path.join(parent, `.${name}.${suffix}-${randomUUID()}`);
}

async function prepareStage(targetDir: string, stageDir: string): Promise<void> {
  try {
    const targetStat = await lstat(targetDir);
    if (targetStat.isSymbolicLink()) {
      throw new ScaffoldTransactionError(
        `Cannot scaffold through symbolic-link target: ${targetDir}`,
      );
    }
    if (!targetStat.isDirectory()) {
      throw new ScaffoldTransactionError(`Target is not a directory: ${targetDir}`);
    }

    await cp(targetDir, stageDir, {
      recursive: true,
      dereference: false,
      errorOnExist: false,
      force: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(stageDir, { recursive: false });
  }
}

export async function withScaffoldTransaction<T>(
  targetDir: string,
  action: (stagedDir: string) => Promise<T>,
): Promise<T> {
  const stageDir = transactionPath(targetDir, "staging");
  const backupDir = transactionPath(targetDir, "backup");
  let targetMoved = false;

  try {
    await prepareStage(targetDir, stageDir);
    const result = await action(stageDir);

    let targetExists = true;
    try {
      await lstat(targetDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") targetExists = false;
      else throw error;
    }

    if (targetExists) {
      await rename(targetDir, backupDir);
      targetMoved = true;
    }
    await rename(stageDir, targetDir);
    if (targetMoved) await rm(backupDir, { recursive: true, force: true });
    return result;
  } catch (error) {
    await rm(stageDir, { recursive: true, force: true });
    if (targetMoved) {
      await rm(targetDir, { recursive: true, force: true });
      await rename(backupDir, targetDir).catch(() => undefined);
    }
    if (error instanceof ScaffoldTransactionError) throw error;
    throw new ScaffoldTransactionError("Project initialization failed.", error);
  }
}
