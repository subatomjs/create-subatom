import { text, select, confirm, isCancel, cancel } from "@clack/prompts";
import type { ProjectConfig, Database } from "./types.js";

/**
 * Runs the full interactive prompt flow and returns a typed config object.
 *
 * cliProjectName: if the user already typed a name as a CLI arg
 * (e.g. `npm create subatom@latest my-app`), pass it in here so we
 * skip asking for it again.
 */
export async function runPrompts(
  cliProjectName?: string,
): Promise<ProjectConfig> {
  const projectName = cliProjectName ?? (await promptProjectName());

  //! 1. Option: What language would you like to use? (TypeScript or JavaScript) 
  const language = await select({
    message: "Select a language:",
    options: [
      { value: "ts", label: "TypeScript" },
      { value: "js", label: "JavaScript" },
    ],
  });
  exitOnCancel(language);

  //! 2. Option: What ORM would you like to use? (Prisma, Drizzle, Mongoose)
  const orm = await select({
    message: "Select an ORM:",
    options: [
      { value: "prisma", label: "Prisma" },
      { value: "drizzle", label: "Drizzle" },
      { value: "mongoose", label: "Mongoose" },
    ],
  });
  exitOnCancel(orm);


  //! 3. Option: What database would you like to use? (PostgreSQL, MySQL, SQLite, MongoDB)
  let database: Database;

  if (orm === "mongoose") {
    database = "mongodb";
  } else {
    const selectedDatabase = await select({
      message: "Select a database:",
      options: [
        { value: "postgresql", label: "PostgreSQL" },
        { value: "mysql", label: "MySQL" },
        { value: "sqlite", label: "SQLite" },
      ],
    });
    exitOnCancel(selectedDatabase);
    database = selectedDatabase as Database;
  }
  
  //! 4. Option: Would you like to configure Redis?
  const useRedis = await confirm({
    message: "Would you like to configure Redis?",
    initialValue: false,
  });
  exitOnCancel(useRedis);

  //! 5. Option: Would you like to setup ESLint?
  const useEslint = await confirm({
    message: "Would you like to setup ESLint?",
    initialValue: true,
  });
  exitOnCancel(useEslint);


  //! 6. Option: Would you like to setup Vitest?
  const useVitest = await confirm({
    message: "Would you like to add Vitest?",
    initialValue: false,
  });
  exitOnCancel(useVitest);

  return {
    projectName,
    language: language as ProjectConfig["language"],
    database,
    orm: orm as ProjectConfig["orm"],
    useRedis: useRedis as boolean,
    useEslint: useEslint as boolean,
    useVitest: useVitest as boolean,
  };
}



async function promptProjectName(): Promise<string> {
  //! 1. Enter project name (e.g. my-app, my_project, my.project)
  const name = await text({
    message: "Project name:",
    placeholder: "my-app",
    validate: (value) => {
      if (!value || value.trim().length === 0)
        return "Project name is required";
      if (/[^a-zA-Z0-9-_.]/.test(value)) {
        return "Only letters, numbers, dashes, underscores, and dots allowed";
      }
      return undefined;
    },
  });
  exitOnCancel(name);
  return name as string;
}

/**
 * @clack/prompts returns a special "cancel" symbol when the user presses
 * Ctrl+C mid-prompt. This checks for that and exits cleanly instead of
 * letting `undefined`/symbols silently flow into the rest of the CLI.
 */
function exitOnCancel<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}
