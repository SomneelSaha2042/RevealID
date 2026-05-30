import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
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

type CredentialRecord = {
  id: string;
  holderId: string;
  issuerId: string;
  credentialType: string;
  issuerName: string;
  encryptedSdJwt: unknown;
  issuedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

type ShareRecord = {
  id: string;
  holderId: string;
  credentialId: string;
  tokenHash: string;
  audience: string;
  nonce: string;
  keyBindingIssuedAt: number;
  encryptedPresentation: unknown;
  disclosedClaims: string[];
  privateClaims: string[];
  expiresAt: Date;
  maxViews: number;
  views: number;
  revokedAt: Date | null;
  createdAt: Date;
};

type VerificationAuditRecord = {
  id: string;
  shareId?: string;
  credentialId?: string;
  tokenHashPrefix: string;
  result: string;
  failureCode?: string;
  checks: unknown;
  requestIpHash?: string;
  userAgentHash?: string;
  createdAt: Date;
};

function makePrismaMock() {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const holderKeys = new Map<string, HolderKeyRecord>();
  const credentials = new Map<string, CredentialRecord>();
  const shares = new Map<string, ShareRecord>();
  const verificationAudits = new Map<string, VerificationAuditRecord>();

  return {
    users,
    holderKeys,
    credentials,
    shares,
    verificationAudits,
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
      create: async ({ data }: { data: Omit<CredentialRecord, "id" | "createdAt" | "revokedAt"> & { revokedAt?: Date | null } }) => {
        const credential = { id: randomUUID(), createdAt: new Date(), revokedAt: null, ...data };
        credentials.set(credential.id, credential);
        return credential;
      },
      findFirst: async ({ where }: { where: { id: string; holderId?: string; issuerId?: string } }) => {
        const credential = credentials.get(where.id);
        if (!credential) return null;
        if (where.holderId && credential.holderId !== where.holderId) return null;
        if (where.issuerId && credential.issuerId !== where.issuerId) return null;
        return credential;
      },
      findMany: async ({ where }: { where: { holderId?: string; issuerId?: string } }) =>
        [...credentials.values()]
          .filter((credential) => {
            if (where.holderId) return credential.holderId === where.holderId;
            if (where.issuerId) return credential.issuerId === where.issuerId;
            return true;
          })
          .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
          .map((credential) =>
            where.holderId
              ? {
                  id: credential.id,
                  credentialType: credential.credentialType,
                  issuerName: credential.issuerName,
                  issuedAt: credential.issuedAt,
                  expiresAt: credential.expiresAt,
                  revokedAt: credential.revokedAt
                }
              : {
                  ...credential,
                  holder: { email: users.get(credential.holderId)?.email ?? "holder@example.edu" }
                }
          ),
      update: async ({ where, data }: { where: { id: string }; data: Partial<CredentialRecord> }) => {
        const credential = credentials.get(where.id);
        if (!credential) throw new Error("Credential not found");
        const updated = { ...credential, ...data };
        credentials.set(where.id, updated);
        return updated;
      }
    },
    share: {
      create: async ({ data }: { data: Omit<ShareRecord, "createdAt" | "views" | "revokedAt"> }) => {
        const share = { createdAt: new Date(), views: 0, revokedAt: null, ...data };
        shares.set(share.id, share);
        return share;
      },
      findMany: async ({ where }: { where: { holderId: string } }) =>
        [...shares.values()]
          .filter((share) => share.holderId === where.holderId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((share) => ({
            ...share,
            credential: credentials.get(share.credentialId)
          })),
      findFirst: async ({ where }: { where: { id: string; holderId: string } }) => {
        const share = shares.get(where.id);
        if (!share || share.holderId !== where.holderId) return null;
        return share;
      },
      findUnique: async ({ where }: { where: { tokenHash?: string; id?: string } }) => {
        const share = where.id
          ? shares.get(where.id)
          : [...shares.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!share) return null;
        const credential = credentials.get(share.credentialId);
        if (!credential) return null;
        return {
          ...share,
          credential: {
            ...credential,
            holder: { id: credential.holderId }
          }
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<ShareRecord> }) => {
        const share = shares.get(where.id);
        if (!share) throw new Error("Share not found");
        const updated = { ...share, ...data };
        shares.set(where.id, updated);
        return updated;
      }
    },
    verificationAudit: {
      create: async ({ data }: { data: Omit<VerificationAuditRecord, "id" | "createdAt"> }) => {
        const audit = { id: randomUUID(), createdAt: new Date(), ...data };
        verificationAudits.set(audit.id, audit);
        return audit;
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
  COOKIE_SECURE: false
};

const cookieHeader = (setCookie: string[]) => setCookie.map((value) => value.split(";")[0]).join("; ");

async function createIssuedShare(
  app: Awaited<ReturnType<typeof buildApp>>,
  prisma: ReturnType<typeof makePrismaMock>,
  options?: { maxViews?: number; claims?: string[] }
) {
  const holderRegister = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: `holder-${randomUUID()}@example.edu`, name: "Holder", password: "HolderPass123!" }
  });
  const issuerLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
  });
  await app.inject({
    method: "POST",
    url: "/credentials/issue",
    headers: {
      cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
      "x-csrf-token": issuerLogin.json().csrfToken
    },
    payload: {
      holderEmail: holderRegister.json().user.email,
      degree: "BSc Computer Science",
      graduationYear: 2026,
      cgpa: 3.9,
      marks: 875
    }
  });
  const credential = [...prisma.credentials.values()].at(-1);
  if (!credential) throw new Error("Credential setup failed");
  const shareResponse = await app.inject({
    method: "POST",
    url: "/credentials/share",
    headers: {
      cookie: cookieHeader(holderRegister.headers["set-cookie"] as string[]),
      "x-csrf-token": holderRegister.json().csrfToken
    },
    payload: {
      credentialId: credential.id,
      claims: options?.claims ?? ["degree", "graduationYear"],
      ttlMinutes: 60,
      maxViews: options?.maxViews ?? 5
    }
  });
  const share = shareResponse.json().share;
  const token = new URL(share.verificationUrl).pathname.split("/").at(-1) ?? "";
  const storedShare = [...prisma.shares.values()].at(-1);
  if (!storedShare) throw new Error("Share setup failed");
  return {
    token,
    share: storedShare,
    credential,
    issuerLogin,
    holderRegister
  };
}

describe("credential issuance", () => {
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

  it("lets an issuer issue an encrypted holder-bound credential", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const issuerLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
    });

    const response = await app.inject({
      method: "POST",
      url: "/credentials/issue",
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": issuerLogin.json().csrfToken
      },
      payload: {
        holderEmail: "holder@example.edu",
        degree: "BSc Computer Science",
        graduationYear: 2026,
        cgpa: 3.9,
        marks: 875
      }
    });

    expect(response.statusCode).toBe(201);
    const stored = [...prisma.credentials.values()][0];
    expect(stored.encryptedSdJwt).toMatchObject({ alg: "A256GCM" });
    expect(JSON.stringify(stored)).not.toContain("3.9");
    expect(JSON.stringify(stored)).not.toContain("875");
  });

  it("prevents holders from issuing credentials", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });

    const response = await app.inject({
      method: "POST",
      url: "/credentials/issue",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: {
        holderEmail: "holder@example.edu",
        degree: "BSc Computer Science",
        graduationYear: 2026,
        cgpa: 3.9,
        marks: 875
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("exposes issuer metadata and public verification key only", async () => {
    const jwks = await app.inject({ method: "GET", url: "/.well-known/jwks.json" });
    const metadata = await app.inject({ method: "GET", url: "/issuer/metadata" });

    expect(jwks.statusCode).toBe(200);
    expect(jwks.json().keys[0]).toMatchObject({
      kty: "OKP",
      crv: "Ed25519",
      alg: "EdDSA",
      use: "sig"
    });
    expect(jwks.json().keys[0].x).toEqual(expect.any(String));
    expect(jwks.json().keys[0].kid).toEqual(expect.any(String));
    expect(jwks.json().keys[0].d).toBeUndefined();
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json().jwksUri).toBe("http://localhost:4000/.well-known/jwks.json");
  });

  it("creates a holder-bound selective share without exposing hidden fields", async () => {
    const holderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const issuerLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
    });
    await app.inject({
      method: "POST",
      url: "/credentials/issue",
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": issuerLogin.json().csrfToken
      },
      payload: {
        holderEmail: "holder@example.edu",
        degree: "BSc Computer Science",
        graduationYear: 2026,
        cgpa: 3.9,
        marks: 875
      }
    });

    const credentialId = [...prisma.credentials.values()][0].id;
    const shareResponse = await app.inject({
      method: "POST",
      url: "/credentials/share",
      headers: {
        cookie: cookieHeader(holderRegister.headers["set-cookie"] as string[]),
        "x-csrf-token": holderRegister.json().csrfToken
      },
      payload: {
        credentialId,
        claims: ["degree", "graduationYear"],
        ttlMinutes: 60,
        maxViews: 1
      }
    });

    expect(shareResponse.statusCode).toBe(201);
    const shareBody = shareResponse.json().share;
    expect(shareBody.verificationUrl).toContain("/verify/");
    expect(shareBody.disclosedClaims).toEqual(["degree", "graduationYear"]);
    expect(JSON.stringify(shareBody)).not.toContain("cgpa");
    expect(JSON.stringify(shareBody)).not.toContain("marks");

    const token = new URL(shareBody.verificationUrl).pathname.split("/").at(-1) ?? "";
    const stored = [...prisma.shares.values()][0];
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.encryptedPresentation).toMatchObject({ alg: "A256GCM" });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(stored)).not.toContain("3.9");
    expect(JSON.stringify(stored)).not.toContain("875");

    const verifyResponse = await app.inject({ method: "GET", url: `/shares/verify/${token}` });
    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().claims).toEqual({
      degree: "BSc Computer Science",
      graduationYear: 2026
    });
    expect(JSON.stringify(verifyResponse.json().claims)).not.toContain("3.9");
    expect(JSON.stringify(verifyResponse.json().claims)).not.toContain("875");

    const secondView = await app.inject({ method: "GET", url: `/shares/verify/${token}` });
    expect(secondView.statusCode).toBe(410);
  });

  it("lets a holder cancel an active share", async () => {
    const holderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const issuerLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "issuer@demo-university.edu", password: "DemoIssuerPass123!" }
    });
    await app.inject({
      method: "POST",
      url: "/credentials/issue",
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": issuerLogin.json().csrfToken
      },
      payload: {
        holderEmail: "holder@example.edu",
        degree: "BSc Computer Science",
        graduationYear: 2026,
        cgpa: 3.9,
        marks: 875
      }
    });
    const shareResponse = await app.inject({
      method: "POST",
      url: "/credentials/share",
      headers: {
        cookie: cookieHeader(holderRegister.headers["set-cookie"] as string[]),
        "x-csrf-token": holderRegister.json().csrfToken
      },
      payload: {
        credentialId: [...prisma.credentials.values()][0].id,
        claims: ["degree"],
        ttlMinutes: 60,
        maxViews: 5
      }
    });

    const share = shareResponse.json().share;
    const token = new URL(share.verificationUrl).pathname.split("/").at(-1) ?? "";
    const cancelResponse = await app.inject({
      method: "DELETE",
      url: `/shares/${share.id}`,
      headers: {
        cookie: cookieHeader(holderRegister.headers["set-cookie"] as string[]),
        "x-csrf-token": holderRegister.json().csrfToken
      }
    });
    const verifyResponse = await app.inject({ method: "GET", url: `/shares/verify/${token}` });

    expect(cancelResponse.statusCode).toBe(204);
    expect(verifyResponse.statusCode).toBe(410);
  });

  it("verifies an active presentation through the public verification API and audits without PII", async () => {
    const { token } = await createIssuedShare(app, prisma);

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      status: "verified",
      claims: {
        degree: "BSc Computer Science",
        graduationYear: 2026
      }
    });
    expect(verifyResponse.json().checks.every((check: { status: string }) => check.status !== "failed")).toBe(true);
    expect(verifyResponse.json().checks).toEqual(
      expect.arrayContaining([{ id: "credential_expiry", label: "Credential expiry checked", status: "passed" }])
    );
    expect(JSON.stringify(verifyResponse.json())).not.toContain("3.9");
    expect(JSON.stringify(verifyResponse.json())).not.toContain("875");

    const audit = [...prisma.verificationAudits.values()][0];
    expect(audit.result).toBe("verified");
    expect(JSON.stringify(audit)).not.toContain("BSc Computer Science");
    expect(JSON.stringify(audit)).not.toContain("3.9");
    expect(JSON.stringify(audit)).not.toContain(token);
  });

  it("rejects expired, cancelled, revoked, tampered, and unknown verification states", async () => {
    const expired = await createIssuedShare(app, prisma);
    prisma.shares.set(expired.share.id, { ...expired.share, expiresAt: new Date(Date.now() - 1000) });
    const expiredResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: expired.token }
    });
    expect(expiredResponse.json()).toMatchObject({ status: "invalid", failureCode: "expired" });

    const cancelled = await createIssuedShare(app, prisma);
    prisma.shares.set(cancelled.share.id, { ...cancelled.share, revokedAt: new Date() });
    const cancelledResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: cancelled.token }
    });
    expect(cancelledResponse.json()).toMatchObject({ status: "invalid", failureCode: "cancelled" });

    const revoked = await createIssuedShare(app, prisma);
    prisma.credentials.set(revoked.credential.id, { ...revoked.credential, revokedAt: new Date() });
    const revokedResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: revoked.token }
    });
    expect(revokedResponse.json()).toMatchObject({ status: "invalid", failureCode: "revoked" });

    const tampered = await createIssuedShare(app, prisma);
    prisma.shares.set(tampered.share.id, {
      ...tampered.share,
      encryptedPresentation: { ...(tampered.share.encryptedPresentation as Record<string, unknown>), ciphertext: "tampered" }
    });
    const tamperedResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: tampered.token }
    });
    expect(tamperedResponse.json()).toMatchObject({ status: "invalid", failureCode: "tampered" });

    const unknownResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: "unknown-token-value-with-enough-length-123456" }
    });
    expect(unknownResponse.json()).toMatchObject({ status: "invalid", failureCode: "unknown" });
  });

  it("rejects wrong audience and nonce key-binding checks", async () => {
    const wrongAudience = await createIssuedShare(app, prisma);
    prisma.shares.set(wrongAudience.share.id, { ...wrongAudience.share, audience: "https://verifier.example/wrong" });
    const wrongAudienceResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: wrongAudience.token }
    });
    expect(wrongAudienceResponse.json()).toMatchObject({ status: "invalid", failureCode: "tampered" });

    const wrongNonce = await createIssuedShare(app, prisma);
    prisma.shares.set(wrongNonce.share.id, { ...wrongNonce.share, nonce: "wrong-nonce" });
    const wrongNonceResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token: wrongNonce.token }
    });
    expect(wrongNonceResponse.json()).toMatchObject({ status: "invalid", failureCode: "tampered" });
  });

  it("lets issuers revoke credentials and enforces rate limiting", async () => {
    const { credential, issuerLogin, token } = await createIssuedShare(app, prisma);
    const revokeResponse = await app.inject({
      method: "POST",
      url: `/credentials/${credential.id}/revoke`,
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": issuerLogin.json().csrfToken
      }
    });
    const revokedVerifyResponse = await app.inject({
      method: "POST",
      url: "/credentials/verify",
      payload: { token }
    });

    expect(revokeResponse.statusCode).toBe(200);
    expect(revokedVerifyResponse.json()).toMatchObject({ status: "invalid", failureCode: "revoked" });

    let rateLimitedStatus = 0;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/credentials/verify",
        remoteAddress: "203.0.113.10",
        payload: { token: `unknown-token-value-with-enough-length-${attempt}` }
      });
      if (response.statusCode === 429) {
        rateLimitedStatus = response.statusCode;
        break;
      }
    }
    expect(rateLimitedStatus).toBe(429);
  });

  it("lists issued credentials for issuer revocation UI", async () => {
    const { credential, issuerLogin } = await createIssuedShare(app, prisma);

    const response = await app.inject({
      method: "GET",
      url: "/issuer/credentials",
      headers: {
        cookie: cookieHeader(issuerLogin.headers["set-cookie"] as string[])
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: credential.id,
          holderEmail: expect.stringContaining("@example.edu"),
          expiresAt: expect.any(String),
          revokedAt: null
        })
      ])
    );
  });
});
