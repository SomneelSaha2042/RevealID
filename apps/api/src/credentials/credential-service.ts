import { CredentialCryptoService } from "@revealid/crypto";
import type { IssueCredentialInput } from "@revealid/crypto";
import type { CredentialDetailResponse, IssueCredentialRequest, WalletCredential } from "@revealid/contracts";
import type { Prisma } from "../db.js";
import { EnvelopeEncryptionService, type EncryptedEnvelope } from "./envelope-encryption-service.js";
import { KeyManagementService } from "./key-management-service.js";

const credentialType = "RevealIDAcademicCredential";
export const credentialAad = (holderId: string, issuedAt: string) => `revealid:credential:${holderId}:${issuedAt}`;

const disclosureFrame = {
  _sd: ["degree", "graduationYear", "cgpa", "marks"]
} satisfies IssueCredentialInput["disclosureFrame"];

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
    const sdJwt = await this.crypto.issueCredential({
      issuerId: this.issuerId,
      vct: credentialType,
      issuedAt: Math.floor(now.getTime() / 1000),
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
        encryptedSdJwt: this.envelopeEncryption.encryptUtf8(sdJwt, credentialAad(holder.id, issuedAt))
      }
    });

    return this.toIssueResponse(credential);
  }

  async listWalletCredentials(holderId: string): Promise<WalletCredential[]> {
    const credentials = await this.prisma.credential.findMany({
      where: { holderId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        credentialType: true,
        issuerName: true,
        issuedAt: true
      }
    });

    return credentials.map((credential) => ({
      id: credential.id,
      credentialType: credential.credentialType,
      issuerName: credential.issuerName,
      issuedAt: credential.issuedAt.toISOString()
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
      claims: {
        degree: String(claims.degree),
        graduationYear: Number(claims.graduationYear),
        cgpa: Number(claims.cgpa),
        marks: Number(claims.marks)
      }
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
