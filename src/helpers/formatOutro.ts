import pc from "picocolors";
import { OutroConfig } from "../types.js";



export function buildOutroMessage(config: OutroConfig): string {
  const needsDbSetup =
    config.orm === "prisma" ||
    (config.orm === "drizzle" &&
      ["postgresql", "mysql", "sqlite"].includes(config.database));

  type Step = { cmd: string; notes?: string[] };
  const steps: Step[] = [{ cmd: `cd ${config.projectName}` }];

  if (needsDbSetup) {
    const setupScript =
      config.language === "js"
        ? "node scripts/setup.env.js"
        : "node scripts/setup.env.ts";

    steps.push({
      cmd: setupScript,
      notes: ["Add your DATABASE_URL to .env before continuing"],
    });

    steps.push(
      config.orm === "prisma"
        ? { cmd: "npm run build-schema" }
        : { cmd: "npm run db:generate" },
    );
    if (config.orm === "prisma") steps.push({ cmd: "npm run db:generate" });
    steps.push({ cmd: "npm run db:migrate" });
  } else if (config.orm === "mongoose") {
    steps.push({
      cmd: `# create .env`,
      notes: ["Add your MONGO_CONNECTION_STRING to .env before continuing"],
    });
  }

  steps.push({ cmd: "npm run dev" });

  const title = needsDbSetup
    ? pc.bold(pc.green("✔ Project created — a few steps left:"))
    : pc.bold(pc.green("✔ Project created — you're ready:"));

  const lines: string[] = [];
  steps.forEach(({ cmd, notes }, i) => {
    lines.push(`  ${pc.dim(`${i + 1}.`)} ${pc.cyan(cmd)}`);
    notes?.forEach((note) =>
      lines.push(`     ${pc.yellow("→")} ${pc.dim(note)}`),
    );
  });

  return [title, "", ...lines, "", pc.dim("Happy hacking! 🚀")].join("\n");
}
