/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect } from 'vitest';
import { subatomSchemaContent } from '../../src/utils/drizzle/constants/subatom-schema-content.ts';
import drizzleConfigFileContent from '../../src/utils/drizzle/constants/drizzle-config-content.ts';

describe('drizzle constants', () => {
  it('subatomSchemaContent throws for unsupported db', () => {
    expect(() => subatomSchemaContent('mongodb' as any, 'ts')).toThrow();
  });

  it('drizzleConfigFileContent throws for mongodb', () => {
    expect(() => drizzleConfigFileContent('mongodb' as any, 'ts')).toThrow();
  });
});
