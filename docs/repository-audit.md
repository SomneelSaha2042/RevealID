# Repository Audit Checklist

Use this checklist before publishing or recording the Gate 5 demo.

## Secret and Identifier Scan

Run:

```bash
git status --short
rg -n "password|secret|private|token|BEGIN|sk-|ghp_|DATABASE_URL|ISSUER_PRIVATE_JWK" --glob '!node_modules/**' --glob '!pnpm-lock.yaml'
```

Expected findings are limited to:

- `.env.example` placeholders or local-only demo values.
- Documentation that names required environment variables.
- Test fixtures and seeded demo credentials.
- Source code that validates or redacts secrets.

Do not commit:

- `.env`
- Real issuer private JWKs
- Real auth signing secrets
- Real credential encryption keys
- Production database URLs
- Raw share tokens
- Personal academic records

## Gate Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Or:

```bash
pnpm verify
```

## Public Repo Readiness

- README explains the product, architecture, setup, demo, API, tests, and deployment.
- Swagger/OpenAPI is available at `/docs`.
- Architecture and threat model docs are linked from README.
- `.env.example` contains no production secrets.
- Demo accounts are clearly marked as local seeded data.
- Deployment guide includes API and web service configuration.
- Live Railway URLs are documented and smoke checked.
- Commit history contains meaningful vertical slices.
