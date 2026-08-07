import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.resetModules();

let readBehavior: (path: string, enc: string) => Promise<string> = async () => '';
let writeBehavior: (path: string, data: string, enc: string) => Promise<void> = async () => {};
vi.mock('fs-extra', () => ({ default: { readFile: (p: string, e: string) => readBehavior(p, e), writeFile: (p: string, d: string, e: string) => writeBehavior(p, d, e) } }));

describe('handlePackageSnippetUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads, updates and writes snippet file', async () => {
    const sample = JSON.stringify({ name: 'x' });
    readBehavior = async () => sample;

    const writeSpy = vi.fn(async (_p: string, _d: string) => {});
    writeBehavior = (p, d) => writeSpy(p, d);

    const fn = (await import('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts')).default;
    await fn('/tmp/package.snippet.json', 'ts' as any);

    expect(writeSpy).toHaveBeenCalled();
    const written = writeSpy.mock.calls[0][1];
    expect(written).toContain('build-schema');
  });

  it('logs and rethrows on read error', async () => {
    readBehavior = async () => { throw new Error('nope'); };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined as any);

    const fn = (await import('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts')).default;
    await expect(fn('/tmp/package.snippet.json', 'js' as any)).rejects.toThrow('nope');

    errorSpy.mockRestore();
  });
});


