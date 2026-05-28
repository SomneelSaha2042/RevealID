## API Contract & Documentation Structure

---

## 1. Authentication Endpoints

### `POST /api/auth/register`

Holder registration only.

```json
// Request
{
  "email": "holder@example.com",
  "password": "StrongPassword123!"
}

// Response
{
  "user": {
    "id": "uuid",
    "email": "holder@example.com",
    "role": "HOLDER"
  }
}
```

### `POST /api/auth/login`

```json
{
  "email": "holder@example.com",
  "password": "StrongPassword123!"
}
```

### Additional Auth Routes

- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Clear session
- `GET /api/auth/me` — Current user info

---

## 2. Issuance Endpoints

### `POST /api/credentials/issue`

Restricted to `ISSUER` role.

```json
// Request
{
  "holderEmail": "holder@example.com",
  "claims": {
    "name": "Somneel Kumar Saha",
    "degree": "Bachelor of Computing",
    "major": "Computer Science and Quantitative Finance",
    "graduationYear": 2027,
    "cgpa": "4.07/5.00",
    "studentId": "A0XXXXXXX",
    "honoursEligible": true,
    "issuerName": "Demo University",
    "issueDate": "2026-05-28"
  }
}

// Response
{
  "credentialId": "uuid",
  "status": "ACTIVE",
  "issuedAt": "2026-05-28T12:00:00Z",
  "holderEmail": "holder@example.com"
}
```

---

## 3. Wallet Endpoints

### `GET /api/credentials`

Restricted to authenticated holder. Returns **only** non-sensitive display metadata.

```json
{
  "credentials": [
    {
      "id": "uuid",
      "type": "Academic Degree Credential",
      "issuerName": "Demo University",
      "issuedAt": "2026-05-28T12:00:00Z",
      "status": "ACTIVE"
    }
  ]
}
```

---

## 4. Sharing Endpoints

### `POST /api/credentials/share`

Restricted to credential owner.

```json
// Request
{
  "credentialId": "uuid",
  "disclose": [
    "degree",
    "major",
    "graduationYear",
    "honoursEligible"
  ],
  "expiresInMinutes": 15,
  "maxViews": 1
}

// Response
{
  "shareId": "uuid",
  "verifyUrl": "https://revealid.app/verify/<opaque-token>",
  "qrPayload": "https://revealid.app/verify/<opaque-token>",
  "expiresAt": "2026-05-28T12:15:00Z",
  "disclosedFields": ["degree", "major", "graduationYear", "honoursEligible"]
}
```

---

## 5. Verification Endpoints

### `POST /api/credentials/verify`

Public but rate-limited.

```json
// Request
{ "token": "<opaque-token>" }

// Response
{
  "status": "verified",
  "disclosedClaims": {
    "degree": "Bachelor of Computing",
    "major": "Computer Science and Quantitative Finance",
    "graduationYear": 2027,
    "honoursEligible": true
  },
  "issuer": {
    "name": "Demo University",
    "keyId": "issuer-key-2026-01",
    "trustStatus": "trusted_demo_issuer"
  },
  "checks": {
    "issuerSignature": true,
    "disclosureIntegrity": true,
    "holderBinding": true,
    "audienceBinding": true,
    "nonceFreshness": true,
    "shareExpiry": true,
    "credentialActive": true
  },
  "verifiedAt": "2026-05-28T12:03:00Z"
}
```

---

## 6. Status & Operational Endpoints

| **Endpoint** | **Method** | **Access** |
| --- | --- | --- |
| `/api/credentials/:id/revoke` | POST | ISSUER only |
| `/api/shares` | GET | HOLDER only |
| `/api/shares/:id` | DELETE | HOLDER only |
| `/.well-known/jwks.json` | GET | Public (issuer keys) |
| `/api/issuer/metadata` | GET | Public (issuer info) |
| `/health` | GET | Public (deployment health) |
| `/docs` | GET | Swagger UI |

---

## 7. Environment Variables

```bash
# Runtime
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
API_INTERNAL_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revealid

# Authentication
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_SECRET=replace-with-secure-random-value
CSRF_SECRET=replace-with-secure-random-value

# Credential and key encryption
CREDENTIAL_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key
KEY_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key

# Issuer identity
ISSUER_NAME=Demo University
ISSUER_URL=http://localhost:3000
ISSUER_KEY_ID=demo-university-key-2026-01
ISSUER_PRIVATE_JWK_JSON=replace-in-deployment-secrets
ISSUER_PUBLIC_JWK_JSON=replace-in-deployment-secrets

# Presentation behaviour
VERIFY_AUDIENCE=http://localhost:3000/verify
DEFAULT_SHARE_TTL_MINUTES=15
MAX_SHARE_TTL_MINUTES=1440
DEFAULT_MAX_VIEWS=1

# Rate limiting
VERIFY_RATE_LIMIT_MAX=20
VERIFY_RATE_LIMIT_WINDOW=1 minute
```

<aside>
🔒

Never commit real issuer keys, cookie secrets or encryption keys.

</aside>

---

## 8. Documentation File Structure

```
docs/
├── architecture.md        # System architecture diagram + data flow
├── protocol.md            # Credential & presentation protocol details
├── threat-model.md        # Threats, mitigations, test requirements
├── deployment.md          # Deployment guide (Railway + Vercel)
├── demo-script.md         # 5-minute demo walkthrough
├── api-examples.md        # cURL / httpie examples for all endpoints
└── decisions/
    ├── ADR-001-sd-jwt-rfc9901.md
    ├── ADR-002-issuer-holder-separation.md
    ├── ADR-003-custodial-holder-key.md
    └── ADR-004-auth-and-cookie-model.md
```

---

## 9. Repository Structure

```
revealid/
├── AGENTS.md
├── README.md
├── SECURITY.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── docs/                          # (see above)
├── apps/
│   ├── web/                       # Next.js 16 frontend
│   │   ├── src/app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── wallet/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [credentialId]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── share/
│   │   │   ├── issuer/
│   │   │   │   ├── issue/
│   │   │   │   └── credentials/
│   │   │   ├── shares/
│   │   │   └── verify/[token]/
│   │   ├── src/components/
│   │   ├── src/lib/
│   │   └── e2e/
│   └── api/                       # Fastify 5 backend
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── config.ts
│       │   ├── plugins/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── issuers/
│       │   │   ├── credentials/
│       │   │   ├── presentations/
│       │   │   ├── verification/
│       │   │   ├── status/
│       │   │   └── audit/
│       │   ├── crypto/
│       │   │   ├── sd-jwt.service.ts
│       │   │   ├── key-management.service.ts
│       │   │   └── envelope-encryption.service.ts
│       │   └── db/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       ├── test/
│       │   ├── integration/
│       │   └── security/
│       └── Dockerfile
├── packages/
│   ├── contracts/                 # Shared TypeScript types
│   │   └── src/
│   └── crypto/                    # Shared crypto utilities
│       └── src/
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 10. README Structure

```markdown
# RevealID
Privacy-Preserving Academic Credential Wallet and Verifier

## Demo
## Problem
## Solution
## Key Features
## Standards Alignment
## Architecture
## Security Model
## Technology Stack
## Local Development
## Environment Variables
## API Documentation
## Testing
## Deployment
## Design Decisions
## Limitations and Future Work
```

---

## 11. Commit Plan

1. `chore: scaffold monorepo, tooling and agent instructions`
2. `feat(crypto): implement RFC 9901 selective-disclosure proof spike with key binding`
3. `feat(auth): add role-based authentication and database foundation`
4. `feat(credentials): implement issuer issuance and encrypted holder wallet`
5. `feat(presentations): add selective sharing, expiring links and QR generation`
6. `feat(verification): implement public verification, status checks and revocation`
7. `test(security): add tampering, replay, expiry and privacy regression tests`
8. `docs: add threat model, architecture, deployment guide and demo script`
9. `polish(ui): improve mobile verifier and holder sharing experience`

---

## 12. Deployment Architecture

| **Service** | **Provider** |
| --- | --- |
| Frontend | Vercel or Railway |
| API | Railway (Dockerfile) |
| PostgreSQL | Railway PostgreSQL |
| Secrets | Platform environment secrets |

<aside>
⚠️

**Authentication deployment:** Browser interacts only with the Next.js origin. Next.js proxies `/api/*` to Fastify. Auth cookies remain first-party. Solve this in Phase 1, not final day.

</aside>