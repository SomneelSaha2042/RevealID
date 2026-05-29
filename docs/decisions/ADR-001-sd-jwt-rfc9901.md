# ADR-001: SD-JWT (RFC 9901) for Selective Disclosure

## Status
Accepted (2026-05-28)

## Context
RevealID needs a privacy-preserving credential format that supports selective disclosure, holder binding, and public verification. We require Ed25519 issuer signing and a standards-aligned approach compatible with existing JWT tooling.

The project must never reveal claims the holder did not explicitly disclose, so JSON filtering and ad hoc hashing are not acceptable substitutes for selective disclosure.

## Decision
- Use RFC 9901-style SD-JWT selective disclosure for credentials and presentations.
- Align the credential envelope with SD-JWT VC draft conventions through `vct` and holder confirmation material in `cnf.jwk`.
- Use `@sd-jwt/core` and `@sd-jwt/sd-jwt-vc` to implement SD-JWT VC issuance, presentation, and verification.
- Use `jose` for JWK handling and Ed25519 signing/verification.
- Require holder key binding with `aud`, `nonce`, and `iat` checks.
- Keep all direct cryptographic library calls inside `CredentialCryptoService` for Phase 0.
- For Gate 3 public sharing, create presentations only through `PresentationService`.
- Use opaque 256-bit share tokens and store only SHA-256 token hashes.
- Store generated SD-JWT presentations encrypted at rest.
- Enforce share expiry, revocation, and max-view policy before returning disclosed claims.

## Consequences
- Verifiers only receive disclosed claims.
- Key binding is mandatory when required by the verifier.
- Tampered disclosures fail through SD-JWT digest and issuer signature verification.
- Presentations replayed to the wrong audience or nonce fail holder binding verification.
- Share URLs carry opaque tokens, but the database never stores raw tokens.
- Share creation responses, share URLs, and verifier payloads do not expose non-disclosed fields.
- Protocol changes must be accompanied by tests and documentation updates.
- This approach does not claim zero-knowledge proofs or document genuineness.
