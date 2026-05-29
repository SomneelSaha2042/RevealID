import type { Prisma } from "../db.js";

export class CredentialStatusService {
  constructor(private readonly prisma: Prisma) {}

  async revokeCredential(issuerId: string, credentialId: string) {
    const credential = await this.prisma.credential.findFirst({
      where: { id: credentialId, issuerId },
      select: { id: true, revokedAt: true }
    });
    if (!credential) {
      throw new Error("Credential not found");
    }
    if (credential.revokedAt) {
      return { id: credential.id, revokedAt: credential.revokedAt.toISOString() };
    }
    const updated = await this.prisma.credential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true }
    });
    if (!updated.revokedAt) {
      throw new Error("Credential revoke failed");
    }
    return { id: updated.id, revokedAt: updated.revokedAt.toISOString() };
  }

  isRevoked(credential: { revokedAt?: Date | null }) {
    return Boolean(credential.revokedAt);
  }
}
