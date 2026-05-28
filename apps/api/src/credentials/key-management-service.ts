import { randomBytes } from "node:crypto";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { exportJWK, generateKeyPair, importJWK } from "jose";
import type { JWK } from "jose";
import type { Prisma } from "../db.js";
import { EnvelopeEncryptionService, type EncryptedEnvelope } from "./envelope-encryption-service.js";

const holderKeyAad = (userId: string) => `revealid:holder-key:${userId}`;

const withKid = async (jwk: JWK): Promise<JWK> => {
  if (jwk.kid) {
    return jwk;
  }
  return { ...jwk, kid: randomBytes(8).toString("base64url") };
};

const publicFromPrivate = (privateJwk: JWK): JWK => {
  const { crv, kid, kty, x } = privateJwk;
  return { crv, kid, kty, x };
};

export class KeyManagementService {
  private issuerPrivateJwk?: JWK;
  private issuerPublicJwk?: JWK;

  constructor(
    private readonly prisma: Prisma,
    private readonly envelopeEncryption: EnvelopeEncryptionService,
    private readonly issuerPrivateJwkJson?: string
  ) {}

  async createHolderKey(userId: string) {
    const keyPair = await generateKeyPair("Ed25519");
    const privateJwk = await exportJWK(keyPair.privateKey);
    const publicJwk = await exportJWK(keyPair.publicKey);
    const publicWithKid = await withKid(publicJwk);
    const privateWithKid = { ...privateJwk, kid: publicWithKid.kid };

    await this.prisma.holderKey.create({
      data: {
        userId,
        publicJwk: publicWithKid as unknown as PrismaTypes.InputJsonValue,
        encryptedPrivateJwk: this.envelopeEncryption.encryptUtf8(
          JSON.stringify(privateWithKid),
          holderKeyAad(userId)
        ) as unknown as PrismaTypes.InputJsonValue
      }
    });
  }

  async ensureHolderKey(userId: string) {
    const existing = await this.prisma.holderKey.findUnique({ where: { userId } });
    if (existing) {
      return;
    }
    await this.createHolderKey(userId);
  }

  async getHolderPublicJwk(userId: string): Promise<JWK> {
    const holderKey = await this.prisma.holderKey.findUnique({ where: { userId } });
    if (!holderKey) {
      throw new Error("Holder key not found");
    }
    return holderKey.publicJwk as unknown as JWK;
  }

  async getHolderPrivateJwk(userId: string): Promise<JWK> {
    const holderKey = await this.prisma.holderKey.findUnique({ where: { userId } });
    if (!holderKey) {
      throw new Error("Holder key not found");
    }
    const json = this.envelopeEncryption.decryptUtf8(
      holderKey.encryptedPrivateJwk as unknown as EncryptedEnvelope,
      holderKeyAad(userId)
    );
    return JSON.parse(json) as JWK;
  }

  async getIssuerSigningKey(): Promise<{ privateJwk: JWK; publicJwk: JWK }> {
    if (this.issuerPrivateJwk && this.issuerPublicJwk) {
      return { privateJwk: this.issuerPrivateJwk, publicJwk: this.issuerPublicJwk };
    }

    const configured = this.issuerPrivateJwkJson
      ? (JSON.parse(this.issuerPrivateJwkJson) as JWK)
      : await this.generateEphemeralIssuerKey();
    await importJWK(configured, "EdDSA");
    const publicWithKid = await withKid(publicFromPrivate(configured));

    this.issuerPrivateJwk = { ...configured, kid: publicWithKid.kid };
    this.issuerPublicJwk = publicWithKid;
    return { privateJwk: this.issuerPrivateJwk, publicJwk: this.issuerPublicJwk };
  }

  async getIssuerJwks() {
    const { publicJwk } = await this.getIssuerSigningKey();
    return {
      keys: [{ ...publicJwk, alg: "EdDSA", use: "sig" }]
    };
  }

  private async generateEphemeralIssuerKey(): Promise<JWK> {
    const keyPair = await generateKeyPair("Ed25519");
    const privateJwk = await exportJWK(keyPair.privateKey);
    const publicJwk = await exportJWK(keyPair.publicKey);
    return { ...privateJwk, kid: (await withKid(publicJwk)).kid };
  }
}
