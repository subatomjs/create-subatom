import type { PackageManager, PackageManagerInfo } from "../../types.js";

// Package managers list 
const PACKAGE_MANAGERS: Record<PackageManager, PackageManagerInfo> = {
  npm: {
    name: 'npm',
    installCommand: ['install'],
    runCommand: (script) => ['run', script],
  },
  pnpm: {
    name: 'pnpm',
    installCommand: ['install'],
    runCommand: (script) => [script],
  },
  yarn: {
    name: 'yarn',
    installCommand: ['install'],
    runCommand: (script) => [script],
  },
  bun: {
    name: 'bun',
    installCommand: ['install'],
    runCommand: (script) => ['run', script],
  },
};

// Detect package manager function 
function detectPackageManager(): PackageManagerInfo {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return PACKAGE_MANAGERS.pnpm;
  if (userAgent.startsWith('yarn')) return PACKAGE_MANAGERS.yarn;
  if (userAgent.startsWith('bun')) return PACKAGE_MANAGERS.bun;
  if (userAgent.startsWith('npm')) return PACKAGE_MANAGERS.npm;

  return PACKAGE_MANAGERS.npm;
}
export default detectPackageManager