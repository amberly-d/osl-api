import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@stellar/stellar-base';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';

// Requires Postgres at DATABASE_URL with migrations applied (pnpm migration:run).
// Throwaway keypair from a fixed seed; not a real account.
const ADDRESS = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9)).publicKey();

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdSlugs: string[] = [];

  // Unique per run so parallel or repeated runs never collide.
  const unique = () =>
    `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/projects').send(body);

  const create = async (overrides: Record<string, unknown> = {}) => {
    const slug = unique();
    createdSlugs.push(slug);
    return post({
      slug,
      name: 'E2E Project',
      paymentAddress: ADDRESS,
      ...overrides,
    });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await dataSource.query('DELETE FROM projects WHERE slug = ANY($1)', [
        createdSlugs,
      ]);
    }
    await app.close();
  });

  it('creates a project and reads it back by slug', async () => {
    const slug = unique();
    createdSlugs.push(slug);

    const created = await post({
      slug,
      name: '  Spaced Name  ',
      description: 'A test project',
      logoUrl: 'https://example.com/logo.png',
      paymentAddress: ADDRESS,
    }).expect(201);

    expect(created.body).toMatchObject({
      slug,
      name: 'Spaced Name',
      description: 'A test project',
      logoUrl: 'https://example.com/logo.png',
      paymentAddress: ADDRESS,
    });
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof created.body.createdAt).toBe('string');

    const fetched = await request(app.getHttpServer())
      .get(`/projects/${slug}`)
      .expect(200);
    expect(fetched.body).toEqual(created.body);
  });

  it('returns null for omitted optional fields', async () => {
    const res = await create().then((r) => {
      expect(r.status).toBe(201);
      return r;
    });
    expect(res.body.description).toBeNull();
    expect(res.body.logoUrl).toBeNull();
  });

  it('rejects a duplicate slug with 409', async () => {
    const first = await create();
    expect(first.status).toBe(201);
    await post({
      slug: first.body.slug,
      name: 'Other',
      paymentAddress: ADDRESS,
    }).expect(409);
  });

  it('allows two projects to share a payment address', async () => {
    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(201);
  });

  it('rejects an invalid payment address with 400', async () => {
    for (const paymentAddress of [
      'not-an-address',
      '',
      ADDRESS.toLowerCase(),
      Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9)).secret(),
    ]) {
      const res = await create({ paymentAddress });
      expect(res.status, paymentAddress).toBe(400);
    }
  });

  it('rejects invalid and reserved slugs with 400', async () => {
    for (const slug of [
      'ab',
      'Upper-Case',
      '-leading',
      'trailing-',
      'a_b_c',
      'admin',
      'health',
      'projects',
    ]) {
      await post({ slug, name: 'X', paymentAddress: ADDRESS }).expect(400);
    }
  });

  it('rejects non-https logos and over-long fields with 400', async () => {
    expect((await create({ logoUrl: 'http://example.com/l.png' })).status).toBe(
      400,
    );
    expect((await create({ logoUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await create({ logoUrl: 'not a url' })).status).toBe(400);
    expect((await create({ name: 'n'.repeat(81) })).status).toBe(400);
    expect((await create({ name: '   ' })).status).toBe(400);
    expect((await create({ description: 'd'.repeat(1001) })).status).toBe(400);
    expect((await create({ name: undefined })).status).toBe(400);
  });

  it('accepts the maximum field lengths', async () => {
    const res = await create({
      name: 'n'.repeat(80),
      description: 'd'.repeat(1000),
    });
    expect(res.status).toBe(201);
  });

  it('rejects unknown fields with 400', async () => {
    const res = await create({ isAdmin: true });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('isAdmin');
  });

  it('returns 404 for an unknown slug', async () => {
    await request(app.getHttpServer()).get(`/projects/${unique()}`).expect(404);
  });
});
