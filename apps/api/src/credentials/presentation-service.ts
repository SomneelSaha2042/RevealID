import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CredentialCryptoService } from "@revealid/crypto";
import type {
  AcademicClaimKey,
  CreateShareRequest,
  CreateShareResponse,
  ShareHistoryItem,
  VerifyShareResponse
} from "@revealid/contracts";
import type { Prisma as PrismaTypes } from "@prisma/client";
import type { Prisma } from "../db.js";
import { credentialAad } from "./credential-service.js";
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
        issuedAt: true
      }
    });
    if (!credential) {
      throw new Error("Credential not found");
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
            issuerName: true
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
    const tokenHash = hashToken(token);
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
      throw new Error("Share not found");
    }
    if (share.revokedAt) {
      throw new Error("Share revoked");
    }
    if (share.expiresAt.getTime() <= Date.now()) {
      throw new Error("Share expired");
    }
    if (share.views >= share.maxViews) {
      throw new Error("Share exhausted");
    }

    const presentation = this.envelopeEncryption.decryptUtf8(
      share.encryptedPresentation as unknown as EncryptedEnvelope,
      shareAad(share.id)
    );
    const issuerKey = await this.keys.getIssuerSigningKey();
    const holderPublicJwk = await this.keys.getHolderPublicJwk(share.credential.holder.id);
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
    const claims = publicClaims(await this.crypto.getPresentationClaims(presentation));

    await this.prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 }
    });

    return {
      status: "verified",
      credentialType: share.credential.credentialType,
      issuerName: share.credential.issuerName,
      issuedAt: share.credential.issuedAt.toISOString(),
      audience: share.audience,
      expiresAt: share.expiresAt.toISOString(),
      claims
    };
  }
}
