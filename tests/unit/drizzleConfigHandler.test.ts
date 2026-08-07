import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs-extra', () => ({
  default: {
    outputFile: vi.fn(),
  },
}));
import fs from 'fs-extra';
import drizzleConfigHandler from '../../src/utils/drizzle/drizzleConfigHandler.ts';

describe('drizzleConfigHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws for mongodb database', async () => {
    await expect(
      drizzleConfigHandler('/tmp', 'ts' as any, 'app', 'mongodb' as any, 'drizzle' as any, false),
    ).rejects.toThrow('Cannot attach Drizzle configuration to MongoDB.');
  });

  it('writes files for postgresql', async () => {
    // @ts-ignore
    fs.outputFile.mockResolvedValue(undefined);
    await drizzleConfigHandler('/tmp', 'ts' as any, 'app', 'postgresql' as any, 'drizzle' as any, false);
    expect(fs.outputFile).toHaveBeenCalled();
  });
});
