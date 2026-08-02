/**
 * Detects which package manager the user invoked the CLI with.
 *
 * npm, pnpm, yarn, and bun all set the npm_config_user_agent env var
 * when running any "npm create <x>" / "pnpm create <x>" / etc. command,
 * so we can read it directly instead of guessing from lockfiles
 * (there's no existing project yet — we're creating one).
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface PackageManagerInfo {
  name: PackageManager;
  /** The command to run installs, e.g. "npm install" */
  installCommand: string[];
  /** The command prefix used to run scripts, e.g. "npm run dev" vs "pnpm dev" */
  runCommand: (script: string) => string[];
}

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

/**
 * Reads npm_config_user_agent (set by npm, pnpm, yarn, and bun) to figure
 * out which package manager launched this CLI. Falls back to "npm" if the
 * env var is missing or unrecognized (e.g. the CLI was run directly via node).
 */
export function detectPackageManager(): PackageManagerInfo {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return PACKAGE_MANAGERS.pnpm;
  if (userAgent.startsWith('yarn')) return PACKAGE_MANAGERS.yarn;
  if (userAgent.startsWith('bun')) return PACKAGE_MANAGERS.bun;
  if (userAgent.startsWith('npm')) return PACKAGE_MANAGERS.npm;

  return PACKAGE_MANAGERS.npm;
}