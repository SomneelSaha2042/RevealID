import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedEnvelope = {
  alg: "A256GCM";
  iv: string;
  ciphertext: string;
  tag: string;
};

const decodeKey = (key: string) => {
  const decoded = Buffer.from(key, "base64url");
  if (decoded.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return decoded;
};

export class EnvelopeEncryptionService {
  private readonly key: Buffer;

  constructor(key: string) {
    this.key = decodeKey(key);
  }

  encryptUtf8(plaintext: string, aad: string): EncryptedEnvelope {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      alg: "A256GCM",
      iv: iv.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      tag: tag.toString("base64url")
    };
  }

  decryptUtf8(envelope: EncryptedEnvelope, aad: string): string {
    if (envelope.alg !== "A256GCM") {
      throw new Error("Unsupported envelope algorithm");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64url"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }
}
