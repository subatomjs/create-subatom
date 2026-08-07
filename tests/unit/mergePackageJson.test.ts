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

import fs from 'fs-extra';
import findSnippetFiles from '../../src/helpers/packages/package-json/findSnippetFiles.ts';
import mergePackageJson from '../../src/helpers/packages/package-json/mergePackageJson.ts';

describe('mergePackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges snippets and writes final package.json', async () => {
    // Mock existing root package.json
    // @ts-ignore
    fs.pathExists.mockResolvedValue(true);
    // @ts-ignore
    fs.readJson.mockImplementation(async (p:string) => {
      if (p.endsWith('package.json')) return { name: 'old', scripts: { start: 'node' }, dependencies: { a: '1' } };
      return { scripts: { build: 'tsc' }, dependencies: { b: '2' } };
    });
    // @ts-ignore
    findSnippetFiles.mockResolvedValue(['/tmp/package.snippet.json']);

    const config = { projectName: 'app', language: 'ts' } as any;
    await mergePackageJson(config, '/tmp');

    expect(fs.writeJson).toHaveBeenCalled();
    expect(fs.remove).toHaveBeenCalledWith('/tmp/package.snippet.json');
  });
});
