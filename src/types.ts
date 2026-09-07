/**
 * Shared types used across the create-subatom CLI.
 * Every helper (prompts, copy-template, merge-package-json, install-deps,
 * git-init) should import from here instead of redefining these shapes.
 */

export type Language = 'ts' | 'js';

export type Orm = 'prisma' | 'drizzle' | 'mongoose' | 'none';

export type Database = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'none';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export enum CliExitCode {
  Success = 0,
  InvalidProjectName = 1,
  InitializationFailed = 2,
}

export type SqlDatabase = Exclude<Database, "mongodb">;

/**
 * The full set of answers collected from the user during the prompt flow.
 * This is the single object passed into every downstream step:
 * copyTemplate(config, ...) -> mergePackageJson(config, ...) -> installDeps(...) -> gitInit(...)
 */
export interface ProjectConfig {
  projectName: string;
  language: Language;
  orm: Orm;
  database: Database;
  useRedis: boolean;
  useEslint: boolean;
  useVitest: boolean;
  useSocket: boolean;
}

/**
 * Shape of a package.snippet.json fragment shipped inside each template
 * piece (templates/orm/prisma/package.snippet.json, templates/redis/..., etc).
 * These get deep-merged into the final generated package.json.
 */
export interface PackageJsonSnippet {
  name?: string;
  version?: string;
  description?: string;
  type?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Info returned by detect-package-manager.ts, describing how to run
 * install/scripts correctly for whichever package manager launched the CLI.
 */
export interface PackageManagerInfo {
  name: PackageManager;
  installCommand: string[];
  runCommand: (script: string) => string[];
}

export interface OutroConfig {
  projectName: string;
  language: "js" | "ts";
  orm: Orm;
  database: string;
}