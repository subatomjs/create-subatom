import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

vi.mock('fs-extra', () => ({ default: { outputFile: vi.fn() } }));

import fs from 'fs-extra';
import mongooseConfigHandler from '../../src/utils/mongo/mongooseConfigHandler.ts';

describe('mongooseConfigHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes expected files for mongoose typescript project', async () => {
    // @ts-ignore
    (fs.outputFile as any).mockResolvedValue(undefined);

    const target = '/tmp/myproj';
    await mongooseConfigHandler(target, 'ts', 'myproj', 'mongodb', 'mongoose', true);

    const calls = (fs.outputFile as any).mock.calls.map((c: any[]) => c[0]);

    expect(calls.some((p: string) => p === path.join(target, 'main.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'models', 'subatom.model.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, '.env.requirements'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'config', 'mongoConnect.ts'))).toBe(true);
    expect(calls.some((p: string) => p === path.join(target, 'src', 'config', 'envConfig.ts'))).toBe(true);
  });
});
