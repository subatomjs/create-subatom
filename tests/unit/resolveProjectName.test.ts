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
    // @ts-expect-error
    process.cwd = () => '/some/Bad Name!';
    try {
      expect(() => resolve.resolveProjectNameArg('.')).toThrow(resolve.InvalidProjectNameError);
    } finally {
      // @ts-expect-error
      process.cwd = originalCwd;
    }
  });

  it('uses the current directory for a valid name', () => {
    const originalCwd = process.cwd;
    // @ts-expect-error
    process.cwd = () => '/tmp/my-app';
    try {
      expect(resolve.resolveProjectNameArg('.')).toEqual({ name: 'my-app', useCurrentDir: true });
    } finally {
      // @ts-expect-error
      process.cwd = originalCwd;
    }
  });

  it('falls back to my-app when slugifying an invalid-only name', () => {
    const originalCwd = process.cwd;
    // @ts-expect-error
    process.cwd = () => '/!!!';
    try {
      try {
        resolve.resolveProjectNameArg('.');
        throw new Error('expected invalid name');
      } catch (error) {
        expect((error as resolve.InvalidProjectNameError).cause).toContain('my-app');
      }
    } finally {
      // @ts-expect-error
      process.cwd = originalCwd;
    }
  });

  it('rejects names beginning with an underscore', () => {
    const originalCwd = process.cwd;
    // @ts-expect-error
    process.cwd = () => '/tmp/_private';
    try {
      try {
        resolve.resolveProjectNameArg('.');
        throw new Error('expected invalid name');
      } catch (error) {
        expect((error as resolve.InvalidProjectNameError).cause).toContain("starts with '.' or '_'");
      }
    } finally {
      // @ts-expect-error
      process.cwd = originalCwd;
    }
  });

  it('rejects a name that fails the npm pattern without other violations', () => {
    const originalCwd = process.cwd;
    // @ts-expect-error
    process.cwd = () => '/tmp/@';
    try {
      expect(() => resolve.resolveProjectNameArg('.')).toThrow(resolve.InvalidProjectNameError);
    } finally {
      // @ts-expect-error
      process.cwd = originalCwd;
    }
  });
});
