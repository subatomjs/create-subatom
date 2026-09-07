/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliExitCode } from '../../src/types.js';

vi.resetModules();

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  cancel: vi.fn(),
}));

vi.mock('../../src/prompt.ts', () => ({ runPrompts: () => Promise.resolve({
  projectName: 'proj',
  language: 'ts',
  orm: 'prisma',
  database: 'postgresql',
  useRedis: false,
  useEslint: false,
  useVitest: false,
}) }));

// Use a behavior variable so the hoisted mock factory does not reference per-test locals.
let handleBehavior: (...args: any[]) => Promise<any> = () => Promise.resolve();
vi.mock('../../src/helpers/copy-template/handleCopyTemplate.js', () => ({ default: (...args: any[]) => handleBehavior(...args) }));

describe('index error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls cancel and exits when an internal step throws', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => undefined) as any);

    // mock the internal step to fail so main's inner catch runs
    const handleMock = vi.fn().mockRejectedValue(new Error('boom'));
    handleBehavior = (...args: any[]) => handleMock(...args);

    const { main } = await import('../../src/bin/create.ts');

    await main(() => ({ name: 'proj', useCurrentDir: false }));

    const clack = await import('@clack/prompts');
    expect(handleMock).toHaveBeenCalled();
    expect(clack.cancel).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(CliExitCode.InitializationFailed);

    exitSpy.mockRestore();
  });

  it('rethrows unexpected resolver errors', async () => {
    const { main } = await import('../../src/bin/create.ts');

    await expect(
      // resolver throws generic Error; main should rethrow
      main(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('cancels and exits for an invalid project name', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => undefined) as any);
    const { main } = await import('../../src/bin/create.ts');

    await main(() => {
      const error = new Error('invalid') as Error & { name: string; cause: string };
      error.name = 'InvalidProjectNameError';
      error.cause = 'bad name';
      throw error;
    });

    const clack = await import('@clack/prompts');
    expect(clack.cancel).toHaveBeenCalledWith(expect.stringContaining('invalid'));
    expect(exitSpy).toHaveBeenCalledWith(CliExitCode.InvalidProjectName);
    exitSpy.mockRestore();
  });

  it('reports unknown initialization failures without assuming Error', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => undefined) as any);
    handleBehavior = async () => { throw 'failure'; };
    const { main } = await import('../../src/bin/create.ts');

    await main(() => ({ name: 'proj', useCurrentDir: false }));

    const clack = await import('@clack/prompts');
    expect(clack.cancel).toHaveBeenCalledWith('Project initialization failed.');
    expect(exitSpy).toHaveBeenCalledWith(CliExitCode.InitializationFailed);
    exitSpy.mockRestore();
  });

  it('handles top-level CLI runner failures', async () => {
    const { runCli } = await import('../../src/bin/create.ts');

    await runCli(async () => {
      throw new Error('runner failed');
    });

    const clack = await import('@clack/prompts');
    expect(clack.cancel).toHaveBeenCalledWith('runner failed');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('reports unknown top-level failure values', async () => {
    const { runCli } = await import('../../src/bin/create.ts');

    await runCli(async () => {
      throw 'runner failure';
    });

    const clack = await import('@clack/prompts');
    expect(clack.cancel).toHaveBeenCalledWith('Unknown error occurred.');
    process.exitCode = 0;
  });
});
