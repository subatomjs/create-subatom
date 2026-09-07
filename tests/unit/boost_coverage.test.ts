/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect } from 'vitest';

import {
  dotEnvFileContent,
  mainFileContent,
  subatomConfigContent,
  envConfigContentRelationalDb,
  serverFileContent,
} from '../../src/utils/common_content.ts';

import mysqlClientFileContent from '../../src/utils/prisma/constants/mysql-client-content.ts';
import postgresClientFileContent from '../../src/utils/prisma/constants/postgres-client-content.ts';
import sqliteClientFileContent from '../../src/utils/prisma/constants/sqlite-client-content.ts';
import schemaPrismaContent from '../../src/utils/prisma/constants/schema-prisma-content.ts';
import subatomPrismaSchema from '../../src/utils/prisma/constants/subatom-schema-content.ts';
import prismaConfigFileContent from '../../src/utils/prisma/constants/prisma-config-content.ts';
import { prismaClientGenerator } from '../../src/utils/prisma/prismaClientGenerator.ts';

import drizzleEnvReq from '../../src/utils/drizzle/constants/env-requirements-content.ts';
import { subatomSchemaContent as drizzleSubatomSchema } from '../../src/utils/drizzle/constants/subatom-schema-content.ts';
import drizzleConfigContent from '../../src/utils/drizzle/constants/drizzle-config-content.ts';
import adjustScriptExtensions from '../../src/helpers/packages/package-json/adjustScriptExtensions.ts';
import { DatabasePoolForDrizzle as dbPoolContent } from '../../src/utils/drizzle/constants/database-pool-content.ts';
import { drizzleMigrationScript } from '../../src/utils/drizzle/constants/mysql/drizzle-migration-script.ts';
import dbReset from '../../src/utils/drizzle/constants/mysql/database-reset-script.ts';
import dbUrlFile from '../../src/utils/drizzle/constants/mysql/dburl-file-content.ts';
import sqliteSeed from '../../src/utils/drizzle/constants/sqlite/sqlite-seed-content.ts';
import redisEnvConfig from '../../src/utils/redis/constants/redis-env-config.ts';

import mongooseSchema from '../../src/utils/mongo/constants/mongoose-schema-content.ts';
import mongoEnv from '../../src/utils/mongo/constants/mongo-env-conf-content.ts';
import mongoConn from '../../src/utils/mongo/constants/mongodb-connection-script.ts';

import redisClient from '../../src/utils/redis/constants/redis-client-content.ts';
import redisConfig from '../../src/utils/redis/constants/redis-config-content.ts';
import redisErrors from '../../src/utils/redis/constants/redis-error-content.ts';
import redisIndex from '../../src/utils/redis/constants/redis-index-content.ts';
import redisBootstrap from '../../src/utils/redis/constants/redis-bootstrap-content.ts';
import redisTypes from '../../src/utils/redis/constants/redis-types-content.ts';

import { TS_ESLINT_CONFIG, JS_ESLINT_CONFIG } from '../../src/utils/eslint/eslint-config-content.ts';

describe('Boost coverage by calling content generators', () => {
  it('common_content functions produce strings', () => {
    const d = dotEnvFileContent();
    expect(typeof d).toBe('string');

    const s1 = subatomConfigContent('js');
    const s2 = subatomConfigContent('ts');
    expect(s1).toContain('defineConfig');
    expect(s2).toContain('sourcemap');

    const m1 = mainFileContent('postgresql', 'prisma', 'ts', false, false);
    const m2 = mainFileContent('mongodb', 'mongoose', 'js', true, true);
    expect(m1).toContain('prisma');
    expect(m2).toContain('connectDB');

    const e1 = envConfigContentRelationalDb('ts', 'sqlite', 'drizzle', true);
    const e2 = envConfigContentRelationalDb('js', 'postgresql', 'prisma', false);
    expect(e1).toContain('DB');
    expect(e2).toContain('DATABASE_URL');

    for (const language of ['js', 'ts'] as const) {
      for (const database of ['postgresql', 'mysql', 'sqlite'] as const) {
        for (const orm of ['prisma', 'drizzle'] as const) {
          for (const useRedis of [false, true]) {
            for (const useSocket of [false, true]) {
              expect(mainFileContent(database, orm, language, useRedis, useSocket)).toContain('server');
            }
            expect(envConfigContentRelationalDb(language, database, orm, useRedis)).toContain('DATABASE_URL');
          }
        }
      }
      expect(mainFileContent('mongodb', 'mongoose', language, false, false)).toContain('mongo');
      expect(mainFileContent('none', 'none', language, false, false)).toContain('server');
      expect(mainFileContent('none', 'none', language, true, false)).toContain('Redis');
    }
    expect(serverFileContent(true, 'js')).toContain('serveStatic');
  });

  it('prisma client files and generator', () => {
    const a = mysqlClientFileContent('js');
    const b = mysqlClientFileContent('ts');
    expect(a).toContain('PrismaClient');
    expect(b).toContain('PrismaMariaDb');

    const p1 = postgresClientFileContent('js');
    const p2 = postgresClientFileContent('ts');
    expect(p1).toContain('PrismaClient');
    expect(p2).toContain('PrismaClient');

    const s = sqliteClientFileContent('ts');
    expect(s).toContain('PrismaClient');
    expect(sqliteClientFileContent('js')).toContain('createRequire');

    for (const database of ['postgresql', 'mysql', 'sqlite'] as const) {
      for (const language of ['js', 'ts'] as const) {
        expect(schemaPrismaContent(database, language)).toContain('generator');
      }
    }

    const sub = subatomPrismaSchema();
    expect(sub.length).toBeGreaterThan(0);

    const cfg = prismaConfigFileContent();
    expect(cfg).toContain('defineConfig');

    expect(prismaClientGenerator('postgresql', 'ts')).toContain('PrismaClient');
    expect(prismaClientGenerator('mysql', 'js')).toContain('PrismaClient');
    expect(prismaClientGenerator('sqlite', 'ts')).toContain('PrismaClient');
    expect(prismaClientGenerator('none' as any, 'js')).toBe('');

    // default throws
    // @ts-expect-error
    expect(() => prismaClientGenerator('unsupported', 'ts')).toThrow();
  });

  it('drizzle constants return content', () => {
    expect(typeof drizzleEnvReq).toBe('function');
    for (const database of ['postgresql', 'mysql', 'sqlite'] as const) {
      for (const language of ['js', 'ts'] as const) {
        expect(drizzleEnvReq(database, false)).toContain('DATABASE_URL');
        expect(drizzleEnvReq(database, true)).toContain('DATABASE_URL');
        expect(typeof drizzleSubatomSchema(database, language)).toBe('string');
        expect(typeof drizzleConfigContent(database, language)).toBe('string');
        const pool = new dbPoolContent(language, database);
        expect(typeof pool.generateCode()).toBe('string');
        expect(typeof dbReset(language)).toBe('string');
        expect(typeof dbUrlFile(language)).toBe('string');
      }
    }
    expect(typeof drizzleMigrationScript()).toBe('string');
    expect(typeof sqliteSeed()).toBe('string');
    expect(drizzleEnvReq('none' as any, false)).toBe('');
    expect(() => drizzleEnvReq('unsupported' as any, false)).toThrow();
    expect(() => new dbPoolContent('ts', 'unsupported' as any).generateCode()).toThrow();
  });

  it('mongo and mongoose constants', () => {
    for (const language of ['js', 'ts'] as const) {
      expect(typeof mongooseSchema(language)).toBe('string');
      expect(typeof mongoEnv(language, false)).toBe('string');
      expect(typeof mongoEnv(language, true)).toBe('string');
      expect(typeof mongoConn(language)).toBe('string');
    }
  });

  it('redis constants and eslint', () => {
    for (const language of ['js', 'ts'] as const) {
      expect(typeof redisClient(language)).toBe('string');
      expect(typeof redisConfig(language)).toBe('string');
      expect(typeof redisErrors(language)).toBe('string');
      expect(typeof redisIndex(language)).toBe('string');
      expect(typeof redisBootstrap(language)).toBe('string');
      expect(typeof redisEnvConfig(language)).toBe('string');
    }
    expect(typeof redisTypes).toBe('string');

    expect(typeof TS_ESLINT_CONFIG).toBe('string');
    expect(typeof JS_ESLINT_CONFIG).toBe('string');
    expect(adjustScriptExtensions({ build: 'tsc', start: 'node app.ts' }, 'invalid' as any)).toEqual({
      build: 'tsc',
      start: 'node app.ts',
    });
  });
});
