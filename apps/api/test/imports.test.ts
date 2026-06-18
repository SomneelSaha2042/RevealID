import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bridgeDisclaimer } from "@revealid/contracts";
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

type SourceCredentialImportRecord = {
  id: string;
  holderId: string;
  sourceType: string;
  sourceFileHash: string;
  verificationMode: string;
  issuerPolicyMode: string;
  hiddenByDefault: string[];
  status: "PENDING_VERIFICATION";
  createdAt: Date;
};

function makePrismaMock() {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const holderKeys = new Map<string, HolderKeyRecord>();
  const sourceCredentialImports = new Map<string, SourceCredentialImportRecord>();

  return {
    users,
    sessions,
    holderKeys,
    sourceCredentialImports,
    user: {
      create: async ({ data }: { data: Omit<UserRecord, "id"> }) => {
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
      updateMany: async () => ({ count: 0 })
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
    sourceCredentialImport: {
      create: async ({ data }: { data: Omit<SourceCredentialImportRecord, "id" | "createdAt"> }) => {
        const sourceImport = { id: randomUUID(), createdAt: new Date(), ...data };
        sourceCredentialImports.set(sourceImport.id, sourceImport);
        return sourceImport;
      }
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
  MAX_OPENCERTS_UPLOAD_BYTES: 1_048_576,
  OPENCERTS_RETAIN_SOURCE: false,
  OPENCERTS_SOURCE_RETENTION_DAYS: 31,
  COOKIE_SECURE: false
};

const cookieHeader = (setCookie: string[]) => setCookie.map((value) => value.split(";")[0]).join("; ");

const demoDocument = {
  version: "https://schema.openattestation.com/2.0/schema.json",
  data: {
    name: "salt:string:Your Name",
    course: "salt:string:OpenCerts Demo"
  }
};

describe("OpenCerts import boundary", () => {
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

  it("requires an authenticated holder and CSRF token", async () => {
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      payload: { fileName: "sepolia.opencert", document: demoDocument }
    });
    expect(unauthenticated.statusCode).toBe(401);

    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const missingCsrf = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: { cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]) },
      payload: { fileName: "sepolia.opencert", document: demoDocument }
    });
    expect(missingCsrf.statusCode).toBe(403);
  });

  it("rejects issuer users and malformed import requests", async () => {
    const issuerLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
    });
    const issuerImport = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": issuerLogin.json().csrfToken
      },
      payload: { fileName: "sepolia.opencert", document: demoDocument }
    });
    expect(issuerImport.statusCode).toBe(403);

    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const malformed = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { fileName: "sepolia.json", document: demoDocument }
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("creates a pending import record without retaining or returning the source document", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });

    const response = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: {
        fileName: "sepolia.opencert",
        document: demoDocument,
        verificationMode: "LOCAL_TRUSTVC",
        issuerPolicyMode: "DEMO",
        retainEncryptedSource: false
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "pending_verification",
      source: {
        type: "UNKNOWN",
        verificationMode: "LOCAL_TRUSTVC",
        issuerPolicyMode: "DEMO"
      },
      disclaimer: bridgeDisclaimer
    });
    expect(response.json().source.sourceFileHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(response.json().hiddenByDefault).toEqual(
      expect.arrayContaining([
        "recipient.nric",
        "academicCredential.transcript",
        "academicCredential.additionalData.studentId",
        "academicCredential.additionalData.transcriptId"
      ])
    );
    expect(JSON.stringify(response.json())).not.toContain("Your Name");
    expect(JSON.stringify(response.json())).not.toContain("OpenCerts Demo");

    const storedImport = [...prisma.sourceCredentialImports.values()][0];
    expect(storedImport).toMatchObject({
      holderId: holderLogin.json().user.id,
      sourceType: "UNKNOWN",
      verificationMode: "LOCAL_TRUSTVC",
      issuerPolicyMode: "DEMO",
      status: "PENDING_VERIFICATION"
    });
    expect(JSON.stringify(storedImport)).not.toContain("Your Name");
    expect(JSON.stringify(storedImport)).not.toContain("OpenCerts Demo");
  });

  it("keeps derivation closed until verification is implemented", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });

    const response = await app.inject({
      method: "POST",
      url: `/imports/opencerts/${randomUUID()}/derive`,
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { credentialTemplate: "GRADUATION_PROOF" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain("Phase 3");
  });
});
