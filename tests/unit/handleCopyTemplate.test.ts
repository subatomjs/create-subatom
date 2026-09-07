
/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
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
vi.mock('../../src/utils/websocket/socketConfigHandler.ts', () => ({ default: vi.fn() }));
vi.mock('../../src/helpers/eslint/setupEslint.ts', () => ({ setupEslint: vi.fn() }));

import fs from 'fs-extra';
import handleCopyTemplate from '../../src/helpers/copy-template/handleCopyTemplate.ts';
import handleCopyIfExists from '../../src/helpers/copy-template/handleCopyIfExists.ts';
import prismaConfigHandler from '../../src/utils/prisma/prismaConfigHandler.ts';
import handlePackageSnippetUpdate from '../../src/helpers/copy-template/handlePackageSnippetUpdate.ts';
import mongooseConfigHandler from '../../src/utils/mongo/mongooseConfigHandler.ts';
import drizzleConfigHandler from '../../src/utils/drizzle/drizzleConfigHandler.ts';
import redisConfigHandler from '../../src/utils/redis/redisConfigHandler.ts';
import socketConfigHandler from '../../src/utils/websocket/socketConfigHandler.ts';
import { setupEslint } from '../../src/helpers/eslint/setupEslint.ts';

describe('handleCopyTemplate branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prisma branch with redis and eslint copies and calls handlers', async () => {
    // mocks
    // @ts-expect-error
    fs.ensureDir.mockResolvedValue(undefined);
    // @ts-expect-error
    fs.outputFile.mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);
    (prismaConfigHandler as any).mockResolvedValue(undefined);
    (handlePackageSnippetUpdate as any).mockResolvedValue(undefined);
    (redisConfigHandler as any).mockResolvedValue(undefined);
    (socketConfigHandler as any).mockResolvedValue(undefined);
    (setupEslint as any).mockResolvedValue(undefined);

    const config = {
      projectName: 'app',
      language: 'ts',
      orm: 'prisma',
      database: 'postgresql',
      useRedis: true,
      useEslint: true,
      useVitest: true,
      useSocket: true,
    } as any;

    await handleCopyTemplate(config, '/tmp');

    expect(fs.ensureDir).toHaveBeenCalled();
    expect(handleCopyIfExists).toHaveBeenCalled();
    expect(prismaConfigHandler).toHaveBeenCalled();
    expect(handlePackageSnippetUpdate).toHaveBeenCalled();
    expect(redisConfigHandler).toHaveBeenCalled();
    expect(socketConfigHandler).toHaveBeenCalled();
    expect(setupEslint).toHaveBeenCalled();
  });

  it('mongoose branch calls mongoose handler', async () => {
    // @ts-expect-error
    fs.ensureDir.mockResolvedValue(undefined);
    // @ts-expect-error
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

  it('supports drizzle without a database-specific template', async () => {
    (fs.ensureDir as any).mockResolvedValue(undefined);
    (fs.outputFile as any).mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);
    (drizzleConfigHandler as any).mockResolvedValue(undefined);

    await handleCopyTemplate({
      projectName: 'app', language: 'ts', orm: 'drizzle', database: 'none',
      useRedis: false, useEslint: false, useVitest: false, useSocket: false,
    } as any, '/tmp');

    expect(drizzleConfigHandler).toHaveBeenCalled();
  });

  it('supports the no-ORM path', async () => {
    (fs.ensureDir as any).mockResolvedValue(undefined);
    (fs.outputFile as any).mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);

    await handleCopyTemplate({
      projectName: 'app', language: 'js', orm: 'none', database: 'none',
      useRedis: false, useEslint: false, useVitest: false, useSocket: false,
    } as any, '/tmp');

    expect(fs.outputFile).toHaveBeenCalled();
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

    // @ts-expect-error
    fs.ensureDir.mockResolvedValue(undefined);
    (handleCopyIfExists as any).mockResolvedValue(undefined);

    await expect(handleCopyTemplate(config, '/tmp')).rejects.toThrow('Unsupported ORM');
  });
});
