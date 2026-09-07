import type { Language } from "../../../../types.js";

function databaseResetScript(language: Language) {
  return String.raw`import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, closeDb, poolConnection } from './db_pool.js';

async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to reset the database when NODE_ENV=production.');
    process.exit(1);
  }

  try {
    console.log('Dropping all tables in the current schema...');
    const [rows] = await poolConnection.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()'
    );

    await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 0'));
    for (const row of rows ${language === "ts" ? "as Array<{ name: string }>" : ""}) {
      await db.execute(sql.raw('DROP TABLE IF EXISTS \x60' + row.name + '\x60'));
      console.log('  dropped ' + row.name);
    }
    await db.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 1'));

    console.log('Re-running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });

    console.log('Database reset complete.');
  } catch (error) {
    console.error('Reset failed:', error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

resetDatabase();
`;
}

export default databaseResetScript