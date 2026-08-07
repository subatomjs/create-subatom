import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import * as resolve from '../../src/helpers/resolveProjectName.ts';

describe('resolveProjectNameArg', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    // ensure stable cwd
    process.chdir(path.join(cwd));
  });

  afterEach(() => {
    process.chdir(cwd);
  });

  it('returns provided name when not dot', () => {
    expect(resolve.resolveProjectNameArg('my-app')).toEqual({ name: 'my-app', useCurrentDir: false });
  });

  it('throws InvalidProjectNameError for bad current directory name', () => {
    // simulate by temporarily mocking process.cwd
    const originalCwd = process.cwd;
    // @ts-ignore
    process.cwd = () => '/some/Bad Name!';
    try {
      expect(() => resolve.resolveProjectNameArg('.')).toThrow(resolve.InvalidProjectNameError);
    } finally {
      // @ts-ignore
      process.cwd = originalCwd;
    }
  });
});
