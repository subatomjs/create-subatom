import pc from "picocolors";

interface OutroConfig {
  projectName: string;
  language: "js" | "ts";
  orm: string;
  database: string;
}

export function buildOutroMessage(config: OutroConfig): string {
  const needsDbSetup =
    config.orm === "prisma" &&
    ["postgresql", "mysql", "sqlite"].includes(config.database);

  const commands: string[] = [`cd ${config.projectName}`];
  const notes: string[] = [];

  if (needsDbSetup) {
    const setupScript =
      config.language === "js" ? "node scripts/setup.env.js" : "node scripts/setup.env.ts";
    commands.push(setupScript);
    notes.push("Add your DATABASE_URL to .env before continuing");
    commands.push("npm run build-schema", "npm run db:generate", "npm run db:migrate");
  }

  commands.push("npm run dev");

  const title = needsDbSetup
    ? pc.bold(pc.green("✔ Project created — a few steps left:"))
    : pc.bold(pc.green("✔ Project created — you're ready:"));

  let stepNum = 1;
  const lines: string[] = [];
  for (const cmd of commands) {
    lines.push(`  ${pc.dim(`${stepNum}.`)} ${pc.cyan(cmd)}`);
    if (cmd.includes("setup.env")) {
      for (const note of notes) lines.push(`     ${pc.yellow("→")} ${pc.dim(note)}`);
    }
    stepNum++;
  }

  return [title, "", ...lines, "", pc.dim("Happy hacking! 🚀")].join("\n");
}