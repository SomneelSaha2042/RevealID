import type { OpenCertsIssuerPolicyMode } from "@revealid/contracts";

export class IssuerPolicyError extends Error {
  constructor(message = "OpenCerts issuer policy failed") {
    super(message);
    this.name = "IssuerPolicyError";
  }
}

export class OpenCertsIssuerPolicy {
  enforce(
    mode: OpenCertsIssuerPolicyMode,
    source: {
      originalIssuerName?: string;
      originalIdentityLocation?: string;
      sampleMode: boolean;
    }
  ) {
    if (mode === "DEMO") {
      if (source.sampleMode) return;
      throw new IssuerPolicyError("Demo issuer policy only accepts the public OpenCerts demo issuer");
    }

    const issuerName = source.originalIssuerName?.toLowerCase() ?? "";
    const identityLocation = source.originalIdentityLocation?.toLowerCase() ?? "";
    if (issuerName.includes("national university of singapore") || identityLocation.endsWith("nus.edu.sg")) {
      return;
    }

    throw new IssuerPolicyError("NUS_ONLY issuer policy rejected this OpenCerts source");
  }
}
