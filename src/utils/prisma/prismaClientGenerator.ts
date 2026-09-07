import type { Language, SqlDatabase } from "../../types.js";
import mysqlClientFileContent from "./constants/mysql-client-content.js";
import postgresClientFileContent from "./constants/postgres-client-content.js";
import sqliteClientFileContent from "./constants/sqlite-client-content.js";

export function prismaClientGenerator(
  database: SqlDatabase,
  language: Language,
): string {
  switch (database) {
    case "postgresql":
      return postgresClientFileContent(language);
    case "mysql":
      return mysqlClientFileContent(language);
    case "sqlite":
      return sqliteClientFileContent(language);
      case "none":
        return "";
    default: {
      const exhaustiveCheck: never = database;
      throw new Error(
        `prismaFileGenerate: unsupported database "${exhaustiveCheck}"`,
      );
    }
  }
}
