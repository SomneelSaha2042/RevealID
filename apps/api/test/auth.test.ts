import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: "HOLDER" | "ISSUER";
  passwordHash: string;
};

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  user?: UserRecord;
};

type HolderKeyRecord = {
  id: string;
  userId: string;
  publicJwk: unknown;
  encryptedPrivateJwk: unknown;
  createdAt: Date;
};

function makePrismaMock() {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const holderKeys = new Map<string, HolderKeyRecord>();

  return {
    users,
    sessions,
    holderKeys,
    user: {
      create: async ({ data }: { data: Omit<UserRecord, "id"> }) => {
        if ([...users.values()].some((user) => user.email === data.email)) {
          const error = new Error("Unique constraint failed") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
        const user = { id: randomUUID(), ...data };
        users.set(user.id, user);
        return user;
      },
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return [...users.values()].find((user) => user.email === where.email) ?? null;
        if (where.id) return users.get(where.id) ?? null;
        return null;
      }
    },
    refreshSession: {
      create: async ({ data }: { data: Omit<SessionRecord, "id" | "revokedAt" | "rotatedAt"> }) => {
        const session = { id: randomUUID(), revokedAt: null, rotatedAt: null, ...data };
        sessions.set(session.id, session);
        return session;
      },
      findUnique: async ({ where, include }: { where: { id?: string; tokenHash?: string }; include?: { user: boolean } }) => {
        const session = where.id
          ? sessions.get(where.id)
          : [...sessions.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!session) return null;
        if (include?.user) return { ...session, user: users.get(session.userId) };
        return session;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<SessionRecord> }) => {
        const session = sessions.get(where.id);
        if (!session) throw new Error("Session not found");
        const updated = { ...session, ...data };
        sessions.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: { where: { tokenHash: string; revokedAt: null }; data: Partial<SessionRecord> }) => {
        let count = 0;
        for (const [id, session] of sessions) {
          if (session.tokenHash === where.tokenHash && session.revokedAt === where.revokedAt) {
            sessions.set(id, { ...session, ...data });
            count += 1;
          }
        }
        return { count };
      }
    },
    holderKey: {
      create: async ({ data }: { data: Omit<HolderKeyRecord, "id" | "createdAt"> }) => {
        const holderKey = { id: randomUUID(), createdAt: new Date(), ...data };
        holderKeys.set(holderKey.userId, holderKey);
        return holderKey;
      },
      findUnique: async ({ where }: { where: { userId: string } }) => holderKeys.get(where.userId) ?? null
    },
    credential: {
      findMany: async () => []
    },
    $disconnect: async () => {}
  };
}

const config: AppConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://revealid:revealid@localhost:5432/revealid",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_ACCESS_TOKEN_SECRET: "test-access-secret-at-least-32-characters",
  AUTH_REFRESH_TOKEN_SECRET: "test-refresh-secret-at-least-32-characters",
  CREDENTIAL_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  ISSUER_PRIVATE_JWK: undefined,
  ISSUER_ID: "http://localhost:4000",
  ISSUER_NAME: "Demo University",
  OPENCERTS_VERIFICATION_MODE: "LOCAL_TRUSTVC",
  OPENCERTS_ISSUER_POLICY_MODE: "DEMO",
  OPENCERTS_API_VERIFY_URL: "https://api.opencerts.io/verify",
  OPENCERTS_RPC_PROVIDER_URL: undefined,
  MAX_OPENCERTS_UPLOAD_BYTES: 1_048_576,
  OPENCERTS_RETAIN_SOURCE: false,
  OPENCERTS_SOURCE_RETENTION_DAYS: 31,
  COOKIE_SECURE: false
};

function cookieHeader(setCookie: string[]) {
  return setCookie.map((value) => value.split(";")[0]).join("; ");
}

describe("auth routes", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    prisma.users.set("22222222-2222-4222-8222-222222222222", {
      id: "22222222-2222-4222-8222-222222222222",
      email: "issuer@demo-university.edu",
      name: "Demo University",
      role: "ISSUER",
      passwordHash: await argon2.hash("DemoIssuerPass123!", { type: argon2.argon2id })
    });
    app = await buildApp({ config, prisma: prisma as never });
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers a holder and returns first-party auth cookies", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "new@example.edu", name: "New Holder", password: "NewHolderPass123!" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().user.role).toBe("HOLDER");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rid_access="),
        expect.stringContaining("rid_refresh="),
        expect.stringContaining("rid_csrf=")
      ])
    );
    expect(prisma.holderKeys.size).toBe(1);
  });

  it("lets seeded issuer login and access issuer route", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
    });

    const response = await app.inject({
      method: "GET",
      url: "/issuer/ping",
      headers: { cookie: cookieHeader(login.headers["set-cookie"] as string[]) }
    });

    expect(response.statusCode).toBe(200);
  });

  it("rejects unauthenticated protected routes", async () => {
    const response = await app.inject({ method: "GET", url: "/me" });
    expect(response.statusCode).toBe(401);
  });

  it("prevents holders from accessing issuer routes", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const response = await app.inject({
      method: "GET",
      url: "/issuer/ping",
      headers: { cookie: cookieHeader(login.headers["set-cookie"] as string[]) }
    });

    expect(response.statusCode).toBe(403);
  });

  it("requires csrf token for authenticated state-changing requests", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "csrf@example.edu", name: "CSRF Holder", password: "HolderPass123!" }
    });
    const cookies = cookieHeader(login.headers["set-cookie"] as string[]);
    const missingCsrf = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: cookies }
    });
    expect(missingCsrf.statusCode).toBe(403);

    const csrfToken = login.json().csrfToken as string;
    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: cookies, "x-csrf-token": csrfToken }
    });
    expect(logout.statusCode).toBe(200);
  });

  it("renders swagger docs", async () => {
    const response = await app.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(200);
  });
});
