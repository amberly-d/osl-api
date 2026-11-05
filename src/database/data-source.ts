import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Used by the TypeORM CLI (migration scripts in package.json). It runs against
// the compiled output in dist/, so entity and migration globs match .js files.
try {
  process.loadEnvFile();
} catch {
  // No .env file; fall back to the real environment.
}

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Must match DatabaseModule, or migration:check reports phantom drift.
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
});
