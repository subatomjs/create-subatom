import path from "node:path";

export class InvalidProjectNameError extends Error {
  constructor(message: string, override readonly cause: string) {
    super(message);
    this.name = "InvalidProjectNameError";
  }
}

const HAS_WHITESPACE = /\s/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_ILLEGAL_CHARS = /[~'!()*]/;
const VALID_NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export interface ResolvedProjectName {
  /** Suggested/validated name — used as the prompt default and package.json name. */
  name: string | undefined;
  /** true if the user passed "." — install into cwd, don't create a subfolder. */
  useCurrentDir: boolean;
}

/**
 * If the user passed "." (npm create subatom@latest .), validate that the
 * CURRENT directory's name would make a legal npm package name, and signal
 * that scaffolding should happen in place (no new subfolder).
 * Any other arg (or no arg) is passed through untouched.
 */
export function resolveProjectNameArg(rawArg?: string): ResolvedProjectName {
  if (rawArg !== ".") return { name: rawArg, useCurrentDir: false };

  const dirName = path.basename(process.cwd());
  const problems: string[] = [];

  if (HAS_WHITESPACE.test(dirName)) problems.push("contains whitespace");
  if (HAS_UPPERCASE.test(dirName)) problems.push("contains uppercase letters");
  if (HAS_ILLEGAL_CHARS.test(dirName)) problems.push("contains characters npm disallows (~'!()*)");
  if (dirName.startsWith(".") || dirName.startsWith("_")) problems.push("starts with '.' or '_'");
  if (problems.length === 0 && !VALID_NPM_NAME.test(dirName)) {
    problems.push("doesn't match a valid npm package name pattern");
  }

  if (problems.length > 0) {
    throw new InvalidProjectNameError(
      `Can't use the current directory name "${dirName}" as your project name.`,
      `"${dirName}" ${problems.join(", ")}.\n` +
        `Rename the folder, or run with an explicit name instead:\n` +
        `  npm create subatom@latest ${slugify(dirName)}`,
    );
  }

  return { name: dirName, useCurrentDir: true };
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-._~]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return slug || "my-app";
}