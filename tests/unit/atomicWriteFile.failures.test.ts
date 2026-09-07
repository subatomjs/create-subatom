import { describe, expect, it, vi } from "vitest";

const writeFile = vi.fn();
const rename = vi.fn();
const rm = vi.fn();

vi.mock("node:fs/promises", () => ({ writeFile, rename, rm }));

describe("atomicWriteFile failures", () => {
  it("removes the temporary file when the write fails", async () => {
    vi.resetModules();
    writeFile.mockRejectedValueOnce(Object.assign(new Error("no space"), { code: "ENOSPC" }));
    rm.mockResolvedValue(undefined);
    const { atomicWriteFile } = await import("../../src/helpers/atomicWriteFile.js");

    await expect(atomicWriteFile("/tmp/package.json", "{}"))
      .rejects.toMatchObject({ code: "ENOSPC" });
    expect(rm).toHaveBeenCalledWith(expect.stringContaining(".package.json."), { force: true });
    expect(rename).not.toHaveBeenCalled();
  });

  it("propagates a rename failure and still attempts cleanup", async () => {
    vi.resetModules();
    writeFile.mockResolvedValue(undefined);
    rename.mockRejectedValueOnce(Object.assign(new Error("permission denied"), { code: "EACCES" }));
    rm.mockResolvedValue(undefined);
    const { atomicWriteFile } = await import("../../src/helpers/atomicWriteFile.js");

    await expect(atomicWriteFile("/tmp/package.json", "{}"))
      .rejects.toMatchObject({ code: "EACCES" });
    expect(rm).toHaveBeenCalled();
  });

  it("ignores cleanup failure while preserving the original write error", async () => {
    vi.resetModules();
    writeFile.mockRejectedValueOnce(new Error("disk full"));
    rm.mockRejectedValueOnce(new Error("cleanup denied"));
    const { atomicWriteFile } = await import("../../src/helpers/atomicWriteFile.js");

    await expect(atomicWriteFile("/tmp/package.json", "{}"))
      .rejects.toThrow("disk full");
  });
});