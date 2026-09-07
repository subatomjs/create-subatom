import type { Database, Language, SqlDatabase } from "../../../types.js";

function schemaFileContent(
  database: SqlDatabase | Database,
  language: Language,
): string {
  if (
    language === "js" &&
    (database === "postgresql" || database === "mysql" || database === "sqlite")
  ) {
    return `generator client {
  provider = "prisma-client-js"
  }

datasource db {
  provider = "${database}"
  }`;
  } else {
    return `datasource db {
  provider = "${database}"
}

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}`;
  }
}

export default schemaFileContent