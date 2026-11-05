export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
}

const NODE_ENVIRONMENTS: readonly NodeEnvironment[] = [
  'development',
  'test',
  'production',
];

function text(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

/**
 * Validate every environment variable once, before the app listens.
 *
 * The messages name the variable but never include its value: DATABASE_URL
 * normally contains a password.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const problems: string[] = [];

  const nodeEnvironment = (text(config, 'NODE_ENV') ??
    'development') as NodeEnvironment;
  if (!NODE_ENVIRONMENTS.includes(nodeEnvironment)) {
    problems.push(`NODE_ENV must be one of ${NODE_ENVIRONMENTS.join(', ')}.`);
  }

  const rawPort = text(config, 'PORT');
  let port = 3000;
  if (rawPort !== undefined) {
    if (!/^\d+$/.test(rawPort)) {
      problems.push('PORT must be an integer between 1 and 65535.');
    } else {
      port = Number(rawPort);
      if (port < 1 || port > 65535) {
        problems.push('PORT must be an integer between 1 and 65535.');
      }
    }
  }

  const databaseUrl = text(config, 'DATABASE_URL');
  if (databaseUrl === undefined) {
    problems.push('DATABASE_URL is required.');
  } else if (!isPostgresUrl(databaseUrl)) {
    problems.push('DATABASE_URL must start with postgres:// or postgresql://.');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join('\n')}`,
    );
  }

  return {
    NODE_ENV: nodeEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl!,
  };
}
