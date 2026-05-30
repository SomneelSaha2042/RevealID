# RevealID API Documentation

Swagger UI is available whenever the API service is running:

```text
http://localhost:4000/docs
```

In production, replace the host with the deployed API service domain:

```text
https://revealidapi-production.up.railway.app/docs
```

The OpenAPI schema is generated from explicit Fastify route schemas. Request validation is backed by shared Zod contracts in `packages/contracts`.

## Primary Endpoints

| Area | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| Health | `GET /health` | Public | API smoke check. |
| Auth | `POST /auth/register` | Public | Register a holder account and create a session. |
| Auth | `POST /auth/login` | Public | Create an authenticated cookie session. |
| Auth | `POST /auth/logout` | Session + CSRF | Revoke refresh session and clear cookies. |
| Auth | `POST /auth/refresh` | Refresh cookie | Rotate session cookies. |
| Auth | `GET /me` | Session | Return the current user. |
| Issuer | `POST /credentials/issue` | `ISSUER` + CSRF | Issue an encrypted SD-JWT credential to a holder. |
| Issuer | `GET /issuer/credentials` | `ISSUER` | List issuer-owned credential metadata. |
| Issuer | `POST /credentials/:id/revoke` | `ISSUER` + CSRF | Revoke an issued credential. |
| Wallet | `GET /wallet/credentials` | Session | List holder-owned credential metadata. |
| Wallet | `GET /wallet/credentials/:id` | Session | Read holder credential detail for sharing. |
| Shares | `POST /credentials/share` | `HOLDER` + CSRF | Create a selective-disclosure verifier link. |
| Shares | `GET /shares` | Session | List holder share history without recoverable tokens. |
| Shares | `DELETE /shares/:id` | `HOLDER` + CSRF | Cancel a holder share. |
| Verify | `POST /credentials/verify` | Public, rate-limited | Verify a share token and return disclosed claims only. |
| Metadata | `GET /.well-known/jwks.json` | Public | Publish issuer verification keys. |
| Metadata | `GET /issuer/metadata` | Public | Publish issuer metadata and supported credential types. |

## Privacy Requirements

- Verification responses must never include hidden claims.
- Credential list endpoints return metadata only.
- Share history never returns raw share tokens or encrypted presentations.
- Issuer credential management never returns credential blobs or SD-JWT presentations.
- Public verification audit logs store result metadata and hashed request metadata only.

## Evaluator Smoke Checks

```bash
curl http://localhost:4000/health
curl http://localhost:4000/docs
```

For deployed environments:

```bash
curl https://revealidapi-production.up.railway.app/health
curl https://revealidweb-production.up.railway.app/api/health
```
