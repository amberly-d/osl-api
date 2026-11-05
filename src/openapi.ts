import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

interface PackageMetadata {
  version: string;
}

function readVersion(): string {
  const metadata = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as PackageMetadata;
  return metadata.version;
}

/**
 * Build the OpenAPI document from the decorators in the app.
 *
 * Exported separately so e2e tests can inspect the generated object without
 * scraping the Swagger UI.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Open Support Ledger API')
    .setDescription('Backend API and payment indexer for Open Support Ledger.')
    .setVersion(readVersion())
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Serve Swagger UI at /docs and the JSON document at /docs-json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app));
}
