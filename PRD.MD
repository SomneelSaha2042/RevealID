# RevealID OpenCerts Bridge MVP PRD

---

## 1. Product Narrative

RevealID is a privacy-preserving bridge for existing OpenCerts academic credentials. A holder uploads an OpenCerts `.opencert` file, RevealID verifies the source document, normalizes the academic claims, issues a RevealID-derived SD-JWT credential into the existing wallet, and lets the holder disclose only selected claims through an expiring, holder-bound share link.

The MVP builds on the current RevealID backend, crypto, wallet, sharing, verifier, Prisma, and CI infrastructure. It does not replace OpenCerts, original-institution issuance, or the existing RevealID SD-JWT selective-disclosure model.

The verifier should be able to confirm that:

- The source `.opencert` was verified before derivation
- The disclosed claims are included in a RevealID-derived SD-JWT credential
- Undisclosed claims are not revealed
- The public presentation is bound to the holder key
- The presentation is fresh and intended for this verifier
- The share link has not expired, been cancelled, or exceeded its view limit
- The derived credential has not been revoked in RevealID

---

## 2. Product and Protocol Invariants

RevealID must never reveal claims the holder did not explicitly disclose.

Use RFC 9901-style SD-JWT selective disclosure with mandatory holder key binding for public presentations. Do not replace this with JSON filtering, ad hoc hashing, or hand-built selective disclosure.

For the OpenCerts bridge:

- Verify before normalize, derive, store, or share
- Prefer local TrustVC verification by default
- Use the OpenCerts API only as an explicit fallback or diagnostic mode
- Treat every derived credential as a RevealID-derived proof, not an official institution-issued selective credential
- Never imply original-institution endorsement without an approved institutional `.opencert` and an explicit issuer policy update

---

## 3. Trust Model

| Actor | Capability |
| --- | --- |
| Original issuer | Issues the source OpenCerts credential outside RevealID |
| Holder | Uploads a source `.opencert`, stores a derived credential, and chooses disclosure fields |
| RevealID Demo issuer | Signs derived SD-JWT credentials after source verification |
| Verifier | Opens a public link or QR payload and receives disclosed claims only |

The MVP uses the public OpenCerts `sepolia.opencert` demo fixture for repeatable development and tests because no approved institutional `.opencert` is available yet. `INSTITUTION_ONLY` policy mode remains disabled until an approved institutional file can be validated against an allowlist.

---

## 4. MVP Flow

1. Holder signs in with the existing RevealID account system.
2. Holder uploads a `.opencert` JSON document.
3. API validates upload size and shape, hashes the source document, and verifies it through `SourceCredentialVerificationService`.
4. Local TrustVC verification is attempted first unless configuration explicitly selects the OpenCerts API fallback.
5. `OpenCertsImportService` rejects unverifiable, tampered, unsupported, or issuer-policy-failing documents.
6. `AcademicClaimNormalizer` unwraps OpenAttestation-style wrapped values and maps source fields into a conservative academic schema.
7. RevealID creates a derived SD-JWT credential with source provenance, a disclaimer, and selectively disclosable normalized claims.
8. The derived credential is stored using existing encrypted credential storage.
9. Holder shares selected fields through the existing `PresentationService`.
10. Public verifier receives only disclosed claims plus deterministic check results and a derived-proof disclaimer.

---

## 5. Example Source and Derived Claims

The public OpenCerts demo fixture contains academic-like data such as recipient details, course information, transcript rows, grades, student ID, transcript ID, issuer metadata, and document status evidence.

RevealID normalizes only the fields needed for selective disclosure and provenance:

```json
{
  "source": {
    "type": "OPENCERTS_V2",
    "sourceFileHash": "sha256:...",
    "verifiedAt": "2026-06-18T13:00:00+08:00",
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
  "academicCredential": {
    "recipientName": "Your Name",
    "institution": "Opencerts",
    "credentialName": "Opencerts Demo Certificate",
    "course": "OpenCerts Demo",
    "issuedOn": "2025-05-29T00:00:00+08:00",
    "graduationDate": "2025-08-01T00:00:00+08:00"
  },
  "privacy": {
    "hiddenByDefault": [
      "recipient.nric",
      "academicCredential.transcript",
      "academicCredential.additionalData.studentId",
      "academicCredential.additionalData.transcriptId"
    ]
  }
}
```

Transcript rows, grades, NRIC-like identifiers, student ID, and transcript ID are hidden by default and must never appear in verifier responses unless explicitly selected in a future supported disclosure template.

---

## 6. Standards Alignment

| Standard or ecosystem | How RevealID uses it |
| --- | --- |
| RFC 9901 SD-JWT | Core selective-disclosure and holder key-binding presentation mechanism |
| SD-JWT VC draft conventions | Credential typing with `vct` and SD-JWT VC-style payloads |
| OpenCerts / OpenAttestation | Source credential input format for the bridge MVP |
| TrustVC | Local verification adapter for OpenCerts/OpenAttestation-compatible documents |
| W3C VC Data Model v2.0 | Shared vocabulary for issuer, holder, verifier, credential, and presentation concepts |

The derived credential type for the bridge is `com.revealid.derivedAcademicCredential`.

---

## 7. What We Claim vs. What We Do Not Claim

### We Will Claim

- OpenCerts source verification before derivation
- RevealID-derived SD-JWT credential issuance
- Selective disclosure of normalized academic claims
- Holder-bound public presentations
- Expiring and view-limited share links
- Privacy-preserving verification responses that expose disclosed claims only
- A clear disclaimer separating original source verification from RevealID-derived proof issuance

### We Will Not Claim

- Official institutional selective-disclosure credential issuance
- Original-institution endorsement or integration
- Replacement for the OpenCerts verifier
- Verifiable PDF support in the MVP
- Zero-knowledge proofs
- Cryptographic proof of thresholds such as `CGPA >= 4.0` without revealing supporting data
- Browser-only non-custodial wallet keys in the MVP
- Trust in arbitrary JSON without OpenCerts/TrustVC verification

---

## 8. Submission Scope

| Capability | Required outcome |
| --- | --- |
| Baseline gate | Existing RevealID lint, typecheck, test, and build pass before bridge work |
| Source import | Holder can submit `.opencert` JSON to a typed authenticated route |
| Source verification | Local TrustVC default verifies document integrity, status, and issuer identity summary |
| API fallback | OpenCerts API fallback is opt-in and documented as an external transfer |
| Issuer policy | `DEMO` mode accepts the public fixture; `INSTITUTION_ONLY` rejects demo fixtures until enabled with real evidence |
| Normalization | Wrapped OA values map to deterministic normalized academic claims |
| Derived credential | Verified imports become RevealID-derived SD-JWT credentials using existing crypto boundaries |
| Holder wallet | Derived credentials appear in wallet with source provenance and disclaimer |
| Selective sharing | Existing share flow supports derived credential claim keys |
| Public verifier | Verifier sees disclosed fields only, proof checks, and derived-proof disclaimer |
| Privacy | Raw source files are not retained by default and never returned after import |
| Testing | Valid, tampered, hidden-claim, issuer-policy, and e2e privacy tests are added by phase |

---

## 9. Phased Build Plan and Gates

Each phase must finish behind the standard gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm test:e2e` once UI work begins.

| Phase | Goal | Deliverables | Gate additions |
| --- | --- | --- | --- |
| 0. Baseline lock | Prove current repo health before bridge work | Current `pnpm verify` result documented | No OpenCerts code yet |
| 1. Import boundary and contracts | Establish typed bridge boundary | Contracts, route skeleton, import model plan, fixture policy, docs | Schema and route validation tests |
| 2. Verification and normalization | Make source import meaningful | `OpenCertsImportService`, `SourceCredentialVerificationService`, `AcademicClaimNormalizer`, TrustVC adapter, optional API fallback | Valid fixture, malformed input, tampered fixture, issuer policy tests |
| 3. Derived credential issuance | Connect verified imports to RevealID wallet | Derived SD-JWT payload, provenance, disclaimer, encrypted storage | Hidden-claim and provenance tests |
| 4. Wallet/share/verifier UX | Expose bridge in the existing app | Import screen, claim review, wallet provenance display, verifier disclaimer | Playwright happy path and privacy path |
| 5. Hardening and demo | Make external review credible | Redaction checks, failure UX, demo script, deployment notes, CI import smoke | Full CI and demo runbook |

Do not start the next phase until the current phase gate is green or the blocker is documented with a concrete fix.

---

## 10. Technology Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Package management | `pnpm` workspaces | Existing deterministic monorepo |
| Frontend | Next.js 16, React, TypeScript | Existing app and first-party `/api/*` proxy |
| Backend | Fastify 5, TypeScript, Zod | Existing API, schema validation, Swagger docs |
| Database | PostgreSQL, Prisma | Existing credential, share, audit persistence |
| Source verification | `@trustvc/trustvc` | Local OpenCerts/OpenAttestation-compatible verification |
| Fallback verification | OpenCerts API `/verify` | Explicit diagnostic fallback, not default |
| Selective disclosure | `@sd-jwt/core`, `@sd-jwt/sd-jwt-vc`, `jose` | Existing RFC 9901-style issuance and presentation |
| Encryption | `EnvelopeEncryptionService` | Existing encrypted credential and presentation storage |
| Testing | Vitest, Playwright | Existing unit, integration, and e2e gates |
| Deployment | Railway and Docker | Existing deployment model |

---

## 11. Data Model Additions

The existing `Credential`, `Share`, and `VerificationAudit` models remain the downstream wallet and verification backbone.

Planned bridge model:

```text
SourceCredentialImport
  id
  holderId
  sourceType
  sourceFileHash
  verificationMode
  issuerPolicyMode
  verificationSummary
  normalizedClaims
  hiddenByDefault
  encryptedSourceDocument nullable
  sourceRetentionExpiresAt nullable
  derivedCredentialId nullable
  status
  createdAt
  verifiedAt nullable
```

Storage defaults:

- Store source hash, verification summary, normalized preview, and import status
- Do not retain raw source documents by default
- If retention is explicitly enabled, store only encrypted source content with a retention expiry
- Do not store raw share tokens, full SD-JWT presentations, plaintext transcript rows in audit logs, or secrets

---

## 12. Protocol and Service Boundaries

Routes must not call TrustVC, OpenCerts API clients, JOSE, SD-JWT libraries, or hashing/encryption primitives directly.

Required service flow:

```text
Route -> OpenCertsImportService
OpenCertsImportService -> SourceCredentialVerificationService
OpenCertsImportService -> AcademicClaimNormalizer
OpenCertsImportService -> CredentialService / CredentialCryptoService
Presentation routes -> PresentationService
Private keys -> KeyManagementService
Ciphertext -> EnvelopeEncryptionService
Revocation/status -> CredentialStatusService
```

Presentation creation and verification continue to use the existing holder key-binding, audience, nonce, expiry, view-limit, and revocation checks.

---

## 13. API Decisions

### Import OpenCerts

`POST /imports/opencerts`

Authenticated holder route. Accepts:

```json
{
  "fileName": "sepolia.opencert",
  "document": {},
  "verificationMode": "LOCAL_TRUSTVC",
  "issuerPolicyMode": "DEMO",
  "retainEncryptedSource": false
}
```

Returns a typed import result with source hash, verification summary, normalized claim preview, hidden-by-default fields, and disclaimer. It must not return the full source document.

### Derive From Import

`POST /imports/opencerts/:importId/derive`

Authenticated holder route. Accepts:

```json
{
  "credentialTemplate": "GRADUATION_PROOF"
}
```

Creates a wallet credential with `vct: com.revealid.derivedAcademicCredential` and returns the credential ID plus hidden-by-default fields.

Existing `/credentials/share` and `/credentials/verify` remain the public selective-disclosure path.

---

## 14. Threat Model Additions

| Threat | Protection | Test required |
| --- | --- | --- |
| Arbitrary JSON masquerades as OpenCerts | Verify before normalize and reject failed verification | Malformed and unverifiable uploads fail |
| Source credential is tampered | TrustVC/OpenCerts verification must fail | Modified sample fixture is rejected |
| Demo app implies original-institution endorsement | Explicit derived-proof disclaimer and disabled `INSTITUTION_ONLY` mode | Verifier UI and API include disclaimer |
| External verification leaks uploaded source | Local TrustVC default; API fallback opt-in only | Fallback requires explicit config/request |
| Transcript or identifiers leak | Hidden-by-default fields and verifier response guards | Transcript, grades, NRIC, student ID absent unless selected |
| Raw source retained indefinitely | No retention by default; encrypted TTL if enabled | Database/audit privacy tests |
| Existing share replay | Reuse audience, nonce, expiry, max views, cancellation | Existing plus derived credential tests |

---

## 15. UX Design

### Holder Import

The holder sees an import page that accepts `.opencert` JSON, shows source verification results, and clearly states that RevealID creates a derived proof rather than an official credential from the original issuer.

### Claim Review

The holder sees normalized claims grouped as shared-ready fields and hidden-by-default fields. Transcript rows, grades, NRIC-like identifiers, student ID, and transcript ID should visually start in the hidden group.

### Wallet

Derived credentials appear beside existing credentials, with source type, source hash prefix, verification timestamp, original issuer name if available, and disclaimer.

### Sharing

The existing share form is reused after claim keys are generalized for derived credentials. Templates should include at least:

- Graduation proof
- Institution/course proof
- Custom proof

### Public Verifier

The verifier page must show only disclosed claims, deterministic checks, and this disclaimer:

> This is a RevealID-derived proof created from a user-provided OpenCerts file. It is not an official credential issued by the original institution.

---

## 16. Demo Script

1. Sign in as the demo holder.
2. Upload the public `sepolia.opencert` fixture.
3. Show document integrity, document status, and issuer identity summary.
4. Show normalized claims and hidden-by-default transcript/identifier fields.
5. Derive a RevealID credential.
6. Share only recipient, institution, course, and graduation date.
7. Open the verifier page and show disclosed claims only.
8. Upload a tampered fixture and show rejection.
9. Switch to `INSTITUTION_ONLY` mode in a controlled test/demo and show the public demo fixture is rejected.

---

## 17. References

- RFC 9901 SD-JWT: https://www.rfc-editor.org/rfc/rfc9901.html
- TrustVC: https://github.com/TrustVC/trustvc
- OpenCerts verify API: https://github.com/OpenCerts/opencerts-functions
- OpenCerts demo fixture: https://github.com/OpenCerts/opencerts-website/blob/master/public/static/demo/sepolia.opencert
