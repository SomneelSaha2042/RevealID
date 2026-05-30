# RevealID 5-Minute Demo Script

This walkthrough is designed for a screen recording or live evaluator demo.

## Setup

```bash
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

Production demo URL:

```text
https://revealidweb-production.up.railway.app/
```

Seeded accounts:

| Role | Email | Password |
| --- | --- | --- |
| Issuer | `issuer@demo-university.edu` | `DemoIssuerPass123!` |
| Holder | `holder@example.edu` | `DemoHolderPass123!` |

## Walkthrough

1. Show the home page and API status.
2. Sign in as `issuer@demo-university.edu`.
3. Open `Issue credential`.
4. Issue the prefilled demo credential to `holder@example.edu`.
5. Sign out and sign in as `holder@example.edu`.
6. Open `Wallet`, then open the new credential.
7. Leave only `Degree` and `Graduation year` selected.
8. Create a secure share with one allowed view.
9. Open the verification link in a private browser window or separate session.
10. Show the verified result and point out that CGPA and marks are absent.
11. Return to the issuer account and revoke the credential.
12. Reopen or recreate verification after revocation to show the invalid result.

## Narration Notes

- "The issuer signs an SD-JWT credential, but the verifier sees only holder-selected disclosures."
- "The holder chooses degree and graduation year; CGPA and marks stay private."
- "RevealID stores encrypted presentations and token hashes, not recoverable share links."
- "Revocation is enforced at verification time, so old links stop validating."

## Expected Result

The evaluator should see an end-to-end flow in under five minutes:

- Issuer issues a credential.
- Holder creates a selective-disclosure share.
- Verifier sees a cryptographically verified report.
- Hidden claims never render in the verifier response.
- Revocation changes the verification outcome to invalid.
