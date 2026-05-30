# Railway Deployment

RevealID is deployed as three Railway services from the GitHub repository:

- `revealid-postgres`: Railway Postgres
- `revealid-api`: Fastify API
- `revealid-web`: Next.js web app

Current production URLs:

- Web: `https://revealidweb-production.up.railway.app/`
- API: `https://revealidapi-production.up.railway.app/`
- Swagger/OpenAPI: `https://revealidapi-production.up.railway.app/docs`

## 1. Create Project

Create a Railway project and add a Postgres database first. Railway will provide `DATABASE_URL`.

## 2. API Service

Create a GitHub-backed service from this repository.

Recommended settings:

- Dockerfile path: `apps/api/Dockerfile`
- Root directory: repository root
- Healthcheck path: `/health`

Environment variables:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
AUTH_ACCESS_TOKEN_SECRET=<32+ character secret>
AUTH_REFRESH_TOKEN_SECRET=<32+ character different secret>
COOKIE_SECURE=true
WEB_ORIGIN=https://<web-service-domain>
NODE_ENV=production
```

The API image runs `prisma migrate deploy` before starting the server.

## 3. Web Service

Create a second GitHub-backed service from this repository.

Recommended settings:

- Dockerfile path: `apps/web/Dockerfile`
- Root directory: repository root

Environment variables:

```bash
API_BASE_URL=https://<api-service-domain>
NEXT_PUBLIC_API_BASE_URL=/api
NODE_ENV=production
```

The browser should continue to call `/api/*` on the web origin. Next.js rewrites those requests to the API service.

## 4. Smoke Checks

After deploy:

```bash
curl https://revealidapi-production.up.railway.app/health
curl https://revealidweb-production.up.railway.app/api/health
```

Swagger should render at:

```text
https://revealidapi-production.up.railway.app/docs
```

Latest documented smoke check: May 30, 2026.

| Check | Expected |
| --- | --- |
| `https://revealidapi-production.up.railway.app/health` | `200 OK` |
| `https://revealidweb-production.up.railway.app/` | `200 OK` |
| `https://revealidweb-production.up.railway.app/api/health` | `200 OK` |
| `https://revealidapi-production.up.railway.app/docs` | `200 OK` |
