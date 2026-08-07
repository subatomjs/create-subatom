/// <reference types="node" />
import { describe, it, expect, afterEach } from 'vitest';
import detect from '../../src/helpers/packages/detectPackageManager.ts';

describe('detectPackageManager', () => {
  const original = process.env.npm_config_user_agent;
  afterEach(() => {
    process.env.npm_config_user_agent = original;
  });

  it('detects pnpm', () => {
    process.env.npm_config_user_agent = 'pnpm/7.0.0 some';
    const pm = detect();
    expect(pm.name).toBe('pnpm');
  });

  it('defaults to npm', () => {
    process.env.npm_config_user_agent = '';
    const pm = detect();
    expect(pm.name).toBe('npm');
  });
});
