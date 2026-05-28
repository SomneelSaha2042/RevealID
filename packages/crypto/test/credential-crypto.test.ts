import { describe, expect, test } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import type { JWK } from "jose";
import { digest } from "@sd-jwt/crypto-nodejs";
import type { DisclosureFrame, PresentationFrame } from "@sd-jwt/types";
import { Disclosure } from "@sd-jwt/utils";
import {
  CredentialCryptoService,
  type AcademicCredentialPayload,
  type HolderBinding
} from "../src/index.js";

const service = new CredentialCryptoService();

const issuerId = "https://issuer.revealid.example";
const vct = "RevealIDAcademicCredential";

const disclosureFrame: DisclosureFrame<AcademicCredentialPayload> = {
  _sd: ["degree", "graduationYear", "cgpa", "marks"]
};

const presentationFrame: PresentationFrame<AcademicCredentialPayload> = {
  degree: true,
  graduationYear: true
};

const createKeys = async () => {
  const issuer = await generateKeyPair("Ed25519");
  const holder = await generateKeyPair("Ed25519");
  return {
    issuerPrivateJwk: await exportJWK(issuer.privateKey),
    issuerPublicJwk: await exportJWK(issuer.publicKey),
    holderPrivateJwk: await exportJWK(holder.privateKey),
    holderPublicJwk: await exportJWK(holder.publicKey)
  };
};

const createCredential = (holderPublicJwk: JWK) => {
  return {
    issuerId,
    vct,
    issuedAt: Math.floor(Date.now() / 1000),
    claims: {
      degree: "BSc Computer Science",
      graduationYear: 2024,
      cgpa: 3.9,
      marks: 875
    },
    holderPublicJwk,
    disclosureFrame
  };
};

const createBinding = (): HolderBinding => ({
  audience: "revealid:verifier",
  nonce: "nonce-123",
  issuedAt: Math.floor(Date.now() / 1000)
});

const tamperDisclosure = async (
  presentation: string,
  key: string,
  value: string
) => {
  const parts = presentation.split("~");
  const jwt = parts[0];
  const kbJwt = parts.length > 2 ? parts[parts.length - 1] : "";
  const disclosureParts = parts.slice(1, parts.length - 1);
  const tampered = [] as string[];

  for (const disclosure of disclosureParts) {
    if (!disclosure) {
      continue;
    }
    const decoded = await Disclosure.fromEncode(disclosure, {
      hasher: digest,
      alg: "sha-256"
    });
    const data = decoded.decode();
    if (Array.isArray(data) && data.length === 3 && data[1] === key) {
      const newDisclosure = Disclosure.fromArray([data[0], key, value]);
      tampered.push(newDisclosure.encode());
    } else {
      tampered.push(disclosure);
    }
  }

  return [jwt, ...tampered, kbJwt].join("~");
};

describe("CredentialCryptoService", () => {
  test("valid verification succeeds", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const binding = createBinding();
    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding
    });

    const verified = await service.verifyPresentation({
      presentation,
      issuerPublicJwk: keys.issuerPublicJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding,
      requireHolderBinding: true
    });

    expect(verified).toBeDefined();
  });

  test("presentation excludes cgpa and marks", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const binding = createBinding();
    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding
    });

    const claims = await service.getPresentationClaims(presentation);
    expect(presentation).not.toContain("cgpa");
    expect(presentation).not.toContain("marks");
    expect(presentation).not.toContain("3.9");
    expect(presentation).not.toContain("875");
    expect(claims).toMatchObject({
      degree: "BSc Computer Science",
      graduationYear: 2024
    });
    expect("cgpa" in claims).toBe(false);
    expect("marks" in claims).toBe(false);
  });

  test("modified disclosed value fails", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const binding = createBinding();
    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding
    });

    const tampered = await tamperDisclosure(presentation, "degree", "MBA");

    await expect(
      service.verifyPresentation({
        presentation: tampered,
        issuerPublicJwk: keys.issuerPublicJwk,
        holderPublicJwk: keys.holderPublicJwk,
        binding,
        requireHolderBinding: true
      })
    ).rejects.toThrow();
  });

  test("wrong audience fails", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const binding = createBinding();
    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding
    });

    await expect(
      service.verifyPresentation({
        presentation,
        issuerPublicJwk: keys.issuerPublicJwk,
        holderPublicJwk: keys.holderPublicJwk,
        binding: { ...binding, audience: "revealid:wrong" },
        requireHolderBinding: true
      })
    ).rejects.toThrow();
  });

  test("wrong nonce fails", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const binding = createBinding();
    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk,
      binding
    });

    await expect(
      service.verifyPresentation({
        presentation,
        issuerPublicJwk: keys.issuerPublicJwk,
        holderPublicJwk: keys.holderPublicJwk,
        binding: { ...binding, nonce: "nonce-wrong" },
        requireHolderBinding: true
      })
    ).rejects.toThrow();
  });

  test("missing holder binding fails when required", async () => {
    const keys = await createKeys();
    const credentialInput = createCredential(keys.holderPublicJwk);
    const credential = await service.issueCredential({
      ...credentialInput,
      issuerPrivateJwk: keys.issuerPrivateJwk,
      issuerPublicJwk: keys.issuerPublicJwk
    });

    const presentation = await service.createPresentation({
      credential,
      presentationFrame,
      holderPrivateJwk: keys.holderPrivateJwk,
      holderPublicJwk: keys.holderPublicJwk
    });

    await expect(
      service.verifyPresentation({
        presentation,
        issuerPublicJwk: keys.issuerPublicJwk,
        holderPublicJwk: keys.holderPublicJwk,
        binding: createBinding(),
        requireHolderBinding: true
      })
    ).rejects.toThrow();
  });
});
