/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    copy: vi.fn(),
  },
}));

import fs from 'fs-extra';
import handleCopyIfExists from '../../src/helpers/copy-template/handleCopyIfExists.ts';

describe('handleCopyIfExists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when src missing', async () => {
    // @ts-expect-error
    fs.pathExists.mockResolvedValue(false);
    await expect(handleCopyIfExists('/no', '/dest', 'label')).rejects.toThrow('Missing template folder');
  });

  it('copies and handles snippet present', async () => {
    // @ts-expect-error
    fs.pathExists.mockResolvedValue(true);
    // @ts-expect-error
    fs.copy.mockResolvedValue(undefined);
    await expect(handleCopyIfExists('/src', '/dest', 'label')).resolves.toBeUndefined();
    expect(fs.copy).toHaveBeenCalled();
    const filter = (fs.copy as any).mock.calls[0][2].filter;
    expect(filter('/src/file.ts')).toBe(true);
    expect(filter('/src/package.snippet.json')).toBe(false);
  });

  it('copies a template without a snippet file', async () => {
    let checks = 0;
    // @ts-expect-error
    fs.pathExists.mockImplementation(async () => {
      checks += 1;
      return checks === 1;
    });
    // @ts-expect-error
    fs.copy.mockResolvedValue(undefined);

    await handleCopyIfExists('/src', '/dest', 'label');

    expect(fs.copy).toHaveBeenCalledTimes(1);
  });
});
