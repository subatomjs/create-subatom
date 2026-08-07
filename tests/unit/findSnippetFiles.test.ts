import { describe, it, expect, vi } from 'vitest';

vi.resetModules();

// Provide a mock for fs-extra.readdir
let readdirBehavior: (dir: string, opts: any) => Promise<any[]> = async () => [];
vi.mock('fs-extra', () => ({ default: { readdir: (dir: string, opts: any) => readdirBehavior(dir, opts) } }));

describe('findSnippetFiles', () => {
  it('finds snippet files recursively', async () => {
    readdirBehavior = async (dir: string) => {
      if (dir === '/root') return [ { name: 'a', isDirectory: () => true, isFile: () => false }, { name: 'package.snippet.json', isDirectory: () => false, isFile: () => true } ];
      if (dir === '/root/a') return [ { name: 'package.snippet.custom.json', isDirectory: () => false, isFile: () => true } ];
      return [];
    };

    const find = (await import('../../src/helpers/packages/package-json/findSnippetFiles.ts')).default;
    const res = await find('/root');
    expect(res).toContain('/root/package.snippet.json');
    expect(res).toContain('/root/a/package.snippet.custom.json');
  });

  it('skips node_modules and .git directories', async () => {
    readdirBehavior = async (dir: string) => {
      if (dir === '/root') return [ { name: 'node_modules', isDirectory: () => true, isFile: () => false }, { name: '.git', isDirectory: () => true, isFile: () => false } ];
      return [];
    };

    const find = (await import('../../src/helpers/packages/package-json/findSnippetFiles.ts')).default;
    const res = await find('/root');
    expect(res).toEqual([]);
  });
});
