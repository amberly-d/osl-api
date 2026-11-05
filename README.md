# osl-api

NestJS backend and payment indexer for **Open Support Ledger**, a transparent funding page and public payment ledger for open-source projects, powered by Stellar.

> **Status:** early. The foundation (NestJS, TypeORM, Postgres, CI) is in place. Features are being built through the issues in this repo.

## How the repos fit together

| Repo | Role |
|---|---|
| **osl-api** (this repo) | Backend API, database, payment indexer |
| [osl-web](https://github.com/open-support-ledger/osl-web) | Next.js frontend |
| [osl-chain](https://github.com/open-support-ledger/osl-chain) | TypeScript library for reading and verifying Stellar payments |

## Requirements

- Node.js 22 (see `.nvmrc`)
- [pnpm](https://pnpm.io/installation)
- PostgreSQL 16 (CI uses 16), plus any client you like, such as pgAdmin or `psql`

## Getting started

```bash
git clone https://github.com/open-support-ledger/osl-api.git
cd osl-api
pnpm install
cp .env.example .env
```

1. Create an empty local database, for example `osl_dev`, using pgAdmin or `psql`.
2. Edit `DATABASE_URL` in `.env` to match your local Postgres user, password, and database.
3. Apply migrations and start the server:

```bash
pnpm migration:run
pnpm start:dev
```

Check that it works: `curl http://localhost:3000/health` should return `{"status":"ok"}`.

Use **Stellar testnet** for all development. Never commit `.env` or any secret key.

## Supported assets

The MVP accepts only native XLM and Circle-issued USDC. An issued asset is
identified by **both** its code and issuer: anyone can create a token called
`USDC`, so matching the code alone would let an unrelated token inflate project
totals.

| Network | Asset | Issuer |
|---|---|---|
| Testnet | XLM | native (`null`) |
| Testnet | USDC | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Mainnet | XLM | native (`null`) |
| Mainnet | USDC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |

The issuer addresses come from Circle's official [USDC contract address
table](https://developers.circle.com/stablecoins/usdc-contract-addresses).
Matching is exact and case-sensitive; a native asset with an issuer, the other
network's issuer, or a different issuer is rejected. The types and helpers live
in `src/chain/` and are exported from `src/chain/index.ts`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm start:dev` | Run the API in watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` / `pnpm format:check` | Format with Prettier / check formatting |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm test` | Unit tests (no database needed) |
| `pnpm test:e2e` | End-to-end tests (needs Postgres at `DATABASE_URL`) |
| `pnpm migration:generate src/database/migrations/<Name>` | Generate a migration from entity changes |
| `pnpm migration:run` / `pnpm migration:revert` | Apply / undo migrations |
| `pnpm migration:check` | Fail if entities and migrations are out of sync |

Run lint, format check, typecheck, test, and build before opening a PR. CI runs the same steps.

## Database and migrations

The schema is managed with TypeORM migrations. `synchronize` is disabled and must stay that way.

1. Create or change an entity in a file named `*.entity.ts`.
2. Run `pnpm migration:generate src/database/migrations/DescribeTheChange`.
3. Review the generated SQL, then run `pnpm migration:run`.
4. Commit the entity **and** the migration together.

Rules:

- One migration per PR. If you rebase onto new migrations, regenerate yours.
- Never edit a migration that has been merged. Add a new one.
- CI runs `pnpm migration:check` and fails if an entity change has no migration.
- Prefer declaring column types explicitly, for example `@Column({ type: 'varchar' })`.
- For e2e tests, use a separate database such as `osl_test` rather than your dev data.

## Project structure

```
src/
  main.ts               app entrypoint
  app.module.ts         root module
  database/             TypeORM wiring, data source for the CLI, migrations/
  health/               health check endpoint
test/                   end-to-end tests
```

## Privacy

Stellar transactions are public, and this product has a public ledger. Read
[docs/privacy-model.md](docs/privacy-model.md) before adding an endpoint, a
response field, a log line or a supporter-facing feature. In particular: a
wallet address is not a person's identity, and a supporter's name and message
are private until they explicitly opt in.

## Contributing

Read the [contributing guide](https://github.com/open-support-ledger/.github/blob/main/CONTRIBUTING.md), then pick an issue. Please read the whole issue, including scope and acceptance criteria, before starting.

Privacy matters in this project: private or anonymous supporter data must never leave the API, and Stellar transactions must never be fabricated.

## License

Apache License 2.0. See [LICENSE](LICENSE).
