import { text, select, confirm, isCancel, cancel } from "@clack/prompts";
import type { ProjectConfig, Database, Orm, Language } from "./types.js";
import pc from "picocolors";

export async function runPrompts(
  cliProjectName?: string,
): Promise<ProjectConfig> {
  const projectName = cliProjectName ?? (await promptProjectName());

  // 1. Language
  const language = (await select<Language>({
    message: pc.bold("Select a language:"),
    options: [
      {
        value: "ts",
        label: `${pc.blue("TypeScript")} ${pc.dim("(strongly typed, recommended)")}`,
      },
      {
        value: "js",
        label: `${pc.yellow("JavaScript")} ${pc.dim("(standard modern JS)")}`,
      },
    ],
  })) as Language | symbol;
  exitOnCancel(language);

  // 2. ORM
  const orm = (await select<Orm>({
    message: pc.bold("Select an ORM:"),
    options: [
      {
        value: "prisma",
        label: `${pc.cyan("Prisma")} ${pc.dim("(declarative, auto-generated client)")}`,
      },
      {
        value: "drizzle",
        label: `${pc.green("Drizzle")} ${pc.dim("(lightweight, SQL-like syntax)")}`,
      },
      {
        value: "mongoose",
        label: `${pc.red("Mongoose")} ${pc.dim("(ODM for MongoDB)")}`,
      },
      {
        value: "none",
        label: pc.dim("None (Skip ORM setup)"),
      },
    ],
  })) as Orm | symbol;
  exitOnCancel(orm);

  // 3. Database (Derived or Conditional)
  let database: Database = "none";

  if (orm === "mongoose") {
    // Mongoose strictly requires MongoDB
    database = "mongodb";
  } else if (orm === "prisma" || orm === "drizzle") {
    // SQL ORMs require a relational database
    const selectedDatabase = await select<
      Exclude<Database, "none" | "mongodb">
    >({
      message: pc.bold("Select a database:"),
      options: [
        {
          value: "postgresql",
          label: `${pc.blue("PostgreSQL")} ${pc.dim("(Relational)")}`,
        },
        {
          value: "mysql",
          label: `${pc.yellow("MySQL")} ${pc.dim("(Relational)")}`,
        },
        {
          value: "sqlite",
          label: `${pc.cyan("SQLite")} ${pc.dim("(Embedded / Local file)")}`,
        },
      ],
    });
    exitOnCancel(selectedDatabase);
    database = selectedDatabase as Exclude<Database, "none" | "mongodb">;
  } else {
    // orm === "none": Ask if they want a raw driver or no database at all
    const selectedDatabase = await select<Database>({
      message: pc.bold("Select a database (or skip):"),
      options: [
        {
          value: "postgresql",
          label: `${pc.blue("PostgreSQL")} ${pc.dim("(Relational)")}`,
        },
        {
          value: "mysql",
          label: `${pc.yellow("MySQL")} ${pc.dim("(Relational)")}`,
        },
        {
          value: "sqlite",
          label: `${pc.cyan("SQLite")} ${pc.dim("(Embedded)")}`,
        },
        {
          value: "mongodb",
          label: `${pc.green("MongoDB")} ${pc.dim("(Document)")}`,
        },
        {
          value: "none",
          label: pc.dim("None (Skip database setup)"),
        },
      ],
    });
    exitOnCancel(selectedDatabase);
    database = selectedDatabase as Exclude<Database, "none" | "mongodb">;
  }

  // 4. Redis
  const useRedis = await confirm({
    message: `${pc.bold("Would you like to configure")} ${pc.red("Redis")}?`,
    initialValue: false,
  });
  exitOnCancel(useRedis);

  // 5. ESLint
  const useEslint = await confirm({
    message: `${pc.bold("Would you like to setup")} ${pc.magenta("ESLint")}?`,
    initialValue: true,
  });
  exitOnCancel(useEslint);

  // 6. Vitest
  const useVitest = await confirm({
    message: `${pc.bold("Would you like to add")} ${pc.yellow("Vitest")}?`,
    initialValue: false,
  });
  exitOnCancel(useVitest);

  // 7. WebSocket (Added missing exit check)
  const useSocket = await confirm({
    message: `${pc.bold("Does your project need a")} ${pc.cyan("WebSocket")} ${pc.bold("connection?")}`,
    initialValue: true,
  });
  exitOnCancel(useSocket);

  return {
    projectName,
    language,
    database,
    orm,
    useRedis: useRedis as boolean,
    useEslint: useEslint as boolean,
    useVitest: useVitest as boolean,
    useSocket: useSocket as boolean,
  };
}

async function promptProjectName(): Promise<string> {
  const name = await text({
    message: pc.bold("Project name:"),
    placeholder: "my-app", // <-- Keep this plain text
    validate: (value) => {
      if (!value || value.trim().length === 0)
        return pc.red("Project name is required");
      if (/[^a-zA-Z0-9-_.]/.test(value)) {
        return pc.red(
          "Only letters, numbers, dashes, underscores, and dots allowed",
        );
      }
      return undefined;
    },
  });
  exitOnCancel(name);
  return name as string;
}

function exitOnCancel<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel(pc.red("Operation cancelled."));
    process.exit(0);
  }
}
