import { describe, it, expect, vi, type Mock } from "vitest";

vi.mock("../../src/helpers/eslint/writeSnippet.js", () => ({
  default: vi.fn(),
}));
vi.mock("../../src/helpers/eslint/writeEslintConfig.js", () => ({
  default: vi.fn(),
}));

describe("setupEslint", () => {
  it("does nothing when useEslint is false", async () => {
    const { setupEslint } =
      await import("../../src/helpers/eslint/setupEslint.ts");
    await setupEslint(
      {
        projectName: "x",
        language: "ts",
        orm: "prisma",
        database: "postgresql",
        useRedis: false,
        useSocket: false,
        useEslint: false,
        useVitest: false,
      },
      "/tmp",
    );
    const writeSnippet = (
      await import("../../src/helpers/eslint/writeSnippet.js")
    ).default;
    expect(writeSnippet).not.toHaveBeenCalled();
  });

  it("writes TS snippet and config when language is ts", async () => {
    const writeSnippet = (
      await import("../../src/helpers/eslint/writeSnippet.js")
    ).default as Mock;
    const writeConfig = (
      await import("../../src/helpers/eslint/writeEslintConfig.js")
    ).default as Mock;

    const { setupEslint } =
      await import("../../src/helpers/eslint/setupEslint.ts");
    await setupEslint(
      {
        projectName: "x",
        language: "ts",
        orm: "prisma",
        database: "postgresql",
        useRedis: false,
        useSocket: false,
        useEslint: true,
        useVitest: false,
      },
      "/tmp",
    );

    expect(writeSnippet).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalled();
  });

  it("writes JS snippet and config when language is js", async () => {
    const writeSnippet = (
      await import("../../src/helpers/eslint/writeSnippet.js")
    ).default as Mock;
    const writeConfig = (
      await import("../../src/helpers/eslint/writeEslintConfig.js")
    ).default as Mock;

    const { setupEslint } =
      await import("../../src/helpers/eslint/setupEslint.ts");
    await setupEslint(
      {
        projectName: "x",
        language: "js",
        orm: "prisma",
        database: "postgresql",
        useRedis: false,
        useSocket: false,
        useEslint: true,
        useVitest: false,
      },
      "/tmp",
    );

    expect(writeSnippet).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalled();
  });

  it("does not write for unsupported language values", async () => {
    const writeSnippet = (
      await import("../../src/helpers/eslint/writeSnippet.js")
    ).default as Mock;
    const { setupEslint } =
      await import("../../src/helpers/eslint/setupEslint.ts");
    writeSnippet.mockClear();

    await setupEslint(
      {
        projectName: "x",
        language: "wasm" as unknown as "ts",
        orm: "none",
        database: "none",
        useRedis: false,
        useSocket: false,
        useEslint: true,
        useVitest: false,
      },
      "/tmp",
    );

    expect(writeSnippet).not.toHaveBeenCalled();
  });
});
