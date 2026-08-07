import { Database, Language } from "../../../types.js";

export function subatomSchemaContent(database: Database, language: Language): string {
  switch (database) {
    case "postgresql":
      return `import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const subatom = pgTable('subatom', {
  id: uuid('id').defaultRandom().primaryKey(),
  application: varchar('application', { length: 255 }).notNull(),
  version: varchar('version', { length: 8 }).notNull().unique(),
  author: varchar('author', { length: 255 }).notNull(),
  framework: varchar('framework', { length: 255 }).notNull().default("Subatom"),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});
${language === "ts" ? "\nexport type TypeSubatom = typeof subatom.$inferSelect;" : ""}
`;

    case "mysql":
      return `import { mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const subatom = mysqlTable('subatom', {
  id: varchar('id', { length: 64 }).primaryKey(),
  application: varchar('application', { length: 255 }).notNull(),
  version: varchar('version', { length: 8 }).notNull().unique(),
  author: varchar('author', { length: 255 }).notNull(),
  framework: varchar('framework', { length: 255 }).notNull().default('Subatom'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

${language === "ts" ? "\nexport type TypeSubatom = typeof subatom.$inferSelect;" : ""}
            `;

    case "sqlite":
      return `import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const subatom = sqliteTable(
  'subatom',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    application: text('application').notNull(),
    version: text('version').notNull(),
    author: text('author').notNull(),
    framework: text('framework').notNull().default('Subatom'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql.raw('unixepoch()')),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql.raw('unixepoch()'))
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('subatom_application_idx').on(table.application),
    uniqueIndex('subatom_application_version_idx').on(table.application, table.version),
  ],
);

${language === "ts" ? "export type Subatom = typeof subatom.$inferSelect; \n export type NewSubatom = typeof subatom.$inferInsert;" : ""}`;

    default:
      throw new Error(`Unsupported database dialect: ${database}`);
  }
}