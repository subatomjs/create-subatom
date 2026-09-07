import { describe, expect, it, afterEach, vi } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));

describe("installDeps E2E mode", () => {
  afterEach(() => {
    delete process.env.SUBATOM_E2E_SKIP_INSTALL;
  });

  it("skips package-manager execution only for the E2E flag", async () => {
    process.env.SUBATOM_E2E_SKIP_INSTALL = "1";
    const { execa } = await import("execa");
    const { installDeps } = await import("../../src/helpers/installDeps.js");

    await expect(installDeps("/tmp/project")).resolves.toBeUndefined();
    expect(execa).not.toHaveBeenCalled();
  });
});