/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.resetModules();

let readBehavior: (path: string, enc: string) => Promise<string> = async () => '';
vi.mock('fs-extra', () => ({ default: { readFile: (p: string, e: string) => readBehavior(p, e) } }));
vi.mock('../../src/helpers/atomicWriteFile.ts', () => ({ atomicWriteFile: vi.fn() }));

describe('handlePackageSnippetUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads, updates and writes snippet file', async () => {
    const sample = JSON.stringify({ name: 'x' });
    readBehavior = async () => sample;

    const fn = (await import('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts')).default;
    await fn('/tmp/package.snippet.json', 'ts' as any);

    const { atomicWriteFile } = await import('../../src/helpers/atomicWriteFile.ts');
    expect(atomicWriteFile).toHaveBeenCalled();
    const written = (atomicWriteFile as any).mock.calls[0][1];
    expect(written).toContain('build-schema');
  });

  it('logs and rethrows on read error', async () => {
    readBehavior = async () => { throw new Error('nope'); };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined as any);

    const fn = (await import('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts')).default;
    await expect(fn('/tmp/package.snippet.json', 'js' as any)).rejects.toThrow('nope');

    errorSpy.mockRestore();
  });

  it('writes the JavaScript build command when scripts already exist', async () => {
    readBehavior = async () => JSON.stringify({ scripts: { test: 'node test.js' } });
    const fn = (await import('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts')).default;

    await fn('/tmp/package.snippet.json', 'js' as any);

    const { atomicWriteFile } = await import('../../src/helpers/atomicWriteFile.ts');
    expect((atomicWriteFile as any).mock.calls[0][1]).toContain('node scripts/schema_builder.js');
  });
});


