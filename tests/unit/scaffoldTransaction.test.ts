import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ScaffoldTransactionError,
  withScaffoldTransaction,
} from "../../src/helpers/scaffoldTransaction.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("withScaffoldTransaction", () => {
  it("commits a new project directory", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "subatom-transaction-"));
    temporaryDirectories.push(parent);
    const target = path.join(parent, "project");

    await withScaffoldTransaction(target, async (stagedDir) => {
      await writeFile(path.join(stagedDir, "generated.txt"), "generated");
    });

    await expect(readFile(path.join(target, "generated.txt"), "utf8")).resolves.toBe("generated");
  });

  it("restores an existing project when initialization fails", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "subatom-transaction-"));
    temporaryDirectories.push(parent);
    const target = path.join(parent, "project");
    await rm(target, { recursive: true, force: true });
    await import("node:fs/promises").then(({ mkdir }) => mkdir(target));
    await writeFile(path.join(target, "existing.txt"), "keep");

    await expect(
      withScaffoldTransaction(target, async (stagedDir) => {
        await writeFile(path.join(stagedDir, "partial.txt"), "discard");
        throw new Error("dependency failure");
      }),
    ).rejects.toBeInstanceOf(ScaffoldTransactionError);

    await expect(readFile(path.join(target, "existing.txt"), "utf8")).resolves.toBe("keep");
    await expect(readFile(path.join(target, "partial.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});