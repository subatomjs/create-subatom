import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    outputFile: vi.fn(),
  },
}));

vi.mock('../../src/helpers/copy-template/handleCopyIfExists.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/utils/prisma/prismaConfigHandler.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/helpers/copy-template/handlePackageSnippetUpdate.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/utils/mongo/mongooseConfigHandler.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/utils/drizzle/drizzleConfigHandler.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/utils/redis/redisConfigHandler.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/helpers/eslint/setupEslint.ts', () => ({ setupEslint: vi.fn() }));

import fs from 'fs-extra';
import handleCopyTemplate from '../../src/helpers/copy-template/handleCopyTemplate.ts';
import handleCopyIfExists from '../../src/helpers/copy-template/handleCopyIfExists.ts';
import prismaConfigHandler from '../../src/utils/prisma/prismaConfigHandler.ts';
import handlePackageSnippetUpdate from '../../src/helpers/copy-template/handlePackageSnippetUpdate.ts';
import mongooseConfigHandler from '../../src/utils/mongo/mongooseConfigHandler.ts';
import drizzleConfigHandler from '../../src/utils/drizzle/drizzleConfigHandler.ts';
import redisConfigHandler from '../../src/utils/redis/redisConfigHandler.ts';
import { setupEslint } from '../../src/helpers/eslint/setupEslint.ts';

describe('handleCopyTemplate branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prisma branch with redis and eslint copies and calls handlers', async () => {
    // mocks
    // @ts-ignore
    fs.ensureDir.mockResolvedValue(undefined);
    // @ts-ignore
    fs.outputFile.mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);
    (prismaConfigHandler as any).mockResolvedValue(undefined);
    (handlePackageSnippetUpdate as any).mockResolvedValue(undefined);
    (redisConfigHandler as any).mockResolvedValue(undefined);
    (setupEslint as any).mockResolvedValue(undefined);

    const config = {
      projectName: 'app',
      language: 'ts',
      orm: 'prisma',
      database: 'postgresql',
      useRedis: true,
      useEslint: true,
      useVitest: true,
    } as any;

    await handleCopyTemplate(config, '/tmp');

    expect(fs.ensureDir).toHaveBeenCalled();
    expect(handleCopyIfExists).toHaveBeenCalled();
    expect(prismaConfigHandler).toHaveBeenCalled();
    expect(handlePackageSnippetUpdate).toHaveBeenCalled();
    expect(redisConfigHandler).toHaveBeenCalled();
    expect(setupEslint).toHaveBeenCalled();
  });

  it('mongoose branch calls mongoose handler', async () => {
    // @ts-ignore
    fs.ensureDir.mockResolvedValue(undefined);
    // @ts-ignore
    fs.outputFile.mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);
    (mongooseConfigHandler as any).mockResolvedValue(undefined);

    const config = {
      projectName: 'app',
      language: 'js',
      orm: 'mongoose',
      database: 'mongodb',
      useRedis: false,
      useEslint: false,
      useVitest: false,
    } as any;

    await handleCopyTemplate(config, '/tmp');

    expect(mongooseConfigHandler).toHaveBeenCalled();
  });

  it('throws for unsupported ORM', async () => {
    const config = {
      projectName: 'app',
      language: 'js',
      orm: 'unknown',
      database: 'postgresql',
      useRedis: false,
      useEslint: false,
      useVitest: false,
    } as any;

    // @ts-ignore
    fs.ensureDir.mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);

    await expect(handleCopyTemplate(config, '/tmp')).rejects.toThrow('Unsupported ORM');
  });
});
