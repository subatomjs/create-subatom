function sqliteSeedFileContent() {
  return `import { db, closeDatabase } from './db_pool.js';
import { subatom } from './schema.js';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  await db
    .insert(subatom)
    .values([
      {
        application: 'Core Payment Gateway',
        version: 'v1.0.0',
        author: 'DevOps Team',
        framework: 'Subatom Enterprise',
      },
      {
        application: 'Auth Service',
        version: 'v2.1.0',
        author: 'Security Team',
      },
    ])
    .onConflictDoUpdate({
      target: [subatom.application, subatom.version],
      set: { author: sql.raw('excluded.author'), framework: sql.raw('excluded.framework') },
    });

  console.log('✅ Seeding completed successfully.');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });`;
}

export default sqliteSeedFileContent