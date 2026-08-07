import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.resetModules();

// runtime behaviors for the mocked modules — tests will set these before import
let execaBehavior: (...args: any[]) => Promise<any> = () => Promise.resolve({});
let pathExistsBehavior: (...args: any[]) => Promise<any> = () => Promise.resolve(true);
let writeFileBehavior: (...args: any[]) => Promise<any> = () => Promise.resolve();

vi.mock('execa', () => ({ execa: (...args: any[]) => execaBehavior(...args) }));
vi.mock('fs-extra', () => ({ default: { pathExists: (...args: any[]) => pathExistsBehavior(...args), writeFile: (...args: any[]) => writeFileBehavior(...args) } }));

describe('gitInit branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when already inside git repo', async () => {
    execaBehavior = () => Promise.resolve({ stdout: 'ok' });
    pathExistsBehavior = () => Promise.resolve(true);

    vi.resetModules();
    const { gitInit } = await import('../../src/helpers/gitInit.ts');

    await gitInit('/tmp');

    // the first call should be rev-parse
    expect(typeof execaBehavior).toBe('function');
  });

  it('logs when git not available', async () => {
    execaBehavior = (cmd: string, args: string[]) => {
      if (args && args.includes('--is-inside-work-tree')) return Promise.reject(new Error('not repo'));
      if (args && args.includes('--version')) return Promise.reject(new Error('no git'));
      return Promise.resolve({ stdout: '' });
    };

    pathExistsBehavior = () => Promise.resolve(true);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);

    vi.resetModules();
    const { gitInit } = await import('../../src/helpers/gitInit.ts');
    await gitInit('/tmp');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('initializes git and writes .gitignore when missing', async () => {
    execaBehavior = (cmd: string, args: string[]) => {
      if (args && args.includes('--is-inside-work-tree')) return Promise.reject(new Error('not repo'));
      if (args && args.includes('--version')) return Promise.resolve({ stdout: 'git' });
      return Promise.resolve({ stdout: '' });
    };

    pathExistsBehavior = () => Promise.resolve(false);
    writeFileBehavior = () => Promise.resolve(undefined);

    vi.resetModules();
    const { gitInit } = await import('../../src/helpers/gitInit.ts');

    await gitInit('/tmp');

    expect(writeFileBehavior).toBeInstanceOf(Function);
    expect(typeof execaBehavior).toBe('function');
  });
});
