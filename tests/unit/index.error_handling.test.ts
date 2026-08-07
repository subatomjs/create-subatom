import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => undefined) as any);

    // mock the internal step to fail so main's inner catch runs
    const handleMock = vi.fn().mockRejectedValue(new Error('boom'));
    handleBehavior = (...args: any[]) => handleMock(...args);

    const { main } = await import('../../src/index.ts');

    await main(() => ({ name: 'proj', useCurrentDir: false }));

    const clack = await import('@clack/prompts');
    expect(handleMock).toHaveBeenCalled();
    expect(clack.cancel).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('rethrows unexpected resolver errors', async () => {
    const { main } = await import('../../src/index.ts');

    await expect(
      // resolver throws generic Error; main should rethrow
      main(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
