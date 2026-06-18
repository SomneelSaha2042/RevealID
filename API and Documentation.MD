# RevealID API Contract and Documentation Structure

---

## 1. Route Framing

RevealID has two route surfaces:

- Browser clients call the Next.js web app through first-party `/api/*` proxy routes.
- The Fastify API service exposes the underlying routes without the `/api` prefix.

Examples:

| Browser-facing path | Fastify API path | Purpose |
| --- | --- | --- |
| `/api/auth/login` | `/auth/login` | Login through first-party web origin |
| `/api/wallet/credentials` | `/wallet/credentials` | Holder wallet metadata |
| `/api/credentials/share` | `/credentials/share` | Create a selective-disclosure share |
| `/api/credentials/verify` | `/credentials/verify` | Public token verification |

Documentation should name Fastify routes as canonical API contracts and mention the `/api/*` web proxy for browser calls.

All request and response bodies must be explicitly defined in route schemas and shared contracts where practical.

---

## 2. Authentication Endpoints

### `POST /auth/register`

Holder registration only.

```json
{
  "email": "holder@example.edu",
  "password": "StrongPassword123!",
  "name": "Holder Example"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "holder@example.edu",
    "name": "Holder Example",
    "role": "HOLDER"
  },
  "csrfToken": "csrf-token"
}
```

### `POST /auth/login`

```json
{
  "email": "holder@example.edu",
  "password": "StrongPassword123!"
}
```

Response shape matches register.

### Additional Auth Routes

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/auth/logout` | POST | Authenticated | Revoke current session and clear cookies |
| `/me` | GET | Authenticated | Return current user |

Access and refresh tokens are delivered through HTTP-only cookies. Access tokens must not be stored in browser `localStorage`.

---

## 3. Existing Issuance Endpoints

### `POST /credentials/issue`

Restricted to `ISSUER` role and CSRF-protected.

Current core credential request:

```json
{
  "holderEmail": "holder@example.edu",
  "degree": "BSc Computer Science",
  "graduationYear": 2026,
  "cgpa": 4.72,
  "marks": 9120
}
```

Response:

```json
{
  "credential": {
    "id": "uuid",
    "holderId": "uuid",
    "issuerId": "uuid",
    "credentialType": "RevealIDAcademicCredential",
    "issuerName": "Demo University",
    "issuedAt": "2026-05-28T12:00:00.000Z"
  }
}
```

This route remains for the existing demo-university credential flow. The OpenCerts bridge must not overload this route for source import.

### `GET /issuer/credentials`

Restricted to `ISSUER` role. Returns issuer-owned credential metadata for revocation UI. It must not return credential blobs, SD-JWTs, presentations, or undisclosed claims.

### `POST /credentials/:id/revoke`

Restricted to `ISSUER` role and CSRF-protected. Revoked credentials fail future public verification.

---

## 4. OpenCerts Import Endpoints

These endpoints are new for the bridge and must be implemented behind `OpenCertsImportService`.

### `POST /imports/opencerts`

Authenticated holder route. CSRF-protected. Phase 1 accepts a source `.opencert` JSON document and records a pending import boundary without retaining the raw source. Phase 2 adds TrustVC verification before normalization or derivation.

Request:

```json
{
  "fileName": "sepolia.opencert",
  "document": {},
  "verificationMode": "LOCAL_TRUSTVC",
  "issuerPolicyMode": "DEMO",
  "retainEncryptedSource": false
}
```

Field rules:

| Field | Required | Notes |
| --- | --- | --- |
| `fileName` | Yes | Must end in `.opencert` for MVP |
| `document` | Yes | Parsed JSON object, not a stringified file |
| `verificationMode` | No | `LOCAL_TRUSTVC` default; `OPENCERTS_API` explicit fallback |
| `issuerPolicyMode` | No | `DEMO` default; `NUS_ONLY` rejects demo fixtures until real NUS allowlist exists |
| `retainEncryptedSource` | No | Defaults to `false` |

Phase 1 pending response:

```json
{
  "importId": "uuid",
  "status": "pending_verification",
  "source": {
    "type": "UNKNOWN",
    "sourceFileHash": "sha256:base64url-or-hex",
    "verificationMode": "LOCAL_TRUSTVC",
    "issuerPolicyMode": "DEMO"
  },
  "hiddenByDefault": [
    "recipient.nric",
    "academicCredential.transcript",
    "academicCredential.additionalData.studentId",
    "academicCredential.additionalData.transcriptId"
  ],
  "disclaimer": "This is a RevealID-derived proof created from a user-provided OpenCerts file. It is not an official credential issued by the original institution."
}
```

Phase 2 verified response:

```json
{
  "importId": "uuid",
  "source": {
    "type": "OPENCERTS_V2",
    "sourceFileHash": "sha256:base64url-or-hex",
    "verifiedAt": "2026-06-18T13:00:00.000Z",
    "verificationMode": "LOCAL_TRUSTVC",
    "issuerPolicyMode": "DEMO",
    "verification": {
      "all": true,
      "documentIntegrity": true,
      "documentStatus": true,
      "issuerIdentity": true
    },
    "originalIssuerName": "Opencerts",
    "originalIdentityLocation": "dev.opencerts.io",
    "sampleMode": true
  },
  "normalizedClaims": {
    "recipientName": "Your Name",
    "institution": "Opencerts",
    "credentialName": "Opencerts Demo Certificate",
    "course": "OpenCerts Demo",
    "issuedOn": "2025-05-29T00:00:00+08:00",
    "graduationDate": "2025-08-01T00:00:00+08:00"
  },
  "hiddenByDefault": [
    "recipient.nric",
    "academicCredential.transcript",
    "academicCredential.additionalData.studentId",
    "academicCredential.additionalData.transcriptId"
  ],
  "disclaimer": "This is a RevealID-derived proof created from a user-provided OpenCerts file. It is not an official credential issued by the original institution."
}
```

Failure response:

```json
{
  "status": "invalid",
  "failureCode": "source_verification_failed",
  "message": "The OpenCerts source document could not be verified.",
  "checks": [
    {
      "id": "documentIntegrity",
      "status": "failed"
    }
  ]
}
```

Failure codes:

| Code | Meaning |
| --- | --- |
| `malformed_source` | Upload is not valid JSON/object shape or exceeds size limits |
| `unsupported_source_type` | Not an accepted `.opencert`/OpenCerts shape |
| `source_verification_failed` | Integrity, status, or issuer identity did not pass |
| `issuer_policy_failed` | Source issuer is not allowed by selected policy |
| `external_verification_unavailable` | OpenCerts API fallback failed or timed out |

Privacy rules:

- Do not return the full source document
- Do not return encrypted source blobs
- Do not log source contents
- Do not derive credentials from failed imports

### `POST /imports/opencerts/:importId/derive`

Authenticated holder route. CSRF-protected. Converts a verified import into a RevealID-derived SD-JWT credential.

Request:

```json
{
  "credentialTemplate": "GRADUATION_PROOF"
}
```

Allowed `credentialTemplate` values:

| Value | Purpose |
| --- | --- |
| `GRADUATION_PROOF` | Recipient, institution, credential/course, graduation date |
| `INSTITUTION_COURSE_PROOF` | Institution and course/credential title |
| `CUSTOM` | Uses holder-selected supported claims |

Response:

```json
{
  "credentialId": "uuid",
  "walletStatus": "STORED",
  "credentialType": "RevealIDDerivedAcademicCredential",
  "vct": "com.revealid.derivedAcademicCredential",
  "hiddenByDefault": [
    "recipient.nric",
    "academicCredential.transcript",
    "academicCredential.additionalData.studentId",
    "academicCredential.additionalData.transcriptId"
  ]
}
```

Rules:

- Only the holder who created the import can derive from it
- Import must be verified and not already failed
- Derived credentials are signed by RevealID Demo issuer, not the original institution
- Derived credentials must include source provenance and the disclaimer
- Derived credentials use existing encrypted credential storage

---

## 5. Wallet Endpoints

### `GET /wallet/credentials`

Authenticated holder route. Returns non-sensitive metadata only.

```json
{
  "credentials": [
    {
      "id": "uuid",
      "credentialType": "RevealIDDerivedAcademicCredential",
      "issuerName": "Demo University",
      "issuedAt": "2026-06-18T13:05:00.000Z",
      "expiresAt": null,
      "revokedAt": null
    }
  ]
}
```

### `GET /wallet/credentials/:id`

Authenticated holder route. Returns credential detail needed to build a share form. It must not return encrypted SD-JWT blobs or private keys.

For derived credentials, response detail should include supported disclosure claim keys and provenance metadata safe for holder review. Future implementation must generalize the current hardcoded core claim enum.

---

## 6. Sharing Endpoints

### `POST /credentials/share`

Authenticated holder route. CSRF-protected. Reused for both existing demo credentials and OpenCerts-derived credentials once claim-key support is generalized.

Current core credential request:

```json
{
  "credentialId": "uuid",
  "claims": ["degree", "graduationYear"],
  "audience": "https://example-verifier.test",
  "ttlMinutes": 15,
  "maxViews": 1
}
```

Derived credential request example:

```json
{
  "credentialId": "uuid",
  "claims": [
    "recipientName",
    "institution",
    "course",
    "graduationDate"
  ],
  "ttlMinutes": 15,
  "maxViews": 1
}
```

Response:

```json
{
  "share": {
    "id": "uuid",
    "verificationUrl": "https://revealid.app/verify/<opaque-token>",
    "qrPayload": "https://revealid.app/verify/<opaque-token>",
    "expiresAt": "2026-06-18T13:20:00.000Z",
    "maxViews": 1,
    "disclosedClaims": [
      "recipientName",
      "institution",
      "course",
      "graduationDate"
    ]
  }
}
```

Security rules:

- Store only SHA-256 hash of the opaque token
- Store encrypted presentation only
- Do not include hidden claim names or values in the response unless selected
- Continue enforcing holder ownership, expiry, cancellation, max views, audience, nonce, and holder key binding

### `GET /shares`

Authenticated holder route. Returns share history metadata only.

### `DELETE /shares/:id`

Authenticated holder route. CSRF-protected. Cancels a share.

---

## 7. Verification Endpoints

### `POST /credentials/verify`

Public but rate-limited. Verifies an opaque share token.

Request:

```json
{
  "token": "<opaque-token>"
}
```

Verified response for a derived credential:

```json
{
  "status": "verified",
  "credentialType": "RevealIDDerivedAcademicCredential",
  "issuerName": "Demo University",
  "issuedAt": "2026-06-18T13:05:00.000Z",
  "audience": "http://localhost:3000/verify",
  "expiresAt": "2026-06-18T13:20:00.000Z",
  "claims": {
    "recipientName": "Your Name",
    "institution": "Opencerts",
    "course": "OpenCerts Demo",
    "graduationDate": "2025-08-01T00:00:00+08:00"
  },
  "source": {
    "format": "opencert",
    "sourceType": "OPENCERTS_V2",
    "sourceFileHashPrefix": "sha256:abcd1234",
    "verificationSummary": {
      "documentIntegrity": true,
      "documentStatus": true,
      "issuerIdentity": true
    },
    "originalIssuerName": "Opencerts",
    "sampleMode": true
  },
  "checks": [
    {
      "id": "issuer_signature",
      "label": "Issuer signature verified",
      "status": "passed"
    }
  ],
  "disclaimer": "This is a RevealID-derived proof created from a user-provided OpenCerts file. It is not an official credential issued by the original institution."
}
```

Invalid response:

```json
{
  "status": "invalid",
  "failureCode": "expired",
  "message": "This share link has expired.",
  "checks": []
}
```

Verification must never return:

- Full source `.opencert`
- Encrypted source blob
- Full SD-JWT credential
- Full presentation
- Raw share token
- Undisclosed transcript rows
- Undisclosed grades
- Undisclosed NRIC-like identifiers
- Undisclosed student ID or transcript ID

---

## 8. Metadata and Operational Endpoints

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/.well-known/jwks.json` | GET | Public | RevealID issuer keys |
| `/issuer/metadata` | GET | Public | RevealID issuer metadata |
| `/health` | GET | Public | Deployment health |
| `/docs` | GET | Public | Swagger UI |

`/issuer/metadata` should include both existing and derived credential types once the bridge is implemented:

```json
{
  "issuer": "https://api.revealid.app",
  "name": "Demo University",
  "jwksUri": "https://api.revealid.app/.well-known/jwks.json",
  "credentialTypes": [
    "RevealIDAcademicCredential",
    "RevealIDDerivedAcademicCredential"
  ]
}
```

---

## 9. Environment Variables

```bash
# Runtime
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=/api

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revealid

# Authentication
AUTH_ACCESS_TOKEN_SECRET=replace-with-secure-random-value
AUTH_REFRESH_TOKEN_SECRET=replace-with-secure-random-value
COOKIE_SECURE=false

# Credential and key encryption
CREDENTIAL_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key
KEY_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key

# Issuer identity
ISSUER_NAME=Demo University
ISSUER_URL=http://localhost:4000
ISSUER_KEY_ID=demo-university-key-2026-01
ISSUER_PRIVATE_JWK_JSON=replace-in-deployment-secrets
ISSUER_PUBLIC_JWK_JSON=replace-in-deployment-secrets

# Presentation behaviour
VERIFY_AUDIENCE=http://localhost:3000/verify
DEFAULT_SHARE_TTL_MINUTES=15
MAX_SHARE_TTL_MINUTES=1440
DEFAULT_MAX_VIEWS=1
VERIFY_RATE_LIMIT_MAX=20
VERIFY_RATE_LIMIT_WINDOW=1 minute

# OpenCerts bridge
OPENCERTS_VERIFICATION_MODE=LOCAL_TRUSTVC
OPENCERTS_ISSUER_POLICY_MODE=DEMO
OPENCERTS_API_VERIFY_URL=https://api.opencerts.io/verify
MAX_OPENCERTS_UPLOAD_BYTES=1048576
OPENCERTS_RETAIN_SOURCE=false
OPENCERTS_SOURCE_RETENTION_DAYS=31
```

Never commit real issuer keys, cookie secrets, encryption keys, private keys, raw source credentials, or access/refresh tokens.

---

## 10. Documentation File Structure

```text
docs/
  architecture.md
  protocol.md
  threat-model.md
  deployment-railway.md
  repository-audit.md
  api.md
  demo-script.md                 # add during Phase 5
  api-examples.md                # add during Phase 5
  decisions/
    ADR-001-sd-jwt-rfc9901.md
    ADR-002-opencerts-bridge.md  # add before protocol implementation
```

Required doc updates by phase:

| Phase | Documentation |
| --- | --- |
| 0 | Record baseline gate result if relevant |
| 1 | Add import contracts and ADR draft |
| 2 | Document TrustVC verification, fallback API, issuer policy |
| 3 | Document derived SD-JWT payload and source provenance |
| 4 | Document wallet/share/verifier UX and privacy copy |
| 5 | Add demo script, API examples, deployment notes, threat-model additions |

---

## 11. Repository Structure Notes

Current repo shape should be preserved:

```text
apps/
  api/          Fastify API, Prisma schema, auth, routes, credential services
  web/          Next.js issuer, holder, sharing, import, and verifier UI
packages/
  contracts/    Shared Zod request and response schemas
  crypto/       SD-JWT issuance, presentation, and verification service
docs/
  decisions/    ADRs
tests/
  e2e/          Playwright full-stack browser tests
```

Planned bridge additions should fit into existing boundaries:

```text
apps/api/src/imports/
  opencerts-import-service.ts
  source-credential-verification-service.ts
  academic-claim-normalizer.ts
  issuer-policy.ts

apps/api/src/routes/
  import-routes.ts

samples/opencerts/
  sepolia.opencert
```

Do not move existing credential, presentation, key, or encryption services unless a later refactor is explicitly planned and gated.

---

## 12. Commit Plan

1. `docs: define opencerts bridge phases and gates`
2. `feat(imports): add opencerts import contracts and persistence`
3. `feat(imports): verify and normalize opencerts documents`
4. `feat(credentials): derive revealid sd-jwt credentials from imports`
5. `feat(web): add opencerts import and claim review flow`
6. `test(security): cover opencerts tampering and privacy regressions`
7. `docs: add bridge demo script and deployment notes`

---

## 13. Acceptance Tests

| Scenario | Expected result |
| --- | --- |
| Valid public `sepolia.opencert` import | Source verifies, import record is stored, normalized preview returned |
| Tampered source fixture | Import is rejected and no derived credential is created |
| `NUS_ONLY` with public demo fixture | Import is rejected by issuer policy |
| Derive from verified import | Wallet credential is created with source provenance and disclaimer |
| Share selected derived claims | Share response contains selected claim keys only |
| Verify derived share | Verifier response shows disclosed claims, proof checks, source summary, and disclaimer |
| Hidden transcript/IDs/grades | Absent from verifier response, audit records, and logs unless explicitly disclosed in a supported template |
| OpenCerts API fallback unavailable | Clean error, no derived credential, no source content logged |
