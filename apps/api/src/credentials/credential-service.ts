import { CredentialCryptoService } from "@revealid/crypto";
import type { IssueCredentialInput } from "@revealid/crypto";
import type {
  AcademicClaimKey,
  CredentialDetailResponse,
  DeriveFromOpenCertsImportResponse,
  IssueCredentialRequest,
  IssuerCredential,
  NormalizedOpenCertsClaims,
  OpenCertsVerificationSummary,
  WalletCredential
} from "@revealid/contracts";
import {
  academicClaimKeys,
  bridgeDisclaimer,
  derivedSourceProvenanceSchema,
  deriveFromOpenCertsImportResponseSchema,
  opencertsHiddenByDefault
} from "@revealid/contracts";
import type { Prisma } from "../db.js";
import { EnvelopeEncryptionService, type EncryptedEnvelope } from "./envelope-encryption-service.js";
import { KeyManagementService } from "./key-management-service.js";

const credentialType = "RevealIDAcademicCredential";
const derivedCredentialType = "RevealIDDerivedAcademicCredential";
const derivedCredentialVct = "com.revealid.derivedAcademicCredential";
const credentialValidityMs = 1000 * 60 * 60 * 24 * 365 * 5;
export const credentialAad = (holderId: string, issuedAt: string) => `revealid:credential:${holderId}:${issuedAt}`;

const disclosureFrame = {
  _sd: ["degree", "graduationYear", "cgpa", "marks"]
} as unknown as IssueCredentialInput["disclosureFrame"];

const derivedDisclosureFrame = {
  _sd: ["recipientName", "institution", "credentialName", "course", "issuedOn", "graduationDate"]
} as unknown as IssueCredentialInput["disclosureFrame"];

const publicClaim = (value: unknown) => (typeof value === "string" || typeof value === "number" ? value : undefined);

const derivedClaimsFromNormalized = (
  normalizedClaims: NormalizedOpenCertsClaims,
  provenance: {
    sourceType: string;
    sourceFileHash: string;
    verifiedAt: string;
    verification: OpenCertsVerificationSummary;
  }
) => {
  const claims: Record<string, unknown> = {
    bridgeDisclaimer,
    sourceProvenance: provenance
  };
  const derivedPublicKeys = [
    "recipientName",
    "institution",
    "credentialName",
    "course",
    "issuedOn",
    "graduationDate"
  ] as const;
  for (const key of derivedPublicKeys) {
    const value = publicClaim(normalizedClaims[key]);
    if (value !== undefined) {
      claims[key] = value;
    }
  }
  return claims;
};

const visibleClaims = (claims: Record<string, unknown>) => {
  const visible: Partial<Record<AcademicClaimKey, string | number>> = {};
  for (const key of academicClaimKeys) {
    const value = publicClaim(claims[key]);
    if (value !== undefined) {
      visible[key] = value;
    }
  }
  return visible;
};

const derivedCredentialMetadata = (claims: Record<string, unknown>) => {
  const disclaimer: typeof bridgeDisclaimer | undefined =
    claims.bridgeDisclaimer === bridgeDisclaimer ? bridgeDisclaimer : undefined;
  const provenance = derivedSourceProvenanceSchema.safeParse(claims.sourceProvenance);
  return {
    ...(disclaimer ? { disclaimer } : {}),
    ...(provenance.success ? { sourceProvenance: provenance.data } : {})
  };
};

type WalletCredentialRecord = {
  id: string;
  credentialType: string;
  issuerName: string;
  issuedAt: Date;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
};

type IssuerCredentialRecord = WalletCredentialRecord & {
  holder: {
    email: string;
  };
};

export class CredentialService {
  constructor(
    private readonly prisma: Prisma,
    private readonly crypto: CredentialCryptoService,
    private readonly keys: KeyManagementService,
    private readonly envelopeEncryption: EnvelopeEncryptionService,
    private readonly issuerId: string,
    private readonly issuerName: string
  ) {}

  async issueCredential(issuerUserId: string, input: IssueCredentialRequest) {
    const holder = await this.prisma.user.findUnique({ where: { email: input.holderEmail.toLowerCase() } });
    if (!holder || holder.role !== "HOLDER") {
      throw new Error("Holder not found");
    }
    await this.keys.ensureHolderKey(holder.id);

    const issuer = await this.prisma.user.findUnique({ where: { id: issuerUserId } });
    if (!issuer || issuer.role !== "ISSUER") {
      throw new Error("Issuer not found");
    }

    const holderPublicJwk = await this.keys.getHolderPublicJwk(holder.id);
    const issuerKey = await this.keys.getIssuerSigningKey();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + credentialValidityMs);
    const sdJwt = await this.crypto.issueCredential({
      issuerId: this.issuerId,
      vct: credentialType,
      issuedAt: Math.floor(now.getTime() / 1000),
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      claims: {
        degree: input.degree,
        graduationYear: input.graduationYear,
        cgpa: input.cgpa,
        marks: input.marks
      },
      issuerPrivateJwk: issuerKey.privateJwk,
      issuerPublicJwk: issuerKey.publicJwk,
      holderPublicJwk,
      disclosureFrame
    });

    const issuedAt = now.toISOString();
    const credential = await this.prisma.credential.create({
      data: {
        holderId: holder.id,
        issuerId: issuer.id,
        credentialType,
        issuerName: issuer.name || this.issuerName,
        issuedAt: now,
        expiresAt,
        encryptedSdJwt: this.envelopeEncryption.encryptUtf8(sdJwt, credentialAad(holder.id, issuedAt))
      }
    });

    return this.toIssueResponse(credential);
  }

  async issueDerivedAcademicCredential(input: {
    holderId: string;
    sourceType: string;
    sourceFileHash: string;
    verifiedAt: Date;
    verificationSummary: OpenCertsVerificationSummary;
    normalizedClaims: NormalizedOpenCertsClaims;
  }): Promise<DeriveFromOpenCertsImportResponse> {
    const holder = await this.prisma.user.findUnique({ where: { id: input.holderId } });
    if (!holder || holder.role !== "HOLDER") {
      throw new Error("Holder not found");
    }
    await this.keys.ensureHolderKey(holder.id);

    const issuer = await this.prisma.user.findFirst({ where: { role: "ISSUER" }, orderBy: { createdAt: "asc" } });
    if (!issuer) {
      throw new Error("Issuer not found");
    }

    const holderPublicJwk = await this.keys.getHolderPublicJwk(holder.id);
    const issuerKey = await this.keys.getIssuerSigningKey();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + credentialValidityMs);
    const claims = derivedClaimsFromNormalized(input.normalizedClaims, {
      sourceType: input.sourceType,
      sourceFileHash: input.sourceFileHash,
      verifiedAt: input.verifiedAt.toISOString(),
      verification: input.verificationSummary
    });
    const sdJwt = await this.crypto.issueCredential({
      issuerId: this.issuerId,
      vct: derivedCredentialVct,
      issuedAt: Math.floor(now.getTime() / 1000),
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      claims,
      issuerPrivateJwk: issuerKey.privateJwk,
      issuerPublicJwk: issuerKey.publicJwk,
      holderPublicJwk,
      disclosureFrame: derivedDisclosureFrame
    });

    const issuedAt = now.toISOString();
    const credential = await this.prisma.credential.create({
      data: {
        holderId: holder.id,
        issuerId: issuer.id,
        credentialType: derivedCredentialType,
        issuerName: issuer.name || this.issuerName,
        issuedAt: now,
        expiresAt,
        encryptedSdJwt: this.envelopeEncryption.encryptUtf8(sdJwt, credentialAad(holder.id, issuedAt))
      }
    });

    return deriveFromOpenCertsImportResponseSchema.parse({
      credentialId: credential.id,
      walletStatus: "STORED",
      credentialType: derivedCredentialType,
      vct: derivedCredentialVct,
      hiddenByDefault: [...opencertsHiddenByDefault]
    });
  }

  async listWalletCredentials(holderId: string): Promise<WalletCredential[]> {
    const credentials = await this.prisma.credential.findMany({
      where: { holderId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        credentialType: true,
        issuerName: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true
      }
    });

    return (credentials as WalletCredentialRecord[]).map((credential) => ({
      id: credential.id,
      credentialType: credential.credentialType,
      issuerName: credential.issuerName,
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null
    }));
  }

  async listIssuerCredentials(issuerId: string): Promise<IssuerCredential[]> {
    const credentials = await this.prisma.credential.findMany({
      where: { issuerId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        credentialType: true,
        issuerName: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        holder: {
          select: {
            email: true
          }
        }
      }
    });

    return (credentials as IssuerCredentialRecord[]).map((credential) => ({
      id: credential.id,
      holderEmail: credential.holder.email,
      credentialType: credential.credentialType,
      issuerName: credential.issuerName,
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null
    }));
  }

  async getHolderCredentialDetail(holderId: string, credentialId: string): Promise<CredentialDetailResponse["credential"]> {
    const credential = await this.prisma.credential.findFirst({
      where: { id: credentialId, holderId },
      select: {
        id: true,
        credentialType: true,
        issuerName: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        encryptedSdJwt: true
      }
    });
    if (!credential) {
      throw new Error("Credential not found");
    }

    const sdJwt = this.envelopeEncryption.decryptUtf8(
      credential.encryptedSdJwt as unknown as EncryptedEnvelope,
      credentialAad(holderId, credential.issuedAt.toISOString())
    );
    const claims = await this.crypto.getPresentationClaims(sdJwt);

    return {
      id: credential.id,
      credentialType: credential.credentialType,
      issuerName: credential.issuerName,
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      claims: visibleClaims(claims as Record<string, unknown>),
      ...derivedCredentialMetadata(claims as Record<string, unknown>)
    };
  }

  private toIssueResponse(credential: {
    id: string;
    holderId: string;
    issuerId: string;
    credentialType: string;
    issuerName: string;
    issuedAt: Date;
  }) {
    return {
      id: credential.id,
      holderId: credential.holderId,
      issuerId: credential.issuerId,
      credentialType: credential.credentialType,
      issuerName: credential.issuerName,
      issuedAt: credential.issuedAt.toISOString()
    };
  }
}
