export const VITEST_CONFIG_FILE_CONTENT: string = `
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});

`;

export const VITEST_EXAMPLE_FILE_CONTENT: string = `import { describe, expect, it } from "vitest";

describe("Subatom application", () => {
  it("should run tests correctly", () => {
    expect(true).toBe(true);
  });
});`;
