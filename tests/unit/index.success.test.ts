/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/prompt.ts', () => ({ runPrompts: vi.fn().mockResolvedValue({ projectName: 'app', language: 'ts', orm: 'prisma', database: 'postgresql', useRedis: false, useEslint: false }) }));
vi.mock('../../src/helpers/copy-template/handleCopyTemplate.ts', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/helpers/packages/package-json/mergePackageJson.ts', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/helpers/installDeps.ts', () => ({ installDeps: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/helpers/gitInit.ts', () => ({ gitInit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@clack/prompts', () => ({ intro: vi.fn(), outro: vi.fn(), spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })), cancel: vi.fn() }));

describe('CLI index main flow — success', () => {
  it('runs successful flow without exiting', async () => {
    vi.resetModules();

    // Set argv so resolveProjectNameArg returns immediately
    process.argv[2] = 'app';

    const copyTemplate = (await import('../../src/helpers/copy-template/handleCopyTemplate.ts')) as any;
    const mergePkg = (await import('../../src/helpers/packages/package-json/mergePackageJson.ts')) as any;
    const install = await import('../../src/helpers/installDeps.ts');
    const git = await import('../../src/helpers/gitInit.ts');
    const clack = await import('@clack/prompts');

    // import and call main after mocks
    const mod = await import('../../src/bin/create.ts');
    await mod.main();

    expect(copyTemplate.default).toHaveBeenCalled();
    expect(mergePkg.default).toHaveBeenCalled();
    expect(install.installDeps).toHaveBeenCalled();
    expect(git.gitInit).toHaveBeenCalled();
    expect(clack.outro).toHaveBeenCalled();
  });
});
