import type { Database } from "../../../types.js";

const REDIS_VARIABLES = [
  "REDIS_URL=redis://127.0.0.1:6379/",
  "REDIS_KEY_PREFIX=subatom_app:",
  "REDIS_REQUIRED=false",
  "REDIS_CONNECT_TIMEOUT_MS=10000",
  "REDIS_SHUTDOWN_TIMEOUT_MS=5000",
  "REDIS_DEBUG=false",
];

function envRequirementFileContent(
  database: Database,
  useRedis: boolean = false,
): string {
  const dbVarName =
    database === "mongodb" ? "MONGO_CONNECTION_STRING" : "DATABASE_URL";
  const dbLocalConnString =
    database === "mongodb"
      ? "mongodb://localhost:27017/my_database"
      : database === "mysql"
        ? "mysql://root:root@localhost:3306/my_database"
        : database === "sqlite"
          ? "file:./database/local.db"
          : database === "postgresql"
            ? "postgresql://postgres:postgres@localhost:5432/my_database"
            : "";

  const baseConfig = [
    `${dbVarName}=${dbLocalConnString}`,
    'NODE_ENV="development"',
    "PORT=8080",
    "HOST='localhost'",
  ];

  switch (database) {
    case "mongodb":
    case "mysql":
    case "postgresql":
    case "sqlite": {
      const config = useRedis
        ? [...baseConfig, ...REDIS_VARIABLES]
        : baseConfig;
      return `${config.join("\n")}\n`;
    }
    case "none":
      return ""
    default: {
      const _exhaustiveCheck: never = database;
      throw new Error(`Unsupported database type: ${_exhaustiveCheck}`);
    }
  }
}

export default envRequirementFileContent;
