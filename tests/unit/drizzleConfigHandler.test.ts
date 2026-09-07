/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
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
      drizzleConfigHandler('/tmp', 'ts' as any, 'mongodb' as any, 'drizzle' as any, false, false),
    ).rejects.toThrow('Cannot attach Drizzle configuration to MongoDB.');
  });

  it('writes files for postgresql', async () => {
    // @ts-expect-error
    fs.outputFile.mockResolvedValue(undefined);
    await drizzleConfigHandler('/tmp', 'ts' as any, 'postgresql' as any, 'drizzle' as any, false, false);
    expect(fs.outputFile).toHaveBeenCalled();
  });

  it.each(['mysql', 'sqlite'])('writes database-specific files for %s', async (database) => {
    // @ts-expect-error
    fs.outputFile.mockResolvedValue(undefined);
    await drizzleConfigHandler('/tmp', 'js' as any, database as any, 'drizzle' as any, true, true);
    expect(fs.outputFile).toHaveBeenCalled();
  });

  it('rejects unsupported database dialects', async () => {
    await expect(drizzleConfigHandler('/tmp', 'ts' as any, 'none' as any, 'drizzle' as any, false, false))
      .rejects.toThrow('Unsupported database dialect');
  });
});

