import { text, select, confirm, isCancel, cancel } from "@clack/prompts";
import type { ProjectConfig, Database, Orm, Language } from "./types.js";

export async function runPrompts(
  cliProjectName?: string,
): Promise<ProjectConfig> {
  const projectName = cliProjectName ?? (await promptProjectName());

  // 1. Language
  const language = await select<Language>({
    message: "Select a language:",
    options: [
      { value: "ts", label: "TypeScript" },
      { value: "js", label: "JavaScript" },
    ],
  });
  exitOnCancel(language);

  // 2. ORM
  const orm = await select<Orm>({
    message: "Select an ORM:",
    options: [
      { value: "prisma", label: "Prisma" },
      { value: "drizzle", label: "Drizzle" },
      { value: "mongoose", label: "Mongoose" },
      { value: "none", label: "None" },
    ],
  });
  exitOnCancel(orm);

  // 3. Database (Derived or Conditional)
  let database: Database = "none";

  if (orm === "mongoose") {
    // Mongoose strictly requires MongoDB
    database = "mongodb";
  } else if (orm === "prisma" || orm === "drizzle") {
    // SQL ORMs require a relational database
    const selectedDatabase = await select<Exclude<Database, "none" | "mongodb">>({
      message: "Select a database:",
      options: [
        { value: "postgresql", label: "PostgreSQL" },
        { value: "mysql", label: "MySQL" },
        { value: "sqlite", label: "SQLite" },
      ],
    });
    exitOnCancel(selectedDatabase);
    database = selectedDatabase;
  } else {
    // orm === "none": Ask if they want a raw driver or no database at all
    const selectedDatabase = await select<Database>({
      message: "Select a database (or skip):",
      options: [
        { value: "postgresql", label: "PostgreSQL" },
        { value: "mysql", label: "MySQL" },
        { value: "sqlite", label: "SQLite" },
        { value: "mongodb", label: "MongoDB" },
        { value: "none", label: "None (Skip database setup)" },
      ],
    });
    exitOnCancel(selectedDatabase);
    database = selectedDatabase;
  }

  // 4. Redis
  const useRedis = await confirm({
    message: "Would you like to configure Redis?",
    initialValue: false,
  });
  exitOnCancel(useRedis);

  // 5. ESLint
  const useEslint = await confirm({
    message: "Would you like to setup ESLint?",
    initialValue: true,
  });
  exitOnCancel(useEslint);

  // 6. Vitest
  const useVitest = await confirm({
    message: "Would you like to add Vitest?",
    initialValue: false,
  });
  exitOnCancel(useVitest);

  // 7. WebSocket (Added missing exit check)
  const useSocket = await confirm({
    message: "Does your project need a WebSocket connection?",
    initialValue: false,
  });
  exitOnCancel(useSocket);

  return {
    projectName,
    language,
    database,
    orm,
    useRedis,
    useEslint,
    useVitest,
    useSocket,
  };
}

async function promptProjectName(): Promise<string> {
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
  return name;
}

function exitOnCancel<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}