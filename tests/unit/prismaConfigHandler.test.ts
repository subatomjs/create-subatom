/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

vi.mock('fs-extra', () => ({ default: { outputFile: vi.fn() } }));

import fs from 'fs-extra';
import prismaConfigHandler from '../../src/utils/prisma/prismaConfigHandler.ts';

describe('prismaConfigHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes expected files for prisma typescript project', async () => {
    (fs.outputFile as any).mockResolvedValue(undefined);

    const target = '/tmp/myproj';
    await prismaConfigHandler(target, 'postgresql', 'ts', true, 'prisma', true);

    // Check that outputFile was called for each expected path
    const calls = (fs.outputFile as any).mock.calls.map((c: any[]) => c[0]);

    expect(calls.some((p: string) => p === path.join(target, 'main.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'prisma.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'prisma.config.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, '.env.requirements'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'config', 'envConfig.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'models', 'subatom.prisma'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'prisma', 'schema.prisma'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'scripts', 'schema_builder.ts'))).toBe(true);
  });

  it('writes JavaScript files for SQLite without Redis', async () => {
    (fs.outputFile as any).mockResolvedValue(undefined);
    const target = '/tmp/myproj';
    await prismaConfigHandler(target, 'sqlite', 'js', false, 'prisma', true);
    expect((fs.outputFile as any).mock.calls.some((c: any[]) => c[0] === path.join(target, 'prisma.js'))).toBe(true);
  });
});
