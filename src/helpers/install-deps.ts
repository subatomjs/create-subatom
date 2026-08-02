// src/helpers/install-deps.ts
import { execa } from "execa";
import { detectPackageManager } from "./detect-package-manager.js";

export async function installDeps(targetDir: string): Promise<void> {
  const pm = detectPackageManager();

  try {
    await execa(pm.name, pm.installCommand, {
      cwd: targetDir,
      stdio: "inherit",
    });
  } catch {
    throw new Error(
      `Dependency install failed. You can retry manually by running "cd <project> && ${pm.name} ${pm.installCommand.join(" ")}"`
    );
  }
}