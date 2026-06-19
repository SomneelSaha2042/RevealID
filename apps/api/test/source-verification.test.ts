import { describe, expect, it } from "vitest";
import { SourceCredentialVerificationService } from "../src/imports/source-credential-verification-service.js";

describe("SourceCredentialVerificationService", () => {
  it("keeps local document integrity accepted when broader TrustVC checks are unavailable", async () => {
    const service = new SourceCredentialVerificationService({
      apiVerifyUrl: "https://api.opencerts.io/verify",
      trustVc: {
        verifyOASignature: async () => true,
        verifyDocument: async () => {
          throw new Error("RPC unavailable");
        }
      }
    });

    const result = await service.verify(
      { version: "https://schema.openattestation.com/2.0/schema.json" },
      "LOCAL_TRUSTVC"
    );

    expect(result.accepted).toBe(true);
    expect(result.summary).toEqual({
      all: false,
      documentIntegrity: true,
      documentStatus: false,
      issuerIdentity: false
    });
    expect(result.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "DOCUMENT_STATUS", status: "ERROR" }),
        expect.objectContaining({ type: "ISSUER_IDENTITY", status: "ERROR" })
      ])
    );
  });

  it("rejects local verification when OpenAttestation signature verification fails", async () => {
    const service = new SourceCredentialVerificationService({
      apiVerifyUrl: "https://api.opencerts.io/verify",
      trustVc: {
        verifyOASignature: async () => {
          throw new Error("Invalid signature");
        },
        verifyDocument: async () => []
      }
    });

    const result = await service.verify(
      { version: "https://schema.openattestation.com/2.0/schema.json" },
      "LOCAL_TRUSTVC"
    );

    expect(result.accepted).toBe(false);
    expect(result.summary.documentIntegrity).toBe(false);
  });
});
