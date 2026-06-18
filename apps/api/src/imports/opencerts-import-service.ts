import { createHash } from "node:crypto";
import {
  bridgeDisclaimer,
  importOpenCertsPendingResponseSchema,
  opencertsHiddenByDefault,
  type ImportOpenCertsPendingResponse,
  type ImportOpenCertsRequest,
  type OpenCertsIssuerPolicyMode,
  type OpenCertsVerificationMode
} from "@revealid/contracts";

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
  status: "PENDING_VERIFICATION";
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

export class OpenCertsImportService {
  constructor(
    private readonly prisma: SourceCredentialImportPrisma,
    private readonly options: {
      defaultVerificationMode: OpenCertsVerificationMode;
      defaultIssuerPolicyMode: OpenCertsIssuerPolicyMode;
      maxUploadBytes: number;
      retainSourceByDefault: boolean;
    }
  ) {}

  async createPendingImport(holderId: string, input: ImportOpenCertsRequest): Promise<ImportOpenCertsPendingResponse> {
    const serializedDocument = JSON.stringify(input.document);
    if (Buffer.byteLength(serializedDocument, "utf8") > this.options.maxUploadBytes) {
      throw new Error("OpenCerts upload too large");
    }

    const retainEncryptedSource = input.retainEncryptedSource ?? this.options.retainSourceByDefault;
    if (retainEncryptedSource) {
      throw new Error("OpenCerts source retention is not available in Phase 1");
    }

    const verificationMode = input.verificationMode ?? this.options.defaultVerificationMode;
    const issuerPolicyMode = input.issuerPolicyMode ?? this.options.defaultIssuerPolicyMode;
    const sourceFileHash = `sha256:${createHash("sha256").update(serializedDocument, "utf8").digest("hex")}`;

    const record = await this.prisma.sourceCredentialImport.create({
      data: {
        holderId,
        sourceType: "UNKNOWN",
        sourceFileHash,
        verificationMode,
        issuerPolicyMode,
        hiddenByDefault: [...opencertsHiddenByDefault],
        status: "PENDING_VERIFICATION"
      }
    });

    return importOpenCertsPendingResponseSchema.parse({
      importId: record.id,
      status: "pending_verification",
      source: {
        type: "UNKNOWN",
        sourceFileHash,
        verificationMode,
        issuerPolicyMode
      },
      hiddenByDefault: [...opencertsHiddenByDefault],
      disclaimer: bridgeDisclaimer
    });
  }
}
