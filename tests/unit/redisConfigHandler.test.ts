/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

vi.mock('fs-extra', () => ({ default: { outputFile: vi.fn() } }));

import fs from 'fs-extra';
import redisConfigHandler from '../../src/utils/redis/redisConfigHandler.ts';

describe('redisConfigHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes expected files for typescript redis handler', async () => {
    (fs.outputFile as any).mockResolvedValue(undefined);

    const target = '/tmp/myproj';
    await redisConfigHandler(target, 'ts');

    const calls = (fs.outputFile as any).mock.calls.map((c: any[]) => c[0]);

    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'redis-client.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'redis.config.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'redis.errors.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'index.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'redis.bootstrap.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'redis', 'redis.types.ts'))).toBe(true);
  });

  it('writes JavaScript Redis files without the TypeScript types file', async () => {
    (fs.outputFile as any).mockResolvedValue(undefined);
    await redisConfigHandler('/tmp/myproj', 'js');
    const calls = (fs.outputFile as any).mock.calls.map((c: any[]) => c[0]);
    expect(calls.some((p: string) => p.endsWith('redis.types.js'))).toBe(false);
  });
});
