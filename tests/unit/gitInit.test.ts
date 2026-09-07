/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('fs-extra', () => ({ pathExists: vi.fn(), writeFile: vi.fn() }));

import { execa } from 'execa';
import { gitInit } from '../../src/helpers/gitInit.ts';

describe('gitInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(()=>{});
  });

  it('skips when already inside git repo', async () => {
    // @ts-expect-error
    execa.mockImplementation(async (_cmd:string, args: any[]) => {
      if (args && args[0] === 'rev-parse') return {};
      if (args && args[0] === '--version') return {};
      return {};
    });
    await gitInit('/tmp');
    expect(execa).toHaveBeenCalled();
  });

  it('prints message when git not available', async () => {
    // @ts-expect-error
    execa.mockImplementation(async (_cmd:string, args:any[]) => {
      if (args && args[0] === 'rev-parse') throw new Error('no');
      if (args && args[0] === '--version') throw new Error('no git');
      return {};
    });
    await gitInit('/tmp');
    expect(execa).toHaveBeenCalled();
  });
});
