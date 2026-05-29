# RevealID Protocol

## Overview
RevealID uses RFC 9901-style SD-JWT selective disclosure for academic credentials and aligns the credential envelope with the SD-JWT VC draft conventions used by `@sd-jwt/sd-jwt-vc`.

Gate 3 adds public share links for holder-selected presentations. Credentials and presentations remain server-side encrypted at rest, and public verification responses expose disclosed claims only.

## Roles
- Issuer: Trusted academic issuer that signs SD-JWT credentials with an Ed25519 key.
- Holder: Credential subject that owns an Ed25519 holder key and creates holder-bound presentations.
- Verifier: Validates issuer signature, disclosure digests, holder binding, audience, nonce, and issued-at time.

## Credential Format
The signed SD-JWT VC payload contains non-selective protocol claims:

- `iss`: issuer identifier.
- `iat`: credential issuance time.
- `vct`: credential type identifier.
- `cnf.jwk`: holder public JWK used for key binding.

The Phase 0 academic claims are:

- `degree`
- `graduationYear`
- `cgpa`
- `marks`

All four academic claims are issued as selectively disclosable SD-JWT disclosures. Holder-created shares may disclose any permitted subset selected by the holder. Non-selected claims must not appear in the share creation response, share URL, public verifier payload, presentation text, or verified disclosed claims.

## Holder Binding
Public presentations require a key binding JWT signed by the holder key. The verifier policy requires:

- Holder key binding is present.
- The key binding signature verifies against the holder key committed in `cnf.jwk`.
- `aud` matches the verifier audience.
- `nonce` matches the verifier challenge.
- `iat` matches the expected key binding issued-at time for this spike.

Missing holder binding, wrong audience, or wrong nonce fails verification.

## Share Links
Holder share links use opaque 256-bit random tokens. The database stores only the SHA-256 token hash. Each share stores:

- Token hash.
- Audience.
- Nonce.
- Key-binding issued-at time.
- Expiry.
- Maximum view count and current views.
- Encrypted SD-JWT presentation.
- Disclosed claim names for holder history.

Public verification resolves `/verify/:token` through the API verifier endpoint. The API hashes the token, loads the encrypted presentation, enforces expiry/revocation/view limits, verifies issuer signature and holder binding, increments the view count, and returns only disclosed claims.

## Implementation Boundary
All cryptographic behavior is isolated behind service boundaries. Routes call `CredentialService` or `PresentationService`; presentation creation and verification flow through `CredentialCryptoService`.

The service uses:

- `@sd-jwt/core` and `@sd-jwt/sd-jwt-vc` for issuance, presentation, and verification.
- `@sd-jwt/crypto-nodejs` for SHA-256 hashing and salt generation.
- `jose` for Ed25519 JWK import, signing, verification, and JWK thumbprints.

Route handlers and UI components must not call these libraries directly.

## Security Invariants
- No sensitive claims in logs.
- No full credentials or presentations logged.
- No JSON filtering as a substitute for SD-JWT selective disclosure.
- No ad hoc hashing as a substitute for RFC 9901 disclosure digests.
- Verification returns disclosed claims only.
- No raw share tokens in the database.
- No encrypted credential blobs returned to the frontend.

## Gate 0 Adversarial Tests
The crypto package tests cover:

- Ed25519 issuer-signed credential issuance.
- Selective presentation verification.
- Raw presentation text does not contain `cgpa`, `marks`, or their values.
- Tampered disclosed value fails verification.
- Wrong nonce fails verification.
- Wrong audience fails verification.
- Missing holder binding fails when verifier policy requires it.

## Gate 3 Tests
The API tests cover:

- Holder-created selective shares.
- Hidden claim values and hidden field names excluded from share creation responses and verifier payloads.
- Raw share tokens excluded from database storage.
- Encrypted presentation storage.
- One-use view exhaustion.
- Holder share cancellation.

## Non-Goals
- This protocol does not claim zero-knowledge proofs.
- This protocol does not prove threshold statements such as `cgpa >= 4.0` without disclosure.
- This protocol does not independently validate the issuer's real-world records.
