import { validateEnvironment } from './environment.js';

const validConfig = {
  DATABASE_URL: 'postgres://osl:secret@localhost:5432/osl_dev',
};

function errorFor(config: Record<string, unknown>): string {
  try {
    validateEnvironment(config);
  } catch (error) {
    return (error as Error).message;
  }
  return '';
}

describe('validateEnvironment', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const env = validateEnvironment(validConfig);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe(validConfig.DATABASE_URL);
  });

  it('parses explicit NODE_ENV and PORT values', () => {
    const env = validateEnvironment({
      ...validConfig,
      NODE_ENV: 'test',
      PORT: '4001',
    });

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(4001);
  });

  it('reports a missing DATABASE_URL', () => {
    expect(errorFor({})).toContain('DATABASE_URL is required.');
  });

  it('rejects a DATABASE_URL with the wrong protocol', () => {
    expect(errorFor({ DATABASE_URL: 'mysql://localhost/osl' })).toContain(
      'DATABASE_URL must start with postgres:// or postgresql://.',
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(errorFor({ ...validConfig, PORT: 'abc' })).toContain(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('rejects a PORT outside 1-65535', () => {
    expect(errorFor({ ...validConfig, PORT: '0' })).toContain(
      'PORT must be an integer between 1 and 65535.',
    );
    expect(errorFor({ ...validConfig, PORT: '65536' })).toContain(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(errorFor({ ...validConfig, NODE_ENV: 'staging' })).toContain(
      'NODE_ENV must be one of development, test, production.',
    );
  });

  it('reports several problems together', () => {
    const message = errorFor({
      NODE_ENV: 'staging',
      PORT: 'not-a-port',
      DATABASE_URL: 'mysql://localhost/osl',
    });

    expect(message).toContain('NODE_ENV');
    expect(message).toContain('PORT');
    expect(message).toContain('DATABASE_URL');
  });

  it('never includes the database password in the error', () => {
    const message = errorFor({
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgres://osl:super-secret-password@localhost:5432/osl',
    });

    expect(message).not.toContain('super-secret-password');
  });
});
