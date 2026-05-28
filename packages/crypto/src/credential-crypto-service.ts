import { digest, generateSalt } from "@sd-jwt/crypto-nodejs";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import type {
  DisclosureFrame,
  JwtPayload,
  KbVerifier,
  PresentationFrame,
  Signer,
  Verifier
} from "@sd-jwt/types";
import type { SdJwtVcPayload } from "@sd-jwt/sd-jwt-vc";
import {
  base64url,
  calculateJwkThumbprint,
  compactVerify,
  FlattenedSign,
  importJWK
} from "jose";
import type { JWK } from "jose";

export type AcademicCredentialClaims = {
  degree: string;
  graduationYear: number;
  cgpa: number;
  marks: number;
};

export type HolderBinding = {
  audience: string;
  nonce: string;
  issuedAt: number;
};

export type IssueCredentialInput = {
  issuerId: string;
  vct: string;
  issuedAt: number;
  claims: AcademicCredentialClaims;
  issuerPrivateJwk: JWK;
  issuerPublicJwk: JWK;
  holderPublicJwk: JWK;
  disclosureFrame: DisclosureFrame<AcademicCredentialPayload>;
};

export type CreatePresentationInput = {
  credential: string;
  presentationFrame: PresentationFrame<AcademicCredentialPayload>;
  holderPrivateJwk: JWK;
  holderPublicJwk: JWK;
  binding?: HolderBinding;
};

export type VerifyPresentationInput = {
  presentation: string;
  issuerPublicJwk: JWK;
  holderPublicJwk: JWK;
  binding?: HolderBinding;
  requireHolderBinding: boolean;
};

export type AcademicCredentialPayload = AcademicCredentialClaims & {
  iss: string;
  iat: number;
  vct: string;
  cnf: {
    jwk: JWK;
  };
};

const textDecoder = new TextDecoder();

const parseSigningInput = (data: string) => {
  const parts = data.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid signing input");
  }
  const [headerB64, payloadB64] = parts;
  const headerJson = textDecoder.decode(base64url.decode(headerB64));
  const payloadBytes = base64url.decode(payloadB64);
  return {
    header: JSON.parse(headerJson) as Record<string, unknown>,
    payloadBytes,
    payloadJson: JSON.parse(textDecoder.decode(payloadBytes)) as Record<
      string,
      unknown
    >
  };
};

const createJoseSigner = async (privateJwk: JWK): Promise<Signer> => {
  const key = await importJWK(privateJwk, "EdDSA");
  return async (data: string) => {
    const { header, payloadBytes } = parseSigningInput(data);
    const { signature } = await new FlattenedSign(payloadBytes)
      .setProtectedHeader(header)
      .sign(key);
    return signature;
  };
};

const createJoseVerifier = async (publicJwk: JWK): Promise<Verifier> => {
  const key = await importJWK(publicJwk, "EdDSA");
  return async (data: string, signature: string) => {
    const jws = `${data}.${signature}`;
    try {
      await compactVerify(jws, key);
      return true;
    } catch {
      return false;
    }
  };
};

const createJoseKbVerifier = async (
  publicJwk: JWK,
  expectedBinding: HolderBinding | undefined,
  expectedThumbprint: string
): Promise<KbVerifier> => {
  const key = await importJWK(publicJwk, "EdDSA");
  return async (data: string, signature: string, payload: JwtPayload) => {
    const { payloadJson } = parseSigningInput(data);
    const kbPayload = payloadJson as {
      aud?: string;
      nonce?: string;
      iat?: number;
      sd_hash?: string;
    };

    if (!expectedBinding) {
      return false;
    }

    if (
      kbPayload.aud !== expectedBinding.audience ||
      kbPayload.nonce !== expectedBinding.nonce ||
      kbPayload.iat !== expectedBinding.issuedAt
    ) {
      return false;
    }

    const cnfJwk = payload?.cnf?.jwk as JWK | undefined;
    if (!cnfJwk) {
      return false;
    }
    const cnfThumbprint = await calculateJwkThumbprint(cnfJwk);
    if (cnfThumbprint !== expectedThumbprint) {
      return false;
    }

    const jws = `${data}.${signature}`;
    try {
      await compactVerify(jws, key);
      return true;
    } catch {
      return false;
    }
  };
};

const createSdJwtInstance = async (options: {
  issuerSigner?: Signer;
  issuerVerifier?: Verifier;
  holderSigner?: Signer;
  holderVerifier?: KbVerifier;
}) => {
  return new SDJwtVcInstance({
    signer: options.issuerSigner,
    signAlg: options.issuerSigner ? "EdDSA" : undefined,
    verifier: options.issuerVerifier,
    kbSigner: options.holderSigner,
    kbSignAlg: options.holderSigner ? "EdDSA" : undefined,
    kbVerifier: options.holderVerifier,
    hasher: digest,
    hashAlg: "sha-256",
    saltGenerator: generateSalt
  });
};

export class CredentialCryptoService {
  async issueCredential(input: IssueCredentialInput): Promise<string> {
    const signer = await createJoseSigner(input.issuerPrivateJwk);
    const verifier = await createJoseVerifier(input.issuerPublicJwk);
    const sdjwt = await createSdJwtInstance({
      issuerSigner: signer,
      issuerVerifier: verifier
    });

    const payload: AcademicCredentialPayload = {
      iss: input.issuerId,
      iat: input.issuedAt,
      vct: input.vct,
      cnf: {
        jwk: input.holderPublicJwk
      },
      ...input.claims
    };

    return sdjwt.issue(payload, input.disclosureFrame);
  }

  async createPresentation(input: CreatePresentationInput): Promise<string> {
    const holderSigner = await createJoseSigner(input.holderPrivateJwk);
    const sdjwt = await createSdJwtInstance({
      holderSigner
    });

    if (!input.binding) {
      return sdjwt.present(input.credential, input.presentationFrame);
    }

    return sdjwt.present(input.credential, input.presentationFrame, {
      kb: {
        payload: {
          aud: input.binding.audience,
          nonce: input.binding.nonce,
          iat: input.binding.issuedAt
        }
      }
    });
  }

  async verifyPresentation(input: VerifyPresentationInput) {
    const issuerVerifier = await createJoseVerifier(input.issuerPublicJwk);
    const holderThumbprint = await calculateJwkThumbprint(
      input.holderPublicJwk
    );
    const holderVerifier = await createJoseKbVerifier(
      input.holderPublicJwk,
      input.binding,
      holderThumbprint
    );
    const sdjwt = await createSdJwtInstance({
      issuerVerifier,
      holderVerifier
    });

    return sdjwt.verify(
      input.presentation,
      undefined,
      input.requireHolderBinding
    );
  }

  async getPresentationClaims(presentation: string) {
    const sdjwt = await createSdJwtInstance({});
    return sdjwt.getClaims(presentation) as Promise<SdJwtVcPayload>;
  }
}
