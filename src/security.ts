import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:3001';

/**
 * Parse the comma-separated CORS_ORIGINS allow-list.
 *
 * - Empty entries are ignored.
 * - An unset or empty list allows the frontend only in development.
 * - In production an empty list means no cross-origin access.
 * - Wildcards are rejected; they can never be sent.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  if (entries.length === 0) {
    return nodeEnv === 'production' ? [] : [DEFAULT_DEVELOPMENT_ORIGIN];
  }

  const origins = entries.map((entry) => {
    if (entry === '*') {
      throw new Error(
        'CORS_ORIGINS must not contain "*". List explicit origins instead.',
      );
    }

    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(
        `CORS_ORIGINS entry "${entry}" is not a valid absolute origin.`,
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(
        `CORS_ORIGINS entry "${entry}" must use http:// or https://.`,
      );
    }

    if (
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new Error(
        `CORS_ORIGINS entry "${entry}" must contain only a scheme, host and port.`,
      );
    }

    return url.origin;
  });

  return [...new Set(origins)];
}

/**
 * Apply Helmet defaults and an explicit CORS allow-list.
 *
 * Passing `false` when the list is empty prevents Nest from falling back to a
 * wildcard origin in production.
 */
export function configureSecurity(
  app: INestApplication,
  origins: readonly string[],
): void {
  app.use(helmet());
  app.enableCors({
    origin: origins.length > 0 ? [...origins] : false,
    methods: ['GET', 'POST', 'OPTIONS'],
  });
}
