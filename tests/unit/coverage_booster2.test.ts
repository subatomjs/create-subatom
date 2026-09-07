/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect } from 'vitest';

describe('drizzle constants coverage booster', () => {
  it('drizzle-config-content supports different DBs', async () => {
    const drizzle = (await import('../../src/utils/drizzle/constants/drizzle-config-content.ts')).default;

    expect(drizzle('postgresql', 'ts')).toContain("dialect: 'postgresql'");
    expect(drizzle('mysql', 'ts')).toContain("dialect: 'mysql'");
    expect(drizzle('sqlite', 'ts')).toContain("dialect: 'sqlite'");
    expect(() => drizzle('mongodb' as any, 'ts')).toThrow();
  });

  it('env-requirements-content returns correct lines and handles redis flag', async () => {
    const envReq = (await import('../../src/utils/drizzle/constants/env-requirements-content.ts')).default;

    const p = envReq('postgresql', false as any);
    expect(p).toContain('DATABASE_URL');

    const p2 = envReq('mysql', true as any);
    expect(p2).toContain('REDIS_URL');
  });

  it('database-pool-content generates for many DBs', async () => {
    const mod = await import('../../src/utils/drizzle/constants/database-pool-content.ts');
    const DatabasePoolForDrizzle = mod.DatabasePoolForDrizzle;

    const pg = new DatabasePoolForDrizzle('ts', 'postgresql');
    expect(pg.generateCode()).toContain('drizzle-orm');

    const my = new DatabasePoolForDrizzle('ts', 'mysql');
    expect(my.generateCode()).toContain("mysql.createPool");

    const sqlite = new DatabasePoolForDrizzle('ts', 'sqlite');
    expect(sqlite.generateCode()).toContain('createClient');
  });
});
