import { describe, expect, it, vi, beforeEach } from "vitest";

const cp = vi.fn();
const lstat = vi.fn();
const mkdir = vi.fn();
const rename = vi.fn();
const rm = vi.fn();

vi.mock("node:fs/promises", () => ({ cp, lstat, mkdir, rename, rm }));

const directory = () => ({
  isSymbolicLink: () => false,
  isDirectory: () => true,
});

describe("scaffold transaction defensive branches", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cp.mockResolvedValue(undefined);
    mkdir.mockResolvedValue(undefined);
    rename.mockResolvedValue(undefined);
    rm.mockResolvedValue(undefined);
  });

  it("rejects symbolic-link targets and removes the stage", async () => {
    lstat.mockResolvedValueOnce({ isSymbolicLink: () => true, isDirectory: () => false });
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toThrow("Cannot scaffold through symbolic-link target");
    expect(rm).toHaveBeenCalledWith(expect.stringContaining(".project.staging-"), {
      recursive: true,
      force: true,
    });
  });

  it("creates a stage when the target does not exist", async () => {
    lstat.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    lstat.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await withScaffoldTransaction("/tmp/project", async (stagedDir) => {
      expect(stagedDir).toContain(".project.staging-");
    });
    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining(".project.staging-"), {
      recursive: false,
    });
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it("wraps stage creation permission failures", async () => {
    lstat.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "EACCES" }));
    const { withScaffoldTransaction, ScaffoldTransactionError } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toBeInstanceOf(ScaffoldTransactionError);
  });

  it("rejects a file target", async () => {
    lstat.mockResolvedValueOnce({ isSymbolicLink: () => false, isDirectory: () => false });
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toThrow("Target is not a directory");
  });

  it("wraps target metadata failures during commit", async () => {
    lstat
      .mockResolvedValueOnce(directory())
      .mockRejectedValueOnce(Object.assign(new Error("metadata denied"), { code: "EACCES" }));
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toThrow("Project initialization failed.");
  });

  it("attempts restoration when commit fails after moving the target", async () => {
    lstat.mockResolvedValueOnce(directory()).mockResolvedValueOnce(directory());
    rename.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("commit denied"));
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toThrow("Project initialization failed.");
    expect(rename).toHaveBeenLastCalledWith(
      expect.stringContaining(".project.backup-"),
      "/tmp/project",
    );
  });

  it("ignores backup restoration failure while reporting the commit error", async () => {
    lstat.mockResolvedValueOnce(directory()).mockResolvedValueOnce(directory());
    rename
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("commit denied"))
      .mockRejectedValueOnce(new Error("restore denied"));
    const { withScaffoldTransaction } = await import("../../src/helpers/scaffoldTransaction.js");

    await expect(withScaffoldTransaction("/tmp/project", async () => undefined))
      .rejects.toThrow("Project initialization failed.");
  });
});