import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs-extra', () => ({
  default: {
    writeJson: vi.fn(),
    writeFile: vi.fn(),
  },
}));
import fs from 'fs-extra';
import writeSnippet from '../../src/helpers/eslint/writeSnippet.ts';
import writeEslintConfig from '../../src/helpers/eslint/writeEslintConfig.ts';

describe('eslint helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writeSnippet writes json', async () => {
    // @ts-expect-error
    fs.writeJson.mockResolvedValue(undefined);
    await writeSnippet('/tmp', { devDependencies: {} });
    expect(fs.writeJson).toHaveBeenCalled();
  });

  it('writeEslintConfig writes file', async () => {
    // @ts-expect-error
    fs.writeFile.mockResolvedValue(undefined);
    await writeEslintConfig('/tmp', 'content');
    expect(fs.writeFile).toHaveBeenCalled();
  });
});
