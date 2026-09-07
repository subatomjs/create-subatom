/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect } from 'vitest';
import {
  dotEnvFileContent,
  mainFileContent,
  subatomConfigContent,
  envConfigContentRelationalDb,
} from '../../src/utils/common_content.ts';

describe('common_content', () => {
  it('dotEnvFileContent contains copy logic', () => {
    const s = dotEnvFileContent();
    expect(s).toContain('copyFileSync');
  });

  it('mainFileContent returns warning for mongoose wrong db', () => {
    const s = mainFileContent('postgresql' as any, 'mongoose' as any, 'ts', false, false);
    expect(s).toContain('Mongoose only supports MongoDB');
  });

  it('subatomConfigContent returns TS config', () => {
    expect(subatomConfigContent('ts')).toContain('sourcemap: true');
  });

  it('envConfigContentRelationalDb returns a string when invoked', () => {
    const res = envConfigContentRelationalDb('ts' as any, 'postgresql' as any, 'drizzle' as any, false);
    expect(typeof res).toBe('string');
  });
});
