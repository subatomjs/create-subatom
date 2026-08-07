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
    // @ts-ignore
    fs.pathExists.mockResolvedValue(false);
    await expect(handleCopyIfExists('/no', '/dest', 'label')).rejects.toThrow('Missing template folder');
  });

  it('copies and handles snippet present', async () => {
    // @ts-ignore
    fs.pathExists.mockImplementation(async (p:string) => p.endsWith('package.snippet.json') ? true : true);
    // @ts-ignore
    fs.copy.mockResolvedValue(undefined);
    await expect(handleCopyIfExists('/src', '/dest', 'label')).resolves.toBeUndefined();
    expect(fs.copy).toHaveBeenCalled();
  });
});
