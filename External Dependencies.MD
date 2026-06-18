# RevealID External Dependencies

These are the tools, runtimes, external services, package dependencies, and environment settings needed to build the RevealID OpenCerts Bridge on top of the existing TypeScript monorepo.

---

## Required Local Tools

### 1. Node.js v22+

Required runtime for Next.js, Fastify, Prisma, Vitest, Playwright, TrustVC, and SD-JWT tooling.

```bash
node --version
```

Recommended install methods:

```bash
# macOS
brew install node@22

# nvm
nvm install 22
nvm use 22

# Windows
# Install Node.js 22 LTS from https://nodejs.org/
```

### 2. pnpm 9.12.0+

Package manager for the workspace.

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

### 3. PostgreSQL 16

Used by the existing API for users, credentials, source imports, shares, revocation, and verification audit metadata.

Recommended local setup:

```bash
docker compose up -d postgres
```

Native install is also acceptable:

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Windows
# Install PostgreSQL from https://www.postgresql.org/download/windows/
```

### 4. Docker and Docker Compose

Used for local PostgreSQL and deployment parity.

```bash
docker --version
docker compose version
```

Install Docker Desktop on Windows or macOS. On Linux, install Docker Engine plus the Compose v2 plugin.

---

## Required Native Build Tools

The `argon2` package compiles native code. Keep a C/C++ toolchain available.

### macOS

```bash
xcode-select --install
```

### Ubuntu / Debian

```bash
sudo apt install build-essential python3
```

### Windows

Install Visual Studio Build Tools with the "Desktop development with C++" workload. Ensure Python 3 is available for `node-gyp`.

---

## Required TypeScript Ecosystem Packages

These are installed with `pnpm install` and should be managed through `package.json` and `pnpm-lock.yaml`, not installed manually in global state.

### Existing Core Packages

| Area | Packages |
| --- | --- |
| Web | `next`, `react`, `react-dom`, `qrcode.react`, `lucide-react` |
| API | `fastify`, `@fastify/swagger`, `@fastify/swagger-ui`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `zod` |
| Data | `@prisma/client`, `prisma` |
| Auth | `argon2`, `jose` |
| SD-JWT | `@sd-jwt/core`, `@sd-jwt/sd-jwt-vc`, `@sd-jwt/crypto-nodejs`, `@sd-jwt/types`, `@sd-jwt/utils` |
| Testing | `vitest`, `@playwright/test`, `jsdom` |

### New Bridge Package

| Package | Purpose | Phase |
| --- | --- | --- |
| `@trustvc/trustvc` | Local OpenCerts/OpenAttestation-compatible source verification through `verifyDocument` | Phase 2 |
| `ethers@^5.8.0` | Required peer for TrustVC/OpenAttestation verifier providers | Phase 2 |

Add the package when implementation reaches Phase 2:

```bash
pnpm --filter @revealid/api add @trustvc/trustvc
pnpm --filter @revealid/api add ethers@^5.8.0
```

Do not call TrustVC directly from routes. Wrap it behind `SourceCredentialVerificationService`.

---

## OpenCerts Fixture Source

The MVP uses the public OpenCerts demo certificate fixture for repeatable local and CI tests.

| Fixture | Source |
| --- | --- |
| `sepolia.opencert` | `https://raw.githubusercontent.com/OpenCerts/opencerts-website/master/public/static/demo/sepolia.opencert` |

Recommended repo location once Phase 1 begins:

```text
samples/opencerts/sepolia.opencert
```

Optional download command:

```bash
mkdir -p samples/opencerts
curl -L https://raw.githubusercontent.com/OpenCerts/opencerts-website/master/public/static/demo/sepolia.opencert -o samples/opencerts/sepolia.opencert
```

Commit the fixture or document the exact acquisition command before writing CI tests. Do not use fabricated NUS credentials.

---

## Optional CLI Tools

### curl

Useful for downloading the public fixture and manually testing local/API verification endpoints.

```bash
curl --version
```

### jq

Useful for compacting and inspecting `.opencert` JSON during local debugging.

```bash
jq --version
```

Example OpenCerts API diagnostic call:

```bash
jq -c . samples/opencerts/sepolia.opencert > /tmp/sepolia.json
curl --header "Content-Type: application/json" --request POST --data "{\"document\":$(cat /tmp/sepolia.json)}" https://api.opencerts.io/verify
```

The OpenCerts API fallback sends document content to an external service. Use local TrustVC verification by default.

---

## Playwright Browsers

Needed for browser e2e tests once Phase 4 UI work begins.

```bash
pnpm exec playwright install chromium
```

On Linux CI, install browser dependencies:

```bash
pnpm exec playwright install --with-deps chromium
```

---

## Environment Variables

### Existing Runtime

```bash
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revealid
```

### Existing Auth and Security

```bash
AUTH_ACCESS_TOKEN_SECRET=replace-with-secure-random-value
AUTH_REFRESH_TOKEN_SECRET=replace-with-secure-random-value
COOKIE_SECURE=false
```

### Existing Credential and Key Encryption

```bash
CREDENTIAL_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key
KEY_ENCRYPTION_KEY_BASE64=replace-with-32-byte-base64-key
```

### Existing Issuer Identity

```bash
ISSUER_NAME=Demo University
ISSUER_URL=http://localhost:4000
ISSUER_KEY_ID=demo-university-key-2026-01
ISSUER_PRIVATE_JWK_JSON=replace-in-deployment-secrets
ISSUER_PUBLIC_JWK_JSON=replace-in-deployment-secrets
```

### Existing Presentation Behaviour

```bash
VERIFY_AUDIENCE=http://localhost:3000/verify
DEFAULT_SHARE_TTL_MINUTES=15
MAX_SHARE_TTL_MINUTES=1440
DEFAULT_MAX_VIEWS=1
VERIFY_RATE_LIMIT_MAX=20
VERIFY_RATE_LIMIT_WINDOW=1 minute
```

### New OpenCerts Bridge Configuration

```bash
OPENCERTS_VERIFICATION_MODE=LOCAL_TRUSTVC
OPENCERTS_ISSUER_POLICY_MODE=DEMO
OPENCERTS_API_VERIFY_URL=https://api.opencerts.io/verify
OPENCERTS_RPC_PROVIDER_URL=
MAX_OPENCERTS_UPLOAD_BYTES=1048576
OPENCERTS_RETAIN_SOURCE=false
OPENCERTS_SOURCE_RETENTION_DAYS=31
```

Allowed values:

| Variable | Values | Default |
| --- | --- | --- |
| `OPENCERTS_VERIFICATION_MODE` | `LOCAL_TRUSTVC`, `OPENCERTS_API` | `LOCAL_TRUSTVC` |
| `OPENCERTS_ISSUER_POLICY_MODE` | `DEMO`, `NUS_ONLY` | `DEMO` |
| `OPENCERTS_RETAIN_SOURCE` | `true`, `false` | `false` |

`NUS_ONLY` must reject demo/non-NUS fixtures until a genuine NUS-issued `.opencert` and issuer allowlist are available.

Never commit real issuer keys, cookie secrets, encryption keys, access tokens, refresh tokens, private keys, or uploaded source credentials.

---

## External Services

| Service | Use | Default |
| --- | --- | --- |
| OpenCerts API `https://api.opencerts.io/verify` | Optional verification fallback and diagnostics | Off by default |
| Railway | Existing deployment target for API, web, and PostgreSQL | Optional for local development |
| GitHub Actions | Existing CI runner | Required for repository gates |

OpenCerts API fallback has privacy implications because uploaded document content leaves RevealID. The UI and docs must disclose this if fallback mode is exposed.

---

## Local Setup Checklist

- [ ] Node.js v22+ installed (`node --version`)
- [ ] pnpm 9.12.0+ installed (`pnpm --version`)
- [ ] Docker and Docker Compose installed (`docker --version`)
- [ ] C/C++ build tools available for `argon2`
- [ ] Git installed (`git --version`)
- [ ] Clone repo and run `pnpm install`
- [ ] Copy `.env.example` to `.env` and add local secrets
- [ ] Run `docker compose up -d postgres`
- [ ] Run `pnpm db:generate`
- [ ] Run `pnpm db:migrate`
- [ ] Run `pnpm db:seed`
- [ ] Run `pnpm dev` to start all services<!--  -->

---

## Phase Gates

Before completing each bridge phase:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

When UI work begins:

```bash
pnpm test:e2e
```
