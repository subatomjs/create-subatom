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

  it.each([
    ['yarn/1.0.0', 'yarn'],
    ['bun/1.0.0', 'bun'],
    ['npm/10.0.0', 'npm'],
  ])('detects %s', (userAgent, expected) => {
    process.env.npm_config_user_agent = userAgent;
    const pm = detect();
    expect(pm.name).toBe(expected);
    expect(pm.runCommand('build')).toEqual(
      expected === 'pnpm' || expected === 'yarn'
        ? ['build']
        : ['run', 'build'],
    );
  });

  it('defaults to npm', () => {
    process.env.npm_config_user_agent = '';
    const pm = detect();
    expect(pm.name).toBe('npm');
  });

  it('supports pnpm and yarn script commands', () => {
    process.env.npm_config_user_agent = 'pnpm/10.0.0';
    expect(detect().runCommand('test')).toEqual(['test']);
    process.env.npm_config_user_agent = 'yarn/1.0.0';
    expect(detect().runCommand('test')).toEqual(['test']);
  });

  it('falls back when the package-manager user agent is unset', () => {
    delete process.env.npm_config_user_agent;
    expect(detect().name).toBe('npm');
  });
});
