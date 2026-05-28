## RevealID Agent Instructions

---

### Product Invariant

RevealID is a privacy-preserving academic credential wallet and verifier. **The system must never reveal claims the holder did not explicitly disclose.**

### Protocol Invariant

Use RFC 9901-style SD-JWT selective disclosure with mandatory holder key binding for public presentations. **Do not replace this with JSON filtering or ad hoc hashing.**

---

## Security Invariants

<aside>
🔒

These rules are non-negotiable. Every task must respect all of them.

</aside>

- Never log full credentials, SD-JWT presentations, share tokens, passwords or private keys
- Never return encrypted credential blobs to the frontend
- Never store raw share tokens in the database — store SHA-256 hashes only
- Never store access tokens in browser `localStorage`
- All issuer-only operations must enforce the `ISSUER` role
- Verification responses must expose disclosed claims only

---

## Architecture Rules

- Route handlers must **not** call cryptographic libraries directly
- All credential operations go through `CredentialCryptoService`
- All presentation creation goes through `PresentationService`
- All private-key handling goes through `KeyManagementService`
- All request and response schemas must be explicitly defined
- Protocol changes require an ADR update and tests

---

## Dependency Policy

### Crypto Service Boundaries

Do not allow routes or UI components to invoke crypto libraries directly. All cryptographic behaviour must sit behind explicit services:

```
CredentialCryptoService
PresentationService
KeyManagementService
EnvelopeEncryptionService
CredentialStatusService
```

This keeps the system testable and protects against accidental inconsistency between issuance and verification.

---

## Definition of Done (Every Task)

- [ ]  TypeScript compiles in strict mode
- [ ]  Relevant unit/integration tests are added
- [ ]  Lint, typecheck and tests pass
- [ ]  No secrets are introduced
- [ ]  Documentation is updated if API or protocol behaviour changes

---

## Command Gates

Run before every completed phase:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## Codex Behaviour Rules

<aside>
⚠️

Do not let Codex begin by generating every page and endpoint. It should implement **vertical slices behind gates**, beginning with the hardest risk: cryptographic issuance, presentation and verification.

</aside>

1. **Implement vertically** — complete one gate before starting the next
2. **Crypto first** — Phase 0 must pass before any database models or UI
3. **No shortcuts** — do not replace SD-JWT with JSON filtering, even "temporarily"
4. **Test adversarially** — every crypto function needs both happy-path and tampering tests
5. **No secrets in code** — all sensitive config via environment variables
6. **Respect service boundaries** — routes → services → crypto, never routes → crypto directly