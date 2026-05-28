## Product Requirements Document

---

## 1. Product Narrative

A university issues a signed academic credential to a student. The student stores it in a digital wallet and chooses exactly which claims to disclose to an employer. The employer receives a QR/share link and verifies that:

- The disclosed claims were signed by the issuer
- Undisclosed claims were not revealed
- The presentation belongs to the credential holder
- The presentation is fresh and intended for this verifier
- The credential has not been revoked
- The share link has not expired

---

## 2. Trust Model

<aside>
🏛️

A holder should **not** issue their own university degree credential. The application separates issuer and holder roles with a seeded "Demo University" issuer account.

</aside>

| **Actor** | **Capability** |
| --- | --- |
| **Issuer** | Issues and revokes signed academic credentials |
| **Holder** | Stores credentials and creates selective-disclosure presentations |
| **Verifier** | Opens a public link or scans QR code and verifies disclosed claims |

---

## 3. Example Credential

**Full credential (issuer-signed):**

```json
{
  "name": "Somneel Kumar Saha",
  "degree": "Bachelor of Computing",
  "major": "Computer Science and Quantitative Finance",
  "graduationYear": 2027,
  "cgpa": "4.07/5.00",
  "studentId": "A0XXXXXXX",
  "issuerName": "Demo University",
  "issueDate": "2026-05-28"
}
```

**Holder discloses only:**

```json
{
  "degree": "Bachelor of Computing",
  "major": "Computer Science and Quantitative Finance",
  "graduationYear": 2027
}
```

---

## 4. Standards Alignment

| **Standard** | **How We Use It** |
| --- | --- |
| RFC 9901: SD-JWT | Core selective-disclosure mechanism |
| W3C VC Data Model v2.0 | Actor model and credential/presentation terminology |
| SD-JWT VC draft-16 | Credential metadata conventions (type, issuer discovery) |
| OpenID4VP 1.0 | Post-submission extension only, not MVP |

**README claim language:**

> Implemented using RFC 9901 SD-JWT selective disclosure and aligned with the current SD-JWT VC draft conventions.
> 

---

## 5. What We Claim vs. What We Don't

### We Will Claim

- Selective disclosure of credential claims
- Issuer-signed credential integrity
- Holder-bound presentations
- Replay-resistant expiring share sessions
- Credential revocation checks
- Privacy-preserving verification (hidden fields never in presentation)

### We Will NOT Claim

- Zero-knowledge proofs
- Cryptographic proof that `CGPA >= 4.0` without revealing CGPA
- Production government identity compatibility
- Aadhaar authentication
- Deepfake or fraud detection
- Blockchain-backed trust

<aside>
💡

For threshold checks, the issuer can issue an additional boolean claim like `"meetsHonoursRequirement": true` — the holder discloses that without revealing exact CGPA.

</aside>

---

## 6. Submission Scope (Must Ship)

| **Capability** | **Required Outcome** |
| --- | --- |
| Authentication | Register, login, logout, protected routes, role separation |
| Issuer console | Issue an academic credential to a holder |
| Holder wallet | View owned credentials without leaking sensitive claims |
| Selective disclosure | Holder selects claims and creates an SD-JWT presentation |
| QR / share link | Time-limited public verification URL as QR |
| Public verifier | Shows disclosed fields only + deterministic verification checks |
| Credential status | Issuer revokes; verifier sees revocation failure |
| Link controls | Expiry and cancellation of share link |
| Security | Input validation, encryption at rest, rate limiting, token hashing, safe logging |
| API docs | Swagger/OpenAPI and README |
| Testing | Positive and adversarial crypto/integration tests |
| Deployment | Fully deployed working flow |
| Demo | Five-minute coherent demonstration |

---

## 7. Strong Differentiators (If Core Is Stable)

| **Feature** | **Portfolio Value** |
| --- | --- |
| JWKS endpoint for issuer key discovery | Shows real verification architecture |
| Holder key binding with audience + nonce | Demonstrates protocol depth |
| PII-safe verification audit events | Strong link to PwC governance experience |
| One-use / max-view share sessions | Strong privacy UX |
| Seeded demo walkthrough | Makes evaluator testing trivial |
| Threat model + ADR documentation | Excellent engineering signal |

---

## 8. Explicitly Postponed

| **Feature** | **Why Postponed** |
| --- | --- |
| Browser-only non-custodial wallet key storage | Adds device recovery + browser key-management complexity |
| OpenID4VP request flows | Good extension, not needed to prove core value |
| BBS+ signatures | Impressive but unnecessary complexity |
| Token status list standardisation | Implement basic status/revocation first |
| QR camera scanner | QR generation + public link verification is enough |
| Redis distributed rate limiting | Only if deploying multiple API instances |

---

## 9. Technology Stack

**Decision: All-TypeScript monorepo** — coherent with 2FAst experience, shared schemas, single ecosystem for Codex.

| **Layer** | **Technology** | **Why** |
| --- | --- | --- |
| Package mgmt | `pnpm` workspaces | Fast, deterministic monorepo |
| Frontend | Next.js 16, TypeScript, Tailwind, shadcn/ui | Modern, deployable, agent-friendly |
| Backend | Fastify 5 + TypeScript | Lightweight, schema-driven API |
| Database | PostgreSQL + Prisma | Relational model for creds/sessions/audit |
| SD-JWT | `@sd-jwt/core`, `@sd-jwt/sd-jwt-vc` | RFC 9901-style flows |
| JOSE / Ed25519 | `jose` | Mature JOSE primitives |
| Password hashing | `argon2` | Appropriate password hashing |
| Validation | TypeBox (API) / Zod (forms) | Schema-first APIs + good UI validation |
| API docs | `@fastify/swagger`  • `@fastify/swagger-ui` | Auto-generated OpenAPI |
| Rate limiting | `@fastify/rate-limit` | Verification endpoint protection |
| Security headers | `@fastify/helmet` | Baseline HTTP security |
| QR | `qrcode.react` | Fast QR generation |
| Testing | Vitest, Playwright | Unit + integration + E2E |
| Local env | Docker Compose | Reproducible dev environment |
| Deployment | Railway (API/Postgres), Vercel (web) | Straightforward public deployment |

---

## 10. Authentication & Key Management Model

### Authentication

- Argon2id password hashing
- 15-minute access token
- Refresh token rotation
- HTTP-only secure cookies with SameSite
- CSRF token for state-changing authenticated requests
- Role checks for issuer endpoints
- **No** bearer access tokens in browser `localStorage`

### Issuer Signing Keys

- Ed25519 issuer key pair
- Public key exposed through JWKS
- Private key stored as deployment secret or encrypted server-side
- Every credential includes the issuer `kid`

### Holder Key Model (Submission — Custodial)

- Ed25519 key pair generated at account setup
- Public key included in issued credentials (`cnf` claim)
- Private key encrypted at rest with AES-256-GCM + server-side master key
- Presentation generation requires authenticated holder action
- README explicitly documents this as an MVP trade-off

### Post-Submission Upgrade (Non-Custodial)

- Move holder key generation into browser WebCrypto
- Store private key in IndexedDB
- Server never accesses the holder private key
- Holder signs key-binding JWT locally

---

## 11. Database Model (Core Prisma Entities)

```
enum UserRole { HOLDER, ISSUER }
enum CredentialStatus { ACTIVE, REVOKED, EXPIRED }

User → id, email, passwordHash, role, createdAt
  → HolderKey (1:1) → publicJwk, encryptedPrivateJwk, encryptionIv/Tag
  → Credential[] (as holder)
  → ShareSession[]

Issuer → id, name, issuerUrl, keyId, publicJwk, encryptedPrivateJwk
  → Credential[]

Credential → id, holderId, issuerId, type, encryptedSdJwt,
             encryptionIv/Tag, displayMetadata, status, issuedAt,
             expiresAt, revokedAt
  → ShareSession[]

ShareSession → id, credentialId, holderId, tokenHash,
               encryptedPresentation, encryptionIv/Tag,
               disclosedFields[], audience, nonce, expiresAt,
               maxViews, viewCount, cancelledAt
  → VerificationAudit[]

VerificationAudit → id, shareSessionId, checkedAt, outcome,
                    checks (JSON), requesterHash
```

<aside>
🔒

**Data protection rule:** Do not store raw CGPA, marks or student ID as searchable database columns. Store only encrypted credential blobs, minimal non-sensitive display metadata, and no disclosed values in long-lived audit logs.

</aside>

---

## 12. Credential & Presentation Protocol

### 12.1 Issuance

**Non-selective technical claims** (always in signed metadata):

```json
{
  "iss": "https://issuer.revealid.app",
  "sub": "holder-user-id",
  "iat": 1780000000,
  "exp": 1811536000,
  "vct": "https://revealid.app/credentials/academic-degree/v1",
  "credentialId": "uuid",
  "cnf": { "jwk": { "...": "holder public key" } }
}
```

**Selectively disclosable claims:** name, degree, major, graduationYear, cgpa, studentId, honoursEligible, issuerName, issueDate

The SD-JWT credential is encrypted before storage.

### 12.2 Sharing

Holder chooses disclosure fields → backend confirms ownership → validates fields → creates opaque 256-bit share token → creates nonce + audience → builds SD-JWT presentation with holder key binding → encrypts presentation → stores only token hash → returns verification URL + QR payload.

### 12.3 Verification

Verifier opens `/verify/<opaque-token>` → API hashes token → finds share session → rejects invalid states → decrypts presentation → verifies issuer signature → verifies claim digests → verifies holder key binding → checks nonce/audience → checks expiry → checks revocation → returns disclosed claims only → records privacy-safe audit event.

### 12.4 Verification Report

```json
{
  "status": "verified",
  "disclosedClaims": {
    "degree": "Bachelor of Computing",
    "graduationYear": 2027
  },
  "issuer": {
    "name": "Demo University",
    "trustStatus": "Trusted demo issuer"
  },
  "checks": {
    "issuerSignature": "passed",
    "selectiveDisclosureIntegrity": "passed",
    "holderBinding": "passed",
    "audienceBinding": "passed",
    "freshness": "passed",
    "credentialStatus": "active",
    "shareLinkStatus": "valid"
  }
}
```

<aside>
⚠️

Verification UI must state: *"Verification confirms signed provenance and integrity of the disclosed claims. It does not independently validate the issuer's original real-world records."*

</aside>

---

## 13. Threat Model Summary

| **Threat** | **Protection** | **Test Required** |
| --- | --- | --- |
| Verifier tampers with disclosed degree | SD-JWT digest/signature verification | Modified claim must fail |
| Attacker adds undisclosed CGPA | Reject unreferenced disclosures | Injected claim must fail |
| Attacker removes presentation proof | Require holder key binding | Missing binding must fail |
| Copied QR link reused | Expiry, max views, one-time consumption | Second use must fail |
| Presentation sent to wrong verifier | Audience binding | Wrong audience must fail |
| Stale/replayed presentation | Nonce + expiry checks | Wrong nonce must fail |
| Revoked credential reused | Status check on verification | Revoked credential must fail |
| Database leaked | Encrypt credentials + keys at rest | No plaintext sensitive claims in DB |
| Token guessed / stored raw | 256-bit random token; store hash only | Raw token absent from database |
| Verification endpoint abuse | Rate limiting + generic failures | Rate-limit integration test |
| Sensitive values leaked in logs | Log redaction + PII-free audits | Logging inspection |
| User self-issues fake credential | Issuer role separation | Holder issuance rejected |
| Cross-site request attacks | Cookie model + CSRF protection | Missing CSRF rejected |

---

## 14. UX Design

### Public Landing Page

- Explain selective disclosure simply
- Offer demo roles: "Try as University Issuer" / "Try as Student Holder" / "Open verification sample"
- Show the privacy principle: share degree → hide CGPA → verify authenticity

### Issuer Workflow

Sign in as Demo University → Issue Credential → Enter holder email + claims → Confirm signing → Credential issued → View active/revoked credentials

### Holder Workflow

Register/sign in → Wallet shows credential → Select Share → Checkbox disclosure screen → Review "Shared" vs "Hidden" fields → Select expiry / one-use → Generate QR and link

**Key UI moment — clear split:**

| **Shared with Verifier** | **Kept Private** |
| --- | --- |
| Degree | CGPA |
| Graduation year | Marks |
| Honours eligibility | Student ID |

### Verifier Workflow

Open public link → Verification in progress → Verified / Invalid result → View disclosed claims only → View deterministic proof checks

### Invalid-State Demos

Polished failure pages for: expired link, cancelled share, revoked credential, tampered presentation, malformed/unknown token.