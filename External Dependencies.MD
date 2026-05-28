## Software to Install Outside the TypeScript Ecosystem

These are the tools and runtimes you need on your machine **before** running `pnpm install`.

---

## Required

### 1. Node.js (v20 LTS or v22+)

Required runtime for all TypeScript tooling, Next.js, and Fastify.

```bash
# macOS (Homebrew)
brew install node@22

# Or use nvm
nvm install 22
nvm use 22
```

### 2. pnpm (v9+)

Package manager for the monorepo workspace.

```bash
# Via corepack (recommended)
corepack enable
corepack prepare pnpm@latest --activate

# Or standalone
npm install -g pnpm
```

### 3. PostgreSQL (v15 or v16)

Relational database for credentials, sessions, revocations, and audits.

**Option A: Docker (recommended)**

```bash
# The docker-compose.yml in the repo handles this
docker compose up -d postgres
```

**Option B: Native install**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### 4. Docker & Docker Compose

For the local development environment (Postgres + API containers).

```bash
# macOS
brew install --cask docker

# Ubuntu
sudo apt install docker.io docker-compose-v2

# Windows
# Install Docker Desktop from https://www.docker.com/products/docker-desktop/
```

---

## Required for `argon2` (Native Compilation)

The `argon2` npm package compiles native C code. You need a C/C++ toolchain:

### macOS

```bash
xcode-select --install
```

### Ubuntu / Debian

```bash
sudo apt install build-essential python3
```

### Windows

```bash
# Install Visual Studio Build Tools
npm install -g windows-build-tools
# Or install Visual Studio with "Desktop development with C++" workload
```

<aside>
💡

If `argon2` fails to build, ensure `node-gyp` dependencies are met: Python 3.x and a C++ compiler. See [node-gyp docs](https://github.com/nodejs/node-gyp#installation).

</aside>

---

## Required for E2E Testing

### Playwright Browsers

Playwright downloads its own browser binaries, but needs system dependencies:

```bash
# After pnpm install, run:
pnpm exec playwright install --with-deps
```

On CI, use the Playwright GitHub Action or install deps explicitly:

```bash
# Ubuntu CI
sudo npx playwright install-deps
```

---

## Optional but Recommended

### Git (v2.30+)

Version control. Should already be installed on most systems.

```bash
git --version
```

### Prisma CLI

Installed as a dev dependency via `pnpm`, but you can also install globally:

```bash
pnpm add -g prisma
```

Used for migrations and schema management:

```bash
pnpm exec prisma migrate dev
pnpm exec prisma generate
pnpm exec prisma db seed
```

---

## Deployment Platform CLIs (Optional)

### Railway CLI

For deploying API + Postgres:

```bash
# macOS
brew install railway

# Or
npm install -g @railway/cli

# Login
railway login
```

### Vercel CLI

For deploying the Next.js frontend:

```bash
npm install -g vercel
vercel login
```

---

## Quick Setup Checklist

- [ ]  Node.js v22+ installed (`node --version`)
- [ ]  pnpm v9+ installed (`pnpm --version`)
- [ ]  Docker + Docker Compose installed (`docker --version`)
- [ ]  C/C++ build tools for argon2 (`xcode-select --install` on macOS)
- [ ]  Git installed (`git --version`)
- [ ]  Clone repo and run `pnpm install`
- [ ]  Run `docker compose up -d` for local Postgres
- [ ]  Run `pnpm exec prisma migrate dev` to set up database
- [ ]  Run `pnpm exec prisma db seed` to seed demo data
- [ ]  Run `pnpm dev` to start all services