import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
import { installDeps } from '../../src/helpers/installDeps.ts';

describe('installDeps', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls execa with detected pm', async () => {
    // make detectPackageManager default to npm by env
    process.env.npm_config_user_agent = 'npm/1.0.0';
    // @ts-expect-error
    execa.mockResolvedValue({});
    await installDeps('/tmp');
    expect(execa).toHaveBeenCalled();
  });

  it('throws an error when execa fails', async () => {
    // @ts-expect-error
    execa.mockRejectedValue(new Error('fail'));
    await expect(installDeps('/tmp')).rejects.toThrow('Dependency install failed');
  });
});
