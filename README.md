# RevealID

Privacy-preserving academic credential wallet and verifier.

## Local Gate 1 Stack

1. Copy `.env.example` to `.env` and adjust secrets for your machine.
2. Start Postgres:

```bash
docker compose up -d postgres
```

3. Install dependencies and prepare the database:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

4. Run the apps:

```bash
pnpm dev
```

The frontend is served at `http://localhost:3000`. It proxies `/api/*` to the Fastify API, keeping auth cookies first-party in the browser. Swagger renders at `http://localhost:4000/docs`.

Seeded accounts:

- Issuer: `issuer@demo-university.edu` / `DemoIssuerPass123!`
- Holder: `holder@example.edu` / `DemoHolderPass123!`

## Gate Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
