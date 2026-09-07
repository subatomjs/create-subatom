// src/helpers/install-deps.ts
import { execa } from "execa";
import detectPackageManager from "./packages/detectPackageManager.js";

export async function installDeps(targetDir: string): Promise<void> {
  if (process.env.SUBATOM_E2E_SKIP_INSTALL === "1") return;

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