import { describe, it, expect } from 'vitest';
import { slugify, sortKeys, toValidPackageName } from '../../src/helpers/sharedHelper.ts';

describe('sharedHelper', () => {
  it('slugify replaces slashes with hyphens', () => {
    expect(slugify('a/b\\c')).toBe('a-b-c');
  });

  it('sortKeys returns object with keys sorted', () => {
    const input = { b: '2', a: '1', c: '3' };
    expect(Object.keys(sortKeys(input))).toEqual(['a', 'b', 'c']);
  });

  it('toValidPackageName normalizes names', () => {
    expect(toValidPackageName(' My Name ')).toBe('my-name');
    expect(toValidPackageName('Invalid$$Chars!!')).toBe('invalidchars');
  });
});
