import { createHash } from "node:crypto";
import {
  bridgeDisclaimer,
  importOpenCertsFailureResponseSchema,
  importOpenCertsVerifiedResponseSchema,
  opencertsHiddenByDefault,
  type ImportOpenCertsFailureResponse,
  type ImportOpenCertsRequest,
  type ImportOpenCertsVerifiedResponse,
  type OpenCertsIssuerPolicyMode,
  type OpenCertsVerificationMode
} from "@revealid/contracts";
import { AcademicClaimNormalizer } from "./academic-claim-normalizer.js";
import { IssuerPolicyError, OpenCertsIssuerPolicy } from "./issuer-policy.js";
import type { SourceCredentialVerifier } from "./source-credential-verification-service.js";
import type { NormalizedOpenCertsClaims } from "@revealid/contracts";

type SourceCredentialImportCreateInput = {
  holderId: string;
  sourceType: string;
  sourceFileHash: string;
  verificationMode: string;
  issuerPolicyMode: string;
  verificationSummary?: unknown;
  normalizedClaims?: unknown;
  hiddenByDefault: string[];
  encryptedSourceDocument?: unknown;
  sourceRetentionExpiresAt?: Date;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "FAILED";
  failureCode?: string;
  verifiedAt?: Date;
};

type SourceCredentialImportRecord = SourceCredentialImportCreateInput & {
  id: string;
  createdAt: Date;
};

export type SourceCredentialImportPrisma = {
  sourceCredentialImport: {
    create(input: { data: SourceCredentialImportCreateInput }): Promise<SourceCredentialImportRecord>;
  };
};

export class OpenCertsImportError extends Error {
  constructor(
    readonly response: ImportOpenCertsFailureResponse,
    readonly statusCode: number
  ) {
    super(response.message);
    this.name = "OpenCertsImportError";
  }
}

const previewClaims = (claims: NormalizedOpenCertsClaims): NormalizedOpenCertsClaims => {
  const safeClaims = { ...claims };
  delete safeClaims.transcript;
  delete safeClaims.additionalData;
  return safeClaims;
};

export class OpenCertsImportService {
  constructor(
    private readonly prisma: SourceCredentialImportPrisma,
    private readonly verifier: SourceCredentialVerifier,
    private readonly normalizer: AcademicClaimNormalizer,
    private readonly issuerPolicy: OpenCertsIssuerPolicy,
    private readonly options: {
      defaultVerificationMode: OpenCertsVerificationMode;
      defaultIssuerPolicyMode: OpenCertsIssuerPolicyMode;
      maxUploadBytes: number;
      retainSourceByDefault: boolean;
    }
  ) {}

  async importOpenCerts(holderId: string, input: ImportOpenCertsRequest): Promise<ImportOpenCertsVerifiedResponse> {
    const serializedDocument = JSON.stringify(input.document);
    if (Buffer.byteLength(serializedDocument, "utf8") > this.options.maxUploadBytes) {
      throw new Error("OpenCerts upload too large");
    }

    const retainEncryptedSource = input.retainEncryptedSource ?? this.options.retainSourceByDefault;
    if (retainEncryptedSource) {
      throw new Error("OpenCerts source retention is not available in Phase 2");
    }

    const verificationMode = input.verificationMode ?? this.options.defaultVerificationMode;
    const issuerPolicyMode = input.issuerPolicyMode ?? this.options.defaultIssuerPolicyMode;
    const sourceFileHash = `sha256:${createHash("sha256").update(serializedDocument, "utf8").digest("hex")}`;
    const normalized = this.normalizer.normalize(input.document);
    const safeNormalizedClaims = previewClaims(normalized.claims);

    let verification;
    try {
      verification = await this.verifier.verify(input.document, verificationMode);
    } catch {
      const record = await this.prisma.sourceCredentialImport.create({
        data: {
          holderId,
          sourceType: "UNKNOWN",
          sourceFileHash,
          verificationMode,
          issuerPolicyMode,
          hiddenByDefault: [...opencertsHiddenByDefault],
          normalizedClaims: safeNormalizedClaims,
          status: "FAILED",
          failureCode: "external_verification_unavailable"
        }
      });
      throw new OpenCertsImportError(
        importOpenCertsFailureResponseSchema.parse({
          status: "invalid",
          failureCode: "external_verification_unavailable",
          message: "The OpenCerts verification service was unavailable.",
          importId: record.id,
          sourceFileHash
        }),
        502
      );
    }

    if (!verification.accepted) {
      const record = await this.prisma.sourceCredentialImport.create({
        data: {
          holderId,
          sourceType: verification.sourceType,
          sourceFileHash,
          verificationMode,
          issuerPolicyMode,
          verificationSummary: verification.summary,
          normalizedClaims: safeNormalizedClaims,
          hiddenByDefault: [...opencertsHiddenByDefault],
          status: "FAILED",
          failureCode: "source_verification_failed"
        }
      });
      throw new OpenCertsImportError(
        importOpenCertsFailureResponseSchema.parse({
          status: "invalid",
          failureCode: "source_verification_failed",
          message: "The OpenCerts source document could not be verified.",
          importId: record.id,
          sourceFileHash,
          verification: verification.summary
        }),
        422
      );
    }

    try {
      this.issuerPolicy.enforce(issuerPolicyMode, normalized);
    } catch (error) {
      if (!(error instanceof IssuerPolicyError)) throw error;
      const record = await this.prisma.sourceCredentialImport.create({
        data: {
          holderId,
          sourceType: verification.sourceType,
          sourceFileHash,
          verificationMode,
          issuerPolicyMode,
          verificationSummary: verification.summary,
          normalizedClaims: safeNormalizedClaims,
          hiddenByDefault: [...opencertsHiddenByDefault],
          status: "FAILED",
          failureCode: "issuer_policy_failed"
        }
      });
      throw new OpenCertsImportError(
        importOpenCertsFailureResponseSchema.parse({
          status: "invalid",
          failureCode: "issuer_policy_failed",
          message: error.message,
          importId: record.id,
          sourceFileHash,
          verification: verification.summary
        }),
        422
      );
    }

    const verifiedAt = new Date();
    const record = await this.prisma.sourceCredentialImport.create({
      data: {
        holderId,
        sourceType: verification.sourceType,
        sourceFileHash,
        verificationMode,
        issuerPolicyMode,
        verificationSummary: verification.summary,
        normalizedClaims: safeNormalizedClaims,
        hiddenByDefault: [...opencertsHiddenByDefault],
        status: "VERIFIED",
        verifiedAt
      }
    });

    return importOpenCertsVerifiedResponseSchema.parse({
      importId: record.id,
      status: "verified",
      source: {
        type: verification.sourceType,
        sourceFileHash,
        verifiedAt: verifiedAt.toISOString(),
        verificationMode,
        issuerPolicyMode,
        verification: verification.summary,
        originalIssuerName: normalized.originalIssuerName,
        originalIdentityLocation: normalized.originalIdentityLocation,
        sampleMode: normalized.sampleMode
      },
      normalizedClaims: safeNormalizedClaims,
      hiddenByDefault: [...opencertsHiddenByDefault],
      disclaimer: bridgeDisclaimer
    });
  }
}
