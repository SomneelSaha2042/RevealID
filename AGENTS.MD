# RevealID Agent Instructions

---

## Product Invariant

RevealID is a privacy-preserving academic credential wallet, verifier, and OpenCerts bridge. The system must never reveal claims the holder did not explicitly disclose.

For the OpenCerts Bridge MVP, RevealID verifies a holder-provided `.opencert`, normalizes it, issues a RevealID-derived SD-JWT credential, and reuses the existing wallet/share/verifier flow. It must not claim to be the original institution or an official institutional selective-disclosure issuer.

---

## Protocol Invariant

Use RFC 9901-style SD-JWT selective disclosure with mandatory holder key binding for public presentations. Do not replace this with JSON filtering, response filtering, ad hoc hashing, or hand-built disclosure logic.

OpenCerts source verification is a prerequisite for derivation. Verify before normalize, derive, store, or share.

---

## Security Invariants

These rules are non-negotiable. Every task must respect all of them.

- Never log full credentials, source `.opencert` documents, SD-JWT presentations, share tokens, passwords, access tokens, refresh tokens, or private keys
- Never return encrypted credential blobs, encrypted source blobs, full source documents, full SD-JWT credentials, or full presentations to the frontend
- Never store raw share tokens in the database; store SHA-256 hashes only
- Never store access tokens in browser `localStorage`
- All issuer-only operations must enforce the `ISSUER` role
- All holder import, derive, and share operations must enforce authenticated ownership
- Verification responses must expose disclosed claims only
- OpenCerts API fallback must be explicit because it transfers uploaded credential contents outside RevealID
- Raw source-file retention must be disabled by default; if enabled, retain only encrypted content with a retention expiry
- Do not imply original-institution endorsement, issuance, or key control without a real integration and updated ADR

---

## Architecture Rules

- Route handlers must not call cryptographic libraries directly
- Route handlers must not call TrustVC or OpenCerts API clients directly
- All source import operations go through `OpenCertsImportService`
- All source verification operations go through `SourceCredentialVerificationService`
- All source claim mapping goes through `AcademicClaimNormalizer`
- All credential operations go through `CredentialService` and `CredentialCryptoService`
- All presentation creation and public verification go through `PresentationService`
- All private-key handling goes through `KeyManagementService`
- All encryption at rest goes through `EnvelopeEncryptionService`
- All credential status and revocation checks go through `CredentialStatusService`
- All request and response schemas must be explicitly defined in shared contracts or route schemas
- Protocol, trust-model, or API changes require documentation updates and tests

Allowed service path for the bridge:

```text
Route
  -> OpenCertsImportService
  -> SourceCredentialVerificationService
  -> AcademicClaimNormalizer
  -> CredentialService / CredentialCryptoService
  -> PresentationService for sharing and verification
```

Forbidden shortcuts:

```text
Route -> TrustVC
Route -> OpenCerts API
Route -> jose / @sd-jwt/*
UI -> crypto libraries
UI -> encrypted blobs
Verifier response -> undisclosed claims
```

---

## Dependency Policy

### Crypto and Verification Service Boundaries

Do not allow routes or UI components to invoke crypto or source-verification libraries directly. All cryptographic and source-verification behaviour must sit behind explicit services:

```text
CredentialCryptoService
PresentationService
KeyManagementService
EnvelopeEncryptionService
CredentialStatusService
OpenCertsImportService
SourceCredentialVerificationService
AcademicClaimNormalizer
```

This keeps the system testable and protects against accidental inconsistency between source verification, derived issuance, and public verification.

### OpenCerts Verification Policy

- Default verification mode: `LOCAL_TRUSTVC`
- Optional fallback mode: `OPENCERTS_API`
- Fallback must be documented as an external transfer of uploaded document content
- `DEMO` issuer policy may accept the public OpenCerts demo fixture
- `INSTITUTION_ONLY` issuer policy must reject demo fixtures until an approved institutional `.opencert` and allowlist are available

---

## Phased Build Discipline

Implement vertically behind gates. Do not generate every page and endpoint at once.

| Phase | Gate goal |
| --- | --- |
| 0. Baseline lock | Existing RevealID `pnpm verify` result known before bridge work |
| 1. Import boundary and contracts | Schemas, route skeleton, model plan, fixture policy |
| 2. Verification and normalization | TrustVC adapter, fallback policy, issuer policy, normalizer |
| 3. Derived credential issuance | Verified import becomes encrypted RevealID-derived SD-JWT credential |
| 4. Wallet/share/verifier UX | Existing share and verify flow supports derived credential fields |
| 5. Hardening and demo | Redaction, privacy tests, failure UX, demo script, CI smoke |

Do not start a later phase while an earlier phase gate is failing unless the failure is documented as an environmental blocker.

---

## Definition of Done for Every Task

- TypeScript compiles in strict mode
- Relevant unit, integration, or e2e tests are added or updated
- Lint, typecheck, tests, and build pass
- No secrets are introduced
- No privacy invariant is weakened
- Documentation is updated if API, protocol, trust, dependency, or phase behaviour changes

---

## Command Gates

Run before every completed phase:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run once browser-facing import/share/verifier work begins:

```bash
pnpm test:e2e
```

---

## Codex Behaviour Rules

1. Implement vertically: complete one gate before starting the next.
2. Crypto and source verification first: Phase 0 and Phase 1 must pass before database/UI expansion.
3. No shortcuts: do not replace SD-JWT with JSON filtering, even temporarily.
4. Verify before derive: never normalize or issue from an unverified source document.
5. Test adversarially: crypto and import functions need happy-path, tampering, malformed input, and privacy tests.
6. No secrets in code: all sensitive config comes from environment variables or managed platform secrets.
7. Respect service boundaries: routes call services; services call crypto/source-verification adapters.
8. Preserve privacy in observability: logs and audits store hashes, statuses, and checks, not source documents or claims.
