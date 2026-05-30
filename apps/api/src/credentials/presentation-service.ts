import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CredentialCryptoService } from "@revealid/crypto";
import type {
  AcademicClaimKey,
  CreateShareRequest,
  CreateShareResponse,
  ShareHistoryItem,
  VerificationCheck,
  VerificationFailureCode,
  VerifyCredentialResponse,
  VerifyShareResponse
} from "@revealid/contracts";
import type { Prisma as PrismaTypes } from "@prisma/client";
import type { Prisma } from "../db.js";
import { credentialAad } from "./credential-service.js";
import { CredentialStatusService } from "./credential-status-service.js";
import { EnvelopeEncryptionService, type EncryptedEnvelope } from "./envelope-encryption-service.js";
import { KeyManagementService } from "./key-management-service.js";

const allClaimKeys = ["degree", "graduationYear", "cgpa", "marks"] as const satisfies readonly AcademicClaimKey[];
const shareAad = (shareId: string) => `revealid:share:${shareId}`;

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");

const toPresentationFrame = (claims: AcademicClaimKey[]) =>
  Object.fromEntries(claims.map((claim) => [claim, true]));

const publicClaims = (claims: Record<string, unknown>) => {
  const disclosed: Partial<Record<AcademicClaimKey, string | number>> = {};
  for (const key of allClaimKeys) {
    if (typeof claims[key] === "string" || typeof claims[key] === "number") {
      disclosed[key] = claims[key];
    }
  }
  return disclosed;
};

export class PresentationService {
  constructor(
    private readonly prisma: Prisma,
    private readonly crypto: CredentialCryptoService,
    private readonly keys: KeyManagementService,
    private readonly envelopeEncryption: EnvelopeEncryptionService,
    private readonly credentialStatus: CredentialStatusService,
    private readonly webOrigin: string
  ) {}

  async createShare(holderId: string, input: CreateShareRequest): Promise<CreateShareResponse["share"]> {
    const disclosedClaims = [...new Set(input.claims)];
    const privateClaims = allClaimKeys.filter((claim) => !disclosedClaims.includes(claim));
    const credential = await this.prisma.credential.findFirst({
      where: { id: input.credentialId, holderId },
      select: {
        id: true,
        holderId: true,
        credentialType: true,
        issuerName: true,
        encryptedSdJwt: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true
      }
    });
    if (!credential) {
      throw new Error("Credential not found");
    }
    if (this.credentialStatus.isRevoked(credential)) {
      throw new Error("Credential revoked");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const shareId = randomUUID();
    const verificationUrl = new URL(`/verify/${token}`, this.webOrigin).toString();
    const audience = input.audience ?? new URL("/verify", this.webOrigin).toString();
    const nonce = randomBytes(16).toString("base64url");
    const keyBindingIssuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000);
    const sdJwt = this.envelopeEncryption.decryptUtf8(
      credential.encryptedSdJwt as unknown as EncryptedEnvelope,
      credentialAad(holderId, credential.issuedAt.toISOString())
    );

    const presentation = await this.crypto.createPresentation({
      credential: sdJwt,
      presentationFrame: toPresentationFrame(disclosedClaims),
      holderPrivateJwk: await this.keys.getHolderPrivateJwk(holderId),
      holderPublicJwk: await this.keys.getHolderPublicJwk(holderId),
      binding: {
        audience,
        nonce,
        issuedAt: keyBindingIssuedAt
      }
    });

    await this.prisma.share.create({
      data: {
        id: shareId,
        holderId,
        credentialId: credential.id,
        tokenHash,
        audience,
        nonce,
        keyBindingIssuedAt,
        encryptedPresentation: this.envelopeEncryption.encryptUtf8(
          presentation,
          shareAad(shareId)
        ) as unknown as PrismaTypes.InputJsonValue,
        disclosedClaims,
        privateClaims,
        expiresAt,
        maxViews: input.maxViews
      }
    });

    return {
      id: shareId,
      verificationUrl,
      qrPayload: verificationUrl,
      expiresAt: expiresAt.toISOString(),
      maxViews: input.maxViews,
      disclosedClaims
    };
  }

  async listShares(holderId: string): Promise<ShareHistoryItem[]> {
    const shares = await this.prisma.share.findMany({
      where: { holderId },
      orderBy: { createdAt: "desc" },
      include: {
        credential: {
          select: {
            credentialType: true,
            issuerName: true,
            expiresAt: true,
            revokedAt: true
          }
        }
      }
    });

    return shares.map((share) => ({
      id: share.id,
      credentialId: share.credentialId,
      credentialType: share.credential.credentialType,
      issuerName: share.credential.issuerName,
      audience: share.audience,
      expiresAt: share.expiresAt.toISOString(),
      maxViews: share.maxViews,
      views: share.views,
      revokedAt: share.revokedAt?.toISOString() ?? null,
      credentialExpiresAt: share.credential.expiresAt?.toISOString() ?? null,
      credentialRevokedAt: share.credential.revokedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
      disclosedClaims: share.disclosedClaims as AcademicClaimKey[]
    }));
  }

  async cancelShare(holderId: string, shareId: string) {
    const share = await this.prisma.share.findFirst({ where: { id: shareId, holderId } });
    if (!share) {
      throw new Error("Share not found");
    }
    await this.prisma.share.update({
      where: { id: shareId },
      data: { revokedAt: new Date() }
    });
  }

  async verifyShare(token: string): Promise<VerifyShareResponse> {
    const verification = await this.verifyCredential(token);
    if (verification.status === "invalid") {
      throw new Error(`Verification ${verification.failureCode}`);
    }
    return verification;
  }

  async verifyCredential(
    token: string,
    auditContext?: { ip?: string; userAgent?: string }
  ): Promise<VerifyCredentialResponse> {
    const tokenHash = hashToken(token);
    const checks = createVerificationChecks();
    const share = await this.prisma.share.findUnique({
      where: { tokenHash },
      include: {
        credential: {
          include: {
            holder: {
            select: {
                id: true
              }
            }
          }
        }
      }
    });
    if (!share) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "share_token"),
        failureCode: token.length < 32 ? "malformed" : "unknown",
        message: token.length < 32 ? "Malformed or unknown verification token." : "Unknown verification token.",
        auditContext
      });
    }
    passCheck(checks, "share_token");
    if (share.revokedAt) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "share_state"),
        failureCode: "cancelled",
        message: "This share link was cancelled by the holder.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    if (share.expiresAt.getTime() <= Date.now()) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "share_state"),
        failureCode: "expired",
        message: "This share link has expired.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    if (share.views >= share.maxViews) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "share_state"),
        failureCode: "exhausted",
        message: "This share link has already been used the maximum number of times.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    passCheck(checks, "share_state");

    let presentation: string;
    try {
      presentation = this.envelopeEncryption.decryptUtf8(
        share.encryptedPresentation as unknown as EncryptedEnvelope,
        shareAad(share.id)
      );
      passCheck(checks, "presentation_decryption");
    } catch {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "presentation_decryption"),
        failureCode: "tampered",
        message: "The encrypted presentation could not be opened.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    const issuerKey = await this.keys.getIssuerSigningKey();
    const holderPublicJwk = await this.keys.getHolderPublicJwk(share.credential.holder.id);
    try {
      await this.crypto.verifyPresentation({
        presentation,
        issuerPublicJwk: issuerKey.publicJwk,
        holderPublicJwk,
        binding: {
          audience: share.audience,
          nonce: share.nonce,
          issuedAt: share.keyBindingIssuedAt
        },
        requireHolderBinding: true
      });
      passCheck(checks, "issuer_signature");
      passCheck(checks, "disclosure_digests");
      passCheck(checks, "holder_binding");
      passCheck(checks, "audience");
      passCheck(checks, "nonce");
    } catch {
      failCheck(checks, "issuer_signature");
      failCheck(checks, "disclosure_digests");
      failCheck(checks, "holder_binding");
      failCheck(checks, "audience");
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "nonce"),
        failureCode: "tampered",
        message: "The presentation failed cryptographic verification.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }

    const presentationClaims = await this.crypto.getPresentationClaims(presentation);
    const exp = presentationClaims.exp;
    if (typeof exp === "number" && exp <= Math.floor(Date.now() / 1000)) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "credential_expiry"),
        failureCode: "expired",
        message: "The credential has expired.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    if (share.credential.expiresAt && share.credential.expiresAt.getTime() <= Date.now()) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "credential_expiry"),
        failureCode: "expired",
        message: "The credential has expired.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    markCheck(
      checks,
      "credential_expiry",
      typeof exp === "number" || share.credential.expiresAt ? "passed" : "skipped"
    );

    if (this.credentialStatus.isRevoked(share.credential)) {
      return this.invalidVerification({
        tokenHash,
        checks: failCheck(checks, "credential_status"),
        failureCode: "revoked",
        message: "The issuer has revoked this credential.",
        shareId: share.id,
        credentialId: share.credentialId,
        auditContext
      });
    }
    passCheck(checks, "credential_status");
    const claims = publicClaims(presentationClaims);

    await this.prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 }
    });

    const response = {
      status: "verified",
      credentialType: share.credential.credentialType,
      issuerName: share.credential.issuerName,
      issuedAt: share.credential.issuedAt.toISOString(),
      audience: share.audience,
      expiresAt: share.expiresAt.toISOString(),
      claims,
      checks
    } satisfies VerifyCredentialResponse;
    await this.auditVerification({
      tokenHash,
      shareId: share.id,
      credentialId: share.credentialId,
      result: "verified",
      checks,
      auditContext
    });
    return response;
  }

  private async invalidVerification(input: {
    tokenHash: string;
    checks: VerificationCheck[];
    failureCode: VerificationFailureCode;
    message: string;
    shareId?: string;
    credentialId?: string;
    auditContext?: { ip?: string; userAgent?: string };
  }): Promise<VerifyCredentialResponse> {
    await this.auditVerification({
      tokenHash: input.tokenHash,
      shareId: input.shareId,
      credentialId: input.credentialId,
      result: "invalid",
      failureCode: input.failureCode,
      checks: input.checks,
      auditContext: input.auditContext
    });
    return {
      status: "invalid",
      failureCode: input.failureCode,
      message: input.message,
      checks: input.checks
    };
  }

  private async auditVerification(input: {
    tokenHash: string;
    shareId?: string;
    credentialId?: string;
    result: "verified" | "invalid";
    failureCode?: VerificationFailureCode;
    checks: VerificationCheck[];
    auditContext?: { ip?: string; userAgent?: string };
  }) {
    await this.prisma.verificationAudit.create({
      data: {
        shareId: input.shareId,
        credentialId: input.credentialId,
        tokenHashPrefix: input.tokenHash.slice(0, 16),
        result: input.result,
        failureCode: input.failureCode,
        checks: input.checks as unknown as PrismaTypes.InputJsonValue,
        requestIpHash: input.auditContext?.ip ? hashToken(input.auditContext.ip) : undefined,
        userAgentHash: input.auditContext?.userAgent ? hashToken(input.auditContext.userAgent) : undefined
      }
    });
  }
}

const checkDefinitions = [
  ["share_token", "Share token resolved"],
  ["share_state", "Share link active"],
  ["presentation_decryption", "Stored presentation decrypted"],
  ["issuer_signature", "Issuer signature verified"],
  ["disclosure_digests", "Disclosed claim digests verified"],
  ["holder_binding", "Holder key binding verified"],
  ["audience", "Expected audience matched"],
  ["nonce", "Expected nonce matched"],
  ["credential_expiry", "Credential expiry checked"],
  ["credential_status", "Credential revocation status checked"]
] as const satisfies readonly [VerificationCheck["id"], string][];

const createVerificationChecks = (): VerificationCheck[] =>
  checkDefinitions.map(([id, label]) => ({ id, label, status: "skipped" }));

const markCheck = (checks: VerificationCheck[], id: VerificationCheck["id"], status: VerificationCheck["status"]) => {
  const check = checks.find((candidate) => candidate.id === id);
  if (check) {
    check.status = status;
  }
  return checks;
};

const passCheck = (checks: VerificationCheck[], id: VerificationCheck["id"]) => markCheck(checks, id, "passed");
const failCheck = (checks: VerificationCheck[], id: VerificationCheck["id"]) => markCheck(checks, id, "failed");
