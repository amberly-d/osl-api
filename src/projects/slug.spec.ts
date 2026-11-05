import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS, isValidSlug, slugProblem } from './slug.js';

describe('slug validation', () => {
  it.each([
    'abc',
    'my-project',
    'project-42',
    '9lives',
    'a-b-c',
    'a'.repeat(40),
  ])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it('rejects slugs that are too short or too long', () => {
    expect(slugProblem('ab')).toMatch(/3-40/);
    expect(slugProblem('')).toMatch(/3-40/);
    expect(slugProblem('a'.repeat(41))).toMatch(/3-40/);
  });

  it.each([
    'My-Project',
    'ABC',
    'with_underscore',
    'with space',
    'café',
    'a.b.c',
    'a/b/c',
  ])('rejects invalid characters in %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects a leading or trailing hyphen', () => {
    expect(isValidSlug('-abc')).toBe(false);
    expect(isValidSlug('abc-')).toBe(false);
    expect(isValidSlug('--abc')).toBe(false);
  });

  it('rejects reserved words', () => {
    for (const word of [
      'admin',
      'api',
      'docs',
      'health',
      'login',
      'new',
      'settings',
      'projects',
    ]) {
      expect(RESERVED_SLUGS.has(word)).toBe(true);
      expect(slugProblem(word)).toMatch(/reserved/);
    }
  });

  it('rejects non-strings', () => {
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(123)).toBe(false);
    expect(isValidSlug(null)).toBe(false);
  });
});
