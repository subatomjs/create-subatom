import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../src/helpers/atomicWriteFile.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("atomicWriteFile", () => {
  it("replaces a file with the complete payload", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "subatom-atomic-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "package.json");
    await writeFile(filePath, "old");

    await atomicWriteFile(filePath, "new\n");

    await expect(readFile(filePath, "utf8")).resolves.toBe("new\n");
  });
});