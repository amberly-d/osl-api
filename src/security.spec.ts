import { parseCorsOrigins } from './security.js';

describe('parseCorsOrigins', () => {
  it('uses the development default when unset', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual([
      'http://localhost:3001',
    ]);
  });

  it('uses no origins in production when unset or empty', () => {
    expect(parseCorsOrigins(undefined, 'production')).toEqual([]);
    expect(parseCorsOrigins('  ,  ', 'production')).toEqual([]);
  });

  it('trims entries and ignores empty ones', () => {
    expect(
      parseCorsOrigins(
        ' http://localhost:3001 , , https://app.example.com ',
        'production',
      ),
    ).toEqual(['http://localhost:3001', 'https://app.example.com']);
  });

  it('accepts several origins and removes duplicates', () => {
    expect(
      parseCorsOrigins(
        'http://localhost:3001,https://app.example.com,http://localhost:3001',
        'production',
      ),
    ).toEqual(['http://localhost:3001', 'https://app.example.com']);
  });

  it('normalises an origin with a trailing slash', () => {
    expect(parseCorsOrigins('https://app.example.com/', 'production')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('rejects a wildcard origin', () => {
    expect(() => parseCorsOrigins('*', 'development')).toThrow(
      'CORS_ORIGINS must not contain "*"',
    );
  });

  it('rejects invalid entries', () => {
    expect(() => parseCorsOrigins('not an origin', 'development')).toThrow(
      'is not a valid absolute origin',
    );
    expect(() => parseCorsOrigins('ftp://example.com', 'development')).toThrow(
      'must use http:// or https://',
    );
    expect(() =>
      parseCorsOrigins('https://example.com/path', 'development'),
    ).toThrow('must contain only a scheme, host and port');
  });
});
