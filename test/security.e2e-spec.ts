import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureSecurity } from './../src/security.js';

const ALLOWED_ORIGIN = 'http://localhost:3001';

describe('Security and CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureSecurity(app, [ALLOWED_ORIGIN]);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sends Helmet security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows a listed origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('does not allow an unlisted origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://unlisted.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows only GET, POST and OPTIONS', async () => {
    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'DELETE')
      .expect(204);

    expect(response.headers['access-control-allow-methods']).toBe(
      'GET,POST,OPTIONS',
    );
  });
});
