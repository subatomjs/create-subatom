import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import pc from 'picocolors';

/**
 * Initializes a git repository inside the newly created project.
 * Fails silently (with a warning) if git isn't installed or init fails —
 * this should never block the overall scaffolding process.
 */
export async function gitInit(targetDir: string): Promise<void> {
  // Skip if the target is already inside a git repo
  const alreadyGitRepo = await isInsideGitRepo(targetDir);
  if (alreadyGitRepo) {
    return;
  }

  // Skip if git isn't installed at all
  const hasGit = await isGitAvailable();
  if (!hasGit) {
    console.log(pc.yellow('Git not found — skipping git initialization.'));
    return;
  }

  try {
    await execa('git', ['init'], { cwd: targetDir });

    await ensureGitignore(targetDir);

    await execa('git', ['add', '-A'], { cwd: targetDir });

    await execa(
      'git',
      ['commit', '-m', 'chore: initial commit from create-subatom'],
      {
        cwd: targetDir,
        env: {
          // Prevents failure on machines with no global git user configured
          GIT_AUTHOR_NAME: 'create-subatom',
          GIT_AUTHOR_EMAIL: 'create-subatom@local',
          GIT_COMMITTER_NAME: 'create-subatom',
          GIT_COMMITTER_EMAIL: 'create-subatom@local',
        },
      }
    );
  } catch {
    // Non-fatal — the project still works without a git repo
    console.log(pc.yellow('Could not initialize git — you can run "git init" manually.'));
  }
}

async function isGitAvailable(): Promise<boolean> {
  try {
    await execa('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function isInsideGitRepo(targetDir: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: targetDir });
    return true;
  } catch {
    return false;
  }
}

async function ensureGitignore(targetDir: string): Promise<void> {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const exists = await fs.pathExists(gitignorePath);

  if (!exists) {
    const defaultIgnore = `${['node_modules', 'dist', '.env', '.env.local', '*.log'].join('\n')}\n`;
    await fs.writeFile(gitignorePath, defaultIgnore, 'utf-8');
  }
}