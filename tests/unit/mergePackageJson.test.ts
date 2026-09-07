/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs-extra and helper modules before importing the module under test
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../src/helpers/packages/package-json/findSnippetFiles.ts', () => ({
  default: vi.fn()
}));
vi.mock('../../src/helpers/atomicWriteFile.ts', () => ({ atomicWriteFile: vi.fn() }));

import fs from 'fs-extra';
import findSnippetFiles from '../../src/helpers/packages/package-json/findSnippetFiles.ts';
import mergePackageJson from '../../src/helpers/packages/package-json/mergePackageJson.ts';

describe('mergePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges snippets and writes final package.json', async () => {
    // Mock existing root package.json
    // @ts-expect-error
    fs.pathExists.mockResolvedValue(true);
    // @ts-expect-error
    fs.readJson.mockImplementation(async (p:string) => {
      if (p.endsWith('package.json')) return { name: 'old', scripts: { start: 'node' }, dependencies: { a: '1' } };
      return { scripts: { build: 'tsc' }, dependencies: { b: '2' } };
    });
    // @ts-expect-error
    findSnippetFiles.mockResolvedValue(['/tmp/package.snippet.json']);

    const config = { projectName: 'app', language: 'ts' } as any;
    await mergePackageJson(config, '/tmp');

    const { atomicWriteFile } = await import('../../src/helpers/atomicWriteFile.ts');
    expect(atomicWriteFile).toHaveBeenCalled();
    expect(fs.remove).toHaveBeenCalledWith('/tmp/package.snippet.json');
  });

  it('creates a JavaScript package when no root package exists', async () => {
    (fs.pathExists as any).mockResolvedValue(false);
    (findSnippetFiles as any).mockResolvedValue([]);

    const config = { projectName: 'my app', language: 'js' } as any;
    await mergePackageJson(config, '/tmp');

    const { atomicWriteFile } = await import('../../src/helpers/atomicWriteFile.ts');
    expect(atomicWriteFile).toHaveBeenCalledWith(
      '/tmp/package.json',
      expect.stringContaining('"name": "my-app"'),
    );
  });

  it('preserves optional package metadata while normalizing dependencies', async () => {
    (fs.pathExists as any).mockResolvedValue(true);
    (fs.readJson as any).mockResolvedValue({
      name: 'ignored',
      version: '2.0.0',
      private: false,
      type: 'commonjs',
      description: 'generated',
      scripts: { start: 'node main.ts' },
      dependencies: { zed: '1.0.0' },
      devDependencies: { alpha: '1.0.0' },
      custom: { enabled: true },
    });
    (findSnippetFiles as any).mockResolvedValue([]);

    await mergePackageJson({ projectName: 'app', language: 'ts' } as any, '/tmp');

    const { atomicWriteFile } = await import('../../src/helpers/atomicWriteFile.ts');
    expect(atomicWriteFile).toHaveBeenCalledWith(
      '/tmp/package.json',
      expect.stringContaining('"custom": {'),
    );
  });
});
