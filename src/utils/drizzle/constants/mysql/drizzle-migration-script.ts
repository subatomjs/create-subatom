export function drizzleMigrationScript() {
  return `import { migrate } from 'drizzle-orm/mysql2/migrator';
import { closeDb, db,  } from './db_pool.js';

async function runMigrations() {
  const env = process.env.NODE_ENV ?? 'development';
  console.log("Running migrations:", env);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    // Without this, the pool's open sockets can keep the process alive
    // or mask the real exit code in some CI/hosting environments.
    await closeDb();
  }
}

runMigrations();
    `;
}