import { createRequire } from "node:module";
import type {
  OpenCertsSourceType,
  OpenCertsVerificationMode,
  OpenCertsVerificationSummary
} from "@revealid/contracts";

type VerificationFragment = {
  type?: string;
  name?: string;
  status?: "VALID" | "INVALID" | "ERROR" | "SKIPPED";
  reason?: unknown;
  data?: unknown;
};

export type SourceCredentialVerificationResult = {
  sourceType: OpenCertsSourceType;
  summary: OpenCertsVerificationSummary;
  fragments: VerificationFragment[];
  accepted: boolean;
};

type TrustVcModule = {
  verifyDocument(document: unknown, options?: { rpcProviderUrl?: string }): Promise<VerificationFragment[]>;
  verifyOASignature(document: unknown): Promise<boolean>;
};

export type SourceCredentialVerifier = {
  verify(document: unknown, mode: OpenCertsVerificationMode): Promise<SourceCredentialVerificationResult>;
};

const require = createRequire(import.meta.url);

const loadTrustVc = (): TrustVcModule => {
  // TrustVC 2.14.x has ESM entrypoints with extensionless internal imports.
  // Loading the CJS export keeps that package detail behind this service boundary.
  return require("@trustvc/trustvc") as TrustVcModule;
};

const hasStatus = (fragments: VerificationFragment[], type: string, status: VerificationFragment["status"]) =>
  fragments.some((fragment) => fragment.type === type && fragment.status === status);

const hasBlockingStatus = (fragments: VerificationFragment[], type: string) =>
  fragments.some(
    (fragment) => fragment.type === type && (fragment.status === "INVALID" || fragment.status === "ERROR")
  );

const inferSourceType = (document: unknown): OpenCertsSourceType => {
  if (typeof document !== "object" || document === null || !("version" in document)) {
    return "UNKNOWN";
  }
  const version = (document as { version?: unknown }).version;
  if (version === "https://schema.openattestation.com/2.0/schema.json") return "OPENCERTS_V2";
  if (version === "https://schema.openattestation.com/3.0/schema.json") return "OPENCERTS_V3";
  return "UNKNOWN";
};

export class SourceCredentialVerificationService implements SourceCredentialVerifier {
  constructor(
    private readonly options: {
      apiVerifyUrl: string;
      rpcProviderUrl?: string;
      trustVc?: TrustVcModule;
      fetcher?: typeof fetch;
    }
  ) {}

  async verify(document: unknown, mode: OpenCertsVerificationMode): Promise<SourceCredentialVerificationResult> {
    if (mode === "OPENCERTS_API") {
      return this.verifyWithOpenCertsApi(document);
    }
    return this.verifyWithTrustVc(document);
  }

  private async verifyWithTrustVc(document: unknown): Promise<SourceCredentialVerificationResult> {
    const trustVc = this.options.trustVc ?? loadTrustVc();
    let fragments: VerificationFragment[] = [];
    let signatureValid = false;

    try {
      signatureValid = await trustVc.verifyOASignature(document);
      fragments = await trustVc.verifyDocument(
        document,
        this.options.rpcProviderUrl ? { rpcProviderUrl: this.options.rpcProviderUrl } : undefined
      );
    } catch (error) {
      fragments = [
        {
          type: "DOCUMENT_INTEGRITY",
          name: "TrustVC",
          status: "ERROR",
          reason: error instanceof Error ? error.message : "Unknown TrustVC verification error"
        }
      ];
    }

    const summary = summarizeFragments(fragments, signatureValid);
    return {
      sourceType: inferSourceType(document),
      summary,
      fragments,
      accepted: summary.documentIntegrity
    };
  }

  private async verifyWithOpenCertsApi(document: unknown): Promise<SourceCredentialVerificationResult> {
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(this.options.apiVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document })
    });
    if (!response.ok) {
      throw new Error(`OpenCerts API verification failed: ${response.status}`);
    }
    const body = (await response.json()) as {
      summary?: Partial<OpenCertsVerificationSummary>;
      data?: VerificationFragment[];
    };
    const summary = {
      all: body.summary?.all === true,
      documentIntegrity: body.summary?.documentIntegrity === true,
      documentStatus: body.summary?.documentStatus === true,
      issuerIdentity: body.summary?.issuerIdentity === true
    };
    return {
      sourceType: inferSourceType(document),
      summary,
      fragments: body.data ?? [],
      accepted: summary.all
    };
  }
}

export const summarizeFragments = (
  fragments: VerificationFragment[],
  signatureValid: boolean
): OpenCertsVerificationSummary => {
  const documentIntegrity =
    signatureValid &&
    (hasStatus(fragments, "DOCUMENT_INTEGRITY", "VALID") || !hasBlockingStatus(fragments, "DOCUMENT_INTEGRITY"));
  const documentStatus =
    hasStatus(fragments, "DOCUMENT_STATUS", "VALID") || !hasBlockingStatus(fragments, "DOCUMENT_STATUS");
  const issuerIdentity =
    hasStatus(fragments, "ISSUER_IDENTITY", "VALID") || !hasBlockingStatus(fragments, "ISSUER_IDENTITY");

  return {
    all: documentIntegrity && documentStatus && issuerIdentity,
    documentIntegrity,
    documentStatus,
    issuerIdentity
  };
};
