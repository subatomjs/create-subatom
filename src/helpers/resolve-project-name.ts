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

/**
 * If the user passed "." (npm create subatom@latest .), resolve the
 * project name to the current directory's name and validate it.
 * Any other arg (or no arg) is passed through untouched.
 */
export function resolveProjectNameArg(rawArg?: string): string | undefined {
  if (rawArg !== ".") return rawArg;

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

  return dirName;
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-._~]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return slug || "my-app";
}