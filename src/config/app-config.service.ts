import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables, NodeEnvironment } from './environment.js';

/**
 * Typed access to the values parsed by validateEnvironment.
 *
 * Inject this instead of ConfigService so every caller gets the same defaults
 * and a misspelled key is a compiler error.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables>) {}

  get nodeEnv(): NodeEnvironment {
    return this.config.getOrThrow<NodeEnvironment>('NODE_ENV');
  }

  get port(): number {
    return this.config.getOrThrow<number>('PORT');
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }
}
