import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { setupSwagger } from './../src/openapi.js';

describe('OpenAPI documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves Swagger UI at /docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });

  it('serves a valid OpenAPI document including /health', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(response.body.openapi).toBeDefined();
    expect(response.body.info.title).toBe('Open Support Ledger API');
    expect(response.body.paths['/health'].get.responses['200']).toBeDefined();
    expect(
      response.body.paths['/health'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toBeDefined();
  });
});
