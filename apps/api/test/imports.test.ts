import argon2 from "argon2";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bridgeDisclaimer } from "@revealid/contracts";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { AcademicClaimNormalizer } from "../src/imports/academic-claim-normalizer.js";
import { IssuerPolicyError, OpenCertsIssuerPolicy } from "../src/imports/issuer-policy.js";
import {
  summarizeFragments,
  type SourceCredentialVerificationResult,
  type SourceCredentialVerifier
} from "../src/imports/source-credential-verification-service.js";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: "HOLDER" | "ISSUER";
  passwordHash: string;
  createdAt?: Date;
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
  verificationSummary?: unknown;
  normalizedClaims?: unknown;
  hiddenByDefault: string[];
  derivedCredentialId?: string | null;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "DERIVING" | "FAILED" | "DERIVED";
  failureCode?: string;
  verifiedAt?: Date;
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
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  holder?: UserRecord;
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
  credential?: CredentialRecord;
};

function makePrismaMock() {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const holderKeys = new Map<string, HolderKeyRecord>();
  const sourceCredentialImports = new Map<string, SourceCredentialImportRecord>();
  const credentials = new Map<string, CredentialRecord>();
  const shares = new Map<string, ShareRecord>();
  const verificationAudits: unknown[] = [];

  return {
    users,
    sessions,
    holderKeys,
    sourceCredentialImports,
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
      },
      findFirst: async ({ where }: { where: { role?: "HOLDER" | "ISSUER" } }) =>
        [...users.values()].find((user) => !where.role || user.role === where.role) ?? null
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
      create: async ({ data }: { data: Omit<CredentialRecord, "id" | "createdAt" | "revokedAt"> }) => {
        const credential = { id: randomUUID(), createdAt: new Date(), revokedAt: null, ...data };
        credentials.set(credential.id, credential);
        return credential;
      },
      findFirst: async ({ where }: { where: { id: string; holderId?: string } }) => {
        const credential = credentials.get(where.id);
        if (!credential || (where.holderId && credential.holderId !== where.holderId)) return null;
        return credential;
      },
      findMany: async ({ where }: { where?: { holderId?: string; issuerId?: string } } = {}) =>
        [...credentials.values()].filter((credential) => {
          if (where?.holderId) return credential.holderId === where.holderId;
          if (where?.issuerId) return credential.issuerId === where.issuerId;
          return true;
        })
    },
    share: {
      create: async ({ data }: { data: Omit<ShareRecord, "createdAt" | "views" | "revokedAt"> }) => {
        const share = { createdAt: new Date(), views: 0, revokedAt: null, ...data };
        shares.set(share.id, share);
        return share;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const share = [...shares.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!share) return null;
        const credential = credentials.get(share.credentialId);
        if (!credential) return null;
        return {
          ...share,
          credential: {
            ...credential,
            holder: users.get(credential.holderId)
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
      create: async ({ data }: { data: unknown }) => {
        verificationAudits.push(data);
        return { id: randomUUID(), createdAt: new Date(), data };
      }
    },
    sourceCredentialImport: {
      create: async ({ data }: { data: Omit<SourceCredentialImportRecord, "id" | "createdAt"> }) => {
        const sourceImport = { id: randomUUID(), createdAt: new Date(), ...data };
        sourceCredentialImports.set(sourceImport.id, sourceImport);
        return sourceImport;
      },
      findFirst: async ({ where }: { where: { id: string; holderId: string } }) => {
        const sourceImport = sourceCredentialImports.get(where.id);
        if (!sourceImport || sourceImport.holderId !== where.holderId) return null;
        return sourceImport;
      },
      update: async ({
        where,
        data
      }: {
        where: { id: string };
        data: Partial<SourceCredentialImportRecord>;
      }) => {
        const sourceImport = sourceCredentialImports.get(where.id);
        if (!sourceImport) throw new Error("OpenCerts import not found");
        const updated = { ...sourceImport, ...data };
        sourceCredentialImports.set(where.id, updated);
        return updated;
      },
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; holderId?: string; status?: SourceCredentialImportRecord["status"] };
        data: Partial<SourceCredentialImportRecord>;
      }) => {
        const sourceImport = sourceCredentialImports.get(where.id);
        if (
          !sourceImport ||
          (where.holderId && sourceImport.holderId !== where.holderId) ||
          (where.status && sourceImport.status !== where.status)
        ) {
          return { count: 0 };
        }
        sourceCredentialImports.set(where.id, { ...sourceImport, ...data });
        return { count: 1 };
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
  OPENCERTS_RPC_PROVIDER_URL: undefined,
  MAX_OPENCERTS_UPLOAD_BYTES: 1_048_576,
  OPENCERTS_RETAIN_SOURCE: false,
  OPENCERTS_SOURCE_RETENTION_DAYS: 31,
  COOKIE_SECURE: false
};

const cookieHeader = (setCookie: string[]) => setCookie.map((value) => value.split(";")[0]).join("; ");

const sepoliaFixture = JSON.parse(
  readFileSync(new URL("../../../samples/opencerts/sepolia.opencert", import.meta.url), "utf8")
) as Record<string, unknown>;

const validVerification: SourceCredentialVerificationResult = {
  sourceType: "OPENCERTS_V2",
  summary: {
    all: true,
    documentIntegrity: true,
    documentStatus: true,
    issuerIdentity: true
  },
  fragments: [],
  accepted: true
};

describe("OpenCerts import boundary", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let verificationResult: SourceCredentialVerificationResult;
  let sourceCredentialVerifier: SourceCredentialVerifier;

  beforeEach(async () => {
    prisma = makePrismaMock();
    verificationResult = validVerification;
    sourceCredentialVerifier = {
      verify: async () => verificationResult
    };
    prisma.users.set("22222222-2222-4222-8222-222222222222", {
      id: "22222222-2222-4222-8222-222222222222",
      email: "issuer@demo-university.edu",
      name: "Demo University",
      role: "ISSUER",
      passwordHash: await argon2.hash("DemoIssuerPass123!", { type: argon2.argon2id })
    });
    app = await buildApp({ config, prisma: prisma as never, sourceCredentialVerifier });
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires an authenticated holder and CSRF token", async () => {
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
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
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
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
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
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
      payload: { fileName: "sepolia.json", document: sepoliaFixture }
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("verifies, normalizes, and stores a safe import preview", async () => {
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
        document: sepoliaFixture,
        verificationMode: "LOCAL_TRUSTVC",
        issuerPolicyMode: "DEMO",
        retainEncryptedSource: false
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "verified",
      source: {
        type: "OPENCERTS_V2",
        verificationMode: "LOCAL_TRUSTVC",
        issuerPolicyMode: "DEMO",
        verification: {
          all: true,
          documentIntegrity: true,
          documentStatus: true,
          issuerIdentity: true
        },
        originalIssuerName: "Opencerts",
        originalIdentityLocation: "dev.opencerts.io",
        sampleMode: true
      },
      normalizedClaims: {
        recipientName: "Your Name",
        institution: "Opencerts",
        credentialName: "Opencerts Demo Certificate",
        course: "OpenCerts Demo",
        issuedOn: "2025-05-29T00:00:00+08:00",
        graduationDate: "2025-08-01T00:00:00+08:00"
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
    expect(JSON.stringify(response.json().normalizedClaims)).not.toContain("SXXXXXXXY");
    expect(JSON.stringify(response.json().normalizedClaims)).not.toContain("A+");
    expect(JSON.stringify(response.json().normalizedClaims)).not.toContain("123456");
    expect(JSON.stringify(response.json().normalizedClaims)).not.toContain("001");

    const storedImport = [...prisma.sourceCredentialImports.values()][0];
    expect(storedImport).toMatchObject({
      holderId: holderLogin.json().user.id,
      sourceType: "OPENCERTS_V2",
      verificationMode: "LOCAL_TRUSTVC",
      issuerPolicyMode: "DEMO",
      status: "VERIFIED"
    });
    expect(JSON.stringify(storedImport.normalizedClaims)).not.toContain("SXXXXXXXY");
    expect(JSON.stringify(storedImport.normalizedClaims)).not.toContain("A+");
    expect(JSON.stringify(storedImport.normalizedClaims)).not.toContain("123456");
    expect(JSON.stringify(storedImport.normalizedClaims)).not.toContain("001");
  });

  it("records and returns a normalized failure for tampered or unverifiable sources", async () => {
    verificationResult = {
      ...validVerification,
      summary: {
        all: false,
        documentIntegrity: false,
        documentStatus: true,
        issuerIdentity: true
      },
      accepted: false
    };
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
        document: {
          ...sepoliaFixture,
          data: {
            ...(sepoliaFixture.data as Record<string, unknown>),
            name: "tampered:string:Changed Certificate"
          }
        }
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      status: "invalid",
      failureCode: "source_verification_failed",
      verification: {
        documentIntegrity: false
      }
    });
    const failedImport = [...prisma.sourceCredentialImports.values()][0];
    expect(failedImport).toMatchObject({
      status: "FAILED",
      failureCode: "source_verification_failed"
    });
    expect(failedImport.normalizedClaims).toBeUndefined();
  });

  it("enforces issuer policy after verification", async () => {
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
        document: sepoliaFixture,
        issuerPolicyMode: "INSTITUTION_ONLY"
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      status: "invalid",
      failureCode: "issuer_policy_failed"
    });
    expect([...prisma.sourceCredentialImports.values()][0]).toMatchObject({
      status: "FAILED",
      failureCode: "issuer_policy_failed"
    });
  });

  it("derives a wallet credential from a verified import", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });

    const importResponse = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
    });

    const response = await app.inject({
      method: "POST",
      url: `/imports/opencerts/${importResponse.json().importId}/derive`,
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { credentialTemplate: "GRADUATION_PROOF" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      walletStatus: "STORED",
      credentialType: "RevealIDDerivedAcademicCredential",
      vct: "com.revealid.derivedAcademicCredential"
    });
    expect(response.json().hiddenByDefault).toEqual(
      expect.arrayContaining([
        "academicCredential.transcript",
        "academicCredential.additionalData.studentId",
        "academicCredential.additionalData.transcriptId"
      ])
    );

    const storedImport = prisma.sourceCredentialImports.get(importResponse.json().importId);
    expect(storedImport).toMatchObject({
      status: "DERIVED",
      derivedCredentialId: response.json().credentialId
    });

    const walletResponse = await app.inject({
      method: "GET",
      url: `/wallet/credentials/${response.json().credentialId}`,
      headers: { cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]) }
    });
    expect(walletResponse.statusCode).toBe(200);
    expect(walletResponse.json().credential).toMatchObject({
      credentialType: "RevealIDDerivedAcademicCredential",
      claims: {
        recipientName: "Your Name",
        institution: "Opencerts",
        credentialName: "Opencerts Demo Certificate",
        course: "OpenCerts Demo",
        graduationDate: "2025-08-01T00:00:00+08:00"
      }
    });
    expect(JSON.stringify(walletResponse.json())).not.toContain("A+");
    expect(JSON.stringify(walletResponse.json())).not.toContain("123456");
    expect(JSON.stringify(walletResponse.json())).not.toContain("001");
  });

  it("does not issue duplicate credentials for repeated derive requests", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });

    const importResponse = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
    });

    const deriveRequest = () =>
      app.inject({
        method: "POST",
        url: `/imports/opencerts/${importResponse.json().importId}/derive`,
        headers: {
          cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
          "x-csrf-token": holderLogin.json().csrfToken
        },
        payload: { credentialTemplate: "GRADUATION_PROOF" }
      });

    const responses = await Promise.all([deriveRequest(), deriveRequest()]);
    const statuses = responses.map((response) => response.statusCode).sort();

    expect(statuses).toEqual([201, 409]);
    expect(prisma.credentials.size).toBe(1);
    expect(prisma.sourceCredentialImports.get(importResponse.json().importId)).toMatchObject({
      status: "DERIVED",
      derivedCredentialId: responses.find((response) => response.statusCode === 201)?.json().credentialId
    });
  });

  it("shares derived credential claims without leaking hidden OpenCerts fields", async () => {
    const holderLogin = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "holder@example.edu", name: "Holder", password: "HolderPass123!" }
    });
    const importResponse = await app.inject({
      method: "POST",
      url: "/imports/opencerts",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { fileName: "sepolia.opencert", document: sepoliaFixture }
    });
    const deriveResponse = await app.inject({
      method: "POST",
      url: `/imports/opencerts/${importResponse.json().importId}/derive`,
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: { credentialTemplate: "GRADUATION_PROOF" }
    });

    const shareResponse = await app.inject({
      method: "POST",
      url: "/credentials/share",
      headers: {
        cookie: cookieHeader(holderLogin.headers["set-cookie"] as string[]),
        "x-csrf-token": holderLogin.json().csrfToken
      },
      payload: {
        credentialId: deriveResponse.json().credentialId,
        claims: ["recipientName", "institution", "course", "graduationDate"],
        ttlMinutes: 30,
        maxViews: 1
      }
    });
    expect(shareResponse.statusCode).toBe(201);
    expect(shareResponse.json().share.disclosedClaims).toEqual([
      "recipientName",
      "institution",
      "course",
      "graduationDate"
    ]);
    expect(JSON.stringify(shareResponse.json())).not.toContain("A+");
    expect(JSON.stringify(shareResponse.json())).not.toContain("123456");
    expect(JSON.stringify(shareResponse.json())).not.toContain("001");

    const token = new URL(shareResponse.json().share.verificationUrl).pathname.split("/").at(-1) ?? "";
    const verifyResponse = await app.inject({ method: "GET", url: `/shares/verify/${token}` });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      status: "verified",
      credentialType: "RevealIDDerivedAcademicCredential",
      claims: {
        recipientName: "Your Name",
        institution: "Opencerts",
        course: "OpenCerts Demo",
        graduationDate: "2025-08-01T00:00:00+08:00"
      },
      sourceProvenance: {
        sourceType: "OPENCERTS_V2",
        verification: {
          all: true,
          documentIntegrity: true,
          documentStatus: true,
          issuerIdentity: true
        }
      },
      disclaimer: bridgeDisclaimer
    });
    expect(verifyResponse.json().claims).not.toHaveProperty("credentialName");
    expect(JSON.stringify(verifyResponse.json())).not.toContain("A+");
    expect(JSON.stringify(verifyResponse.json())).not.toContain("123456");
    expect(JSON.stringify(verifyResponse.json())).not.toContain("001");
    expect(JSON.stringify(prisma.verificationAudits)).not.toContain("Your Name");
    expect(JSON.stringify(prisma.verificationAudits)).not.toContain("OpenCerts Demo");
  });
});

describe("OpenCerts source helpers", () => {
  it("normalizes the public fixture while keeping hidden fields separately addressable", () => {
    const normalized = new AcademicClaimNormalizer().normalize(sepoliaFixture);

    expect(normalized).toMatchObject({
      originalIssuerName: "Opencerts",
      originalIdentityLocation: "dev.opencerts.io",
      sampleMode: true,
      claims: {
        recipientName: "Your Name",
        institution: "Opencerts",
        credentialName: "Opencerts Demo Certificate",
        course: "OpenCerts Demo",
        additionalData: {
          studentId: "123456",
          transcriptId: "001"
        }
      }
    });
    expect(normalized.claims.transcript?.[0]).toMatchObject({
      courseCode: "CS 1110",
      name: "Introduction to Programming",
      grade: "A+",
      semester: "1"
    });
  });

  it("maps verification fragments into deterministic summaries", () => {
    expect(
      summarizeFragments(
        [
          { type: "DOCUMENT_INTEGRITY", status: "VALID" },
          { type: "DOCUMENT_STATUS", status: "SKIPPED" },
          { type: "ISSUER_IDENTITY", status: "VALID" }
        ],
        true
      )
    ).toEqual({
      all: true,
      documentIntegrity: true,
      documentStatus: true,
      issuerIdentity: true
    });

    expect(
      summarizeFragments(
        [
          { type: "DOCUMENT_INTEGRITY", status: "INVALID" },
          { type: "DOCUMENT_STATUS", status: "VALID" },
          { type: "ISSUER_IDENTITY", status: "VALID" }
        ],
        false
      )
    ).toMatchObject({
      all: false,
      documentIntegrity: false
    });
  });

  it("rejects the demo fixture in institution-only issuer policy mode", () => {
    const normalized = new AcademicClaimNormalizer().normalize(sepoliaFixture);
    const policy = new OpenCertsIssuerPolicy();

    expect(() => policy.enforce("DEMO", normalized)).not.toThrow();
    expect(() => policy.enforce("INSTITUTION_ONLY", normalized)).toThrow(IssuerPolicyError);
  });

  it("recognizes public OpenCerts demo issuers in demo policy mode", () => {
    const normalized = new AcademicClaimNormalizer().normalize({
      data: {
        issuers: [
          {
            name: "Opencerts",
            identityProof: {
              location: "opencerts.io"
            }
          }
        ]
      }
    });
    const policy = new OpenCertsIssuerPolicy();

    expect(normalized.sampleMode).toBe(true);
    expect(() => policy.enforce("DEMO", normalized)).not.toThrow();
  });
});
