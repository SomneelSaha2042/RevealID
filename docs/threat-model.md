# RevealID Threat Model

RevealID protects academic credentials during issuance, holder sharing, and public verification. The highest-value asset is undisclosed credential data: CGPA, marks, student identifiers, and any future claims the holder does not explicitly reveal.

## Security Objectives

- Verifiers receive disclosed claims only.
- Credentials and presentations remain encrypted at rest.
- Share tokens are unrecoverable from database state.
- Issuer-only operations are unavailable to holders and anonymous users.
- Public verification detects tampering, wrong audience, wrong nonce, expiry, view exhaustion, and revocation.
- Logs and audit records do not contain credentials, presentations, private keys, raw tokens, emails, or holder names.

## Assets

| Asset | Protection |
| --- | --- |
| Issuer private key | Environment-provided secret in production. Used only through `KeyManagementService`. |
| Holder private keys | Generated server-side and stored encrypted with envelope encryption. |
| SD-JWT credentials | Stored as encrypted envelopes. Never returned directly to the frontend. |
| SD-JWT presentations | Stored as encrypted envelopes for share verification. |
| Share tokens | Raw tokens shown once to the holder; database stores SHA-256 hashes only. |
| Refresh tokens | Stored as hashes and delivered through HTTP-only cookies. |
| Verification audit metadata | Stores check outcomes and hashed request metadata only. |

## Trust Boundaries

| Boundary | Risk | Control |
| --- | --- | --- |
| Browser to web app | Token theft, local storage leakage | Auth uses HTTP-only cookies; access tokens are not stored in `localStorage`. |
| Web app to API | Cross-site requests | Mutating authenticated routes require CSRF token checks. |
| API routes to crypto | Inconsistent ad hoc crypto | Routes call services; crypto libraries stay behind service boundaries. |
| API to database | Data exposure after database leak | Credentials, presentations, and private keys are encrypted; share tokens are hashed. |
| Public verifier | Enumeration and abuse | Verification endpoint is rate-limited and returns controlled invalid states. |

## Threats and Mitigations

| Threat | Mitigation |
| --- | --- |
| Verifier tries to infer hidden claims | SD-JWT selective disclosure reveals only selected disclosures; API response schemas return disclosed claims only. |
| Attacker modifies a disclosed value | Disclosure digest and issuer signature verification fail. |
| Attacker inserts extra disclosure material | Presentation verification fails because disclosures must match committed digests. |
| Attacker removes holder binding | Public verification requires holder key binding. |
| Attacker changes audience or nonce | Verification compares expected audience and nonce from the share record. |
| Holder tries issuer-only routes | API enforces `ISSUER` role on issue and revoke operations. |
| Database reader steals share links | Database contains token hashes, not raw tokens. |
| Database reader steals credentials | Credentials and presentations are encrypted with AES-256-GCM envelopes. |
| Expired or used links are replayed | Verification enforces expiry, cancellation, and max view count. |
| Revoked credential remains accepted | Verification checks credential status before returning a verified result. |
| Logs leak sensitive data | Fastify logger redacts auth headers, cookies, access tokens, refresh tokens, and passwords. |

## Out of Scope

- Real university registry integration.
- Hardware-backed key custody.
- Zero-knowledge threshold proofs such as proving `cgpa >= 4.0` without disclosing CGPA.
- Native mobile wallet storage.

## Validation

The current Gate 4 test suite covers happy paths and adversarial cases for selective disclosure, tampering, wrong audience, wrong nonce, missing holder binding, expired/cancelled/revoked shares, and verification rate limiting.
